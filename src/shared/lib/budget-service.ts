import { and, asc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { addMonths, format, parse, startOfMonth } from "date-fns";

import { db, schema } from "@/db";
import type { BudgetAllocationNode, MonthlyBudgetPayload } from "@/entities/budget/model";
import {
  attachActualsToTree,
  buildAllocationTree,
  computeBudgetTotals,
  flattenAndResolveTree,
  type TreeInputNode,
} from "@/shared/lib/budget-allocation";

const MONTH_RE = /^\d{4}-\d{2}$/;

function assertMonth(month: string): string {
  const m = month.trim();
  if (!MONTH_RE.test(m)) throw new Error("Mês inválido (use yyyy-MM)");
  return m;
}

function monthRange(month: string): { start: string; endExclusive: string } {
  const startDate = startOfMonth(parse(`${month}-01`, "yyyy-MM-dd", new Date()));
  const start = format(startDate, "yyyy-MM-dd");
  const endExclusive = format(addMonths(startDate, 1), "yyyy-MM-dd");
  return { start, endExclusive };
}

async function getSpentByCategoryForMonth(month: string): Promise<Record<string, number>> {
  const { start, endExclusive } = monthRange(month);
  const rows = await db
    .select({
      categoryId: schema.purchases.categoryId,
      total: sql<number>`coalesce(sum(${schema.purchases.amount}), 0)`,
    })
    .from(schema.purchases)
    .where(
      and(
        gte(schema.purchases.purchaseDate, start),
        lt(schema.purchases.purchaseDate, endExclusive),
      ),
    )
    .groupBy(schema.purchases.categoryId);

  const map: Record<string, number> = {};
  for (const row of rows) {
    if (!row.categoryId) continue;
    map[row.categoryId] = Number(row.total ?? 0);
  }
  return map;
}

async function getSpentByTagForMonth(month: string): Promise<Record<string, number>> {
  const { start, endExclusive } = monthRange(month);
  const rows = await db
    .select({
      tagId: schema.purchaseTags.tagId,
      total: sql<number>`coalesce(sum(${schema.purchases.amount}), 0)`,
    })
    .from(schema.purchaseTags)
    .innerJoin(schema.purchases, eq(schema.purchases.id, schema.purchaseTags.purchaseId))
    .where(
      and(
        gte(schema.purchases.purchaseDate, start),
        lt(schema.purchases.purchaseDate, endExclusive),
      ),
    )
    .groupBy(schema.purchaseTags.tagId);

  const map: Record<string, number> = {};
  for (const row of rows) {
    map[row.tagId] = Number(row.total ?? 0);
  }
  return map;
}

async function loadBudgetTree(budgetId: string): Promise<BudgetAllocationNode[]> {
  const rows = await db
    .select({
      id: schema.budgetAllocations.id,
      parentId: schema.budgetAllocations.parentId,
      categoryId: schema.budgetAllocations.categoryId,
      categoryName: schema.categories.name,
      tagId: schema.budgetAllocations.tagId,
      tagName: schema.tags.name,
      allocationMode: schema.budgetAllocations.allocationMode,
      percent: schema.budgetAllocations.percent,
      amount: schema.budgetAllocations.amount,
      sortOrder: schema.budgetAllocations.sortOrder,
    })
    .from(schema.budgetAllocations)
    .leftJoin(schema.categories, eq(schema.categories.id, schema.budgetAllocations.categoryId))
    .leftJoin(schema.tags, eq(schema.tags.id, schema.budgetAllocations.tagId))
    .where(eq(schema.budgetAllocations.budgetId, budgetId))
    .orderBy(asc(schema.budgetAllocations.sortOrder));

  return buildAllocationTree(
    rows.map((r) => ({
      id: r.id,
      parentId: r.parentId,
      categoryId: r.categoryId,
      categoryName: r.categoryName,
      tagId: r.tagId,
      tagName: r.tagName,
      allocationMode: r.allocationMode as "percent" | "amount",
      percent: r.percent,
      amount: r.amount,
      sortOrder: r.sortOrder,
    })),
  );
}

export async function getMonthlyBudget(month: string): Promise<MonthlyBudgetPayload> {
  const m = assertMonth(month);
  const [budget] = await db
    .select()
    .from(schema.monthlyBudgets)
    .where(eq(schema.monthlyBudgets.month, m))
    .limit(1);

  const [actualsByCategoryId, actualsByTagId] = await Promise.all([
    getSpentByCategoryForMonth(m),
    getSpentByTagForMonth(m),
  ]);

  if (!budget) {
    return {
      budget: null,
      tree: [],
      totals: { allocatedRoot: 0, remainingRoot: 0, allocatedPercentOfIncome: 0 },
      actualsByCategoryId,
      actualsByTagId,
    };
  }

  const rawTree = await loadBudgetTree(budget.id);
  const tree = attachActualsToTree(rawTree, actualsByCategoryId, actualsByTagId);
  const totals = computeBudgetTotals(budget.incomeAmount, tree);

  return {
    budget: {
      id: budget.id,
      month: budget.month,
      incomeAmount: budget.incomeAmount,
      createdByUserId: budget.createdByUserId,
    },
    tree,
    totals,
    actualsByCategoryId,
    actualsByTagId,
  };
}

export async function upsertMonthlyBudget(input: {
  month: string;
  incomeAmount: number;
  allocations: TreeInputNode[];
  userId: string;
}): Promise<MonthlyBudgetPayload> {
  const month = assertMonth(input.month);
  const incomeAmount = Number(input.incomeAmount);
  if (incomeAmount < 0) throw new Error("A renda mensal não pode ser negativa.");

  const { rows, error } = flattenAndResolveTree(incomeAmount, input.allocations ?? []);
  if (error) throw new Error(error);

  const categoryIds = [...new Set(rows.map((r) => r.categoryId).filter((id): id is string => Boolean(id)))];
  if (categoryIds.length > 0) {
    const existing = await db
      .select({ id: schema.categories.id })
      .from(schema.categories)
      .where(inArray(schema.categories.id, categoryIds));
    if (existing.length !== categoryIds.length) {
      throw new Error("Uma ou mais categorias não existem.");
    }
  }

  const tagIds = [...new Set(rows.map((r) => r.tagId).filter((id): id is string => Boolean(id)))];
  if (tagIds.length > 0) {
    const existing = await db
      .select({ id: schema.tags.id })
      .from(schema.tags)
      .where(inArray(schema.tags.id, tagIds));
    if (existing.length !== tagIds.length) {
      throw new Error("Uma ou mais tags não existem.");
    }
  }

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(schema.monthlyBudgets)
      .where(eq(schema.monthlyBudgets.month, month))
      .limit(1);

    const now = new Date();
    let budgetId: string;

    if (existing) {
      budgetId = existing.id;
      await tx
        .update(schema.monthlyBudgets)
        .set({
          incomeAmount,
          updatedAt: now,
        })
        .where(eq(schema.monthlyBudgets.id, budgetId));

      await tx
        .update(schema.budgetAllocations)
        .set({ parentId: null })
        .where(eq(schema.budgetAllocations.budgetId, budgetId));
      await tx.delete(schema.budgetAllocations).where(eq(schema.budgetAllocations.budgetId, budgetId));
    } else {
      budgetId = crypto.randomUUID();
      await tx.insert(schema.monthlyBudgets).values({
        id: budgetId,
        month,
        incomeAmount,
        createdByUserId: input.userId,
        createdAt: now,
        updatedAt: now,
      });
    }

    if (rows.length > 0) {
      await tx.insert(schema.budgetAllocations).values(
        rows.map((r) => ({
          id: r.id,
          budgetId,
          parentId: r.parentId,
          categoryId: r.categoryId,
          tagId: r.tagId,
          allocationMode: r.allocationMode,
          percent: r.percent,
          amount: r.amount,
          sortOrder: r.sortOrder,
        })),
      );
    }
  });

  return getMonthlyBudget(month);
}

export async function copyMonthlyBudget(input: {
  fromMonth: string;
  toMonth: string;
  userId: string;
}): Promise<MonthlyBudgetPayload> {
  const fromMonth = assertMonth(input.fromMonth);
  const toMonth = assertMonth(input.toMonth);
  if (fromMonth === toMonth) throw new Error("Mês de origem e destino devem ser diferentes.");

  const source = await getMonthlyBudget(fromMonth);
  if (!source.budget) throw new Error("Não há orçamento no mês de origem.");

  const toTreeInput = (nodes: BudgetAllocationNode[]): TreeInputNode[] =>
    nodes.map((n) => ({
      categoryId: n.categoryId,
      tagId: n.tagId,
      allocationMode: n.allocationMode,
      percent: n.percent,
      amount: n.amount,
      children: toTreeInput(n.children ?? []),
    }));

  return upsertMonthlyBudget({
    month: toMonth,
    incomeAmount: source.budget.incomeAmount,
    allocations: toTreeInput(source.tree),
    userId: input.userId,
  });
}

export async function categoryUsedInBudgets(categoryId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: schema.budgetAllocations.id })
    .from(schema.budgetAllocations)
    .where(eq(schema.budgetAllocations.categoryId, categoryId))
    .limit(1);
  return Boolean(row);
}

export async function tagUsedInBudgets(tagId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: schema.budgetAllocations.id })
    .from(schema.budgetAllocations)
    .where(eq(schema.budgetAllocations.tagId, tagId))
    .limit(1);
  return Boolean(row);
}
