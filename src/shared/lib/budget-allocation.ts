import { DEPOSIT_SUM_EPS, PERCENT_SUM_EPS, distributeAmountsByPercent } from "@/shared/lib/deposit-split";
import type {
  BudgetAllocationMode,
  BudgetAllocationNode,
  BudgetStatus,
  BudgetTotals,
} from "@/entities/budget/model";

export type SiblingInput = {
  allocationMode: BudgetAllocationMode;
  percent?: number | null;
  amount?: number | null;
};

export type FlatAllocationRow = {
  id: string;
  parentId: string | null;
  categoryId: string | null;
  categoryName?: string | null;
  tagId: string | null;
  tagName?: string | null;
  allocationMode: BudgetAllocationMode;
  percent: number | null;
  amount: number;
  sortOrder: number;
};

/** Resolve amounts de um grupo de irmãos a partir do pool (renda ou amount do pai). */
export function resolveSiblingAmounts(pool: number, rows: SiblingInput[]): number[] {
  if (rows.length === 0) return [];

  const allPercent = rows.every((r) => r.allocationMode === "percent");
  if (allPercent) {
    const percents = rows.map((r) => Number(r.percent ?? 0));
    const sumP = percents.reduce((a, p) => a + p, 0);
    if (Math.abs(sumP - 100) <= PERCENT_SUM_EPS) {
      return distributeAmountsByPercent(pool, percents);
    }
  }

  return rows.map((r) => {
    if (r.allocationMode === "percent") {
      return Number((((pool * Number(r.percent ?? 0)) / 100) || 0).toFixed(2));
    }
    return Number((Number(r.amount ?? 0) || 0).toFixed(2));
  });
}

/** Valida um grupo de irmãos contra o pool. Retorna mensagem de erro em PT ou null. */
export function validateSiblingGroup(pool: number, rows: SiblingInput[]): string | null {
  if (rows.length === 0) return null;
  if (pool < 0) return "O valor base da divisão não pode ser negativo.";

  const allPercent = rows.every((r) => r.allocationMode === "percent");
  if (allPercent) {
    const sumP = rows.reduce((a, r) => a + Number(r.percent ?? 0), 0);
    if (sumP - 100 > PERCENT_SUM_EPS) {
      return "A soma dos percentuais não pode passar de 100%.";
    }
    if (sumP < 0) return "Percentuais inválidos.";
  }

  const amounts = resolveSiblingAmounts(pool, rows);
  const sum = amounts.reduce((a, v) => a + v, 0);
  if (sum - pool > DEPOSIT_SUM_EPS) {
    return "A soma das alocações não pode passar do valor disponível.";
  }
  for (const amount of amounts) {
    if (amount < 0) return "Valores de alocação não podem ser negativos.";
  }
  return null;
}

export function assertUniqueRootCategoryIds(roots: { categoryId?: string | null }[]): string | null {
  const seen = new Set<string>();
  for (const node of roots) {
    const id = node.categoryId?.trim();
    if (!id) return "Selecione uma categoria em todas as divisões principais.";
    if (seen.has(id)) return "A mesma categoria não pode aparecer mais de uma vez no orçamento.";
    seen.add(id);
  }
  return null;
}

export function assertUniqueTagIds(nodes: { tagId?: string | null }[]): string | null {
  const seen = new Set<string>();
  for (const node of nodes) {
    const id = node.tagId?.trim();
    if (!id) return "Selecione uma tag em todas as subdivisões.";
    if (seen.has(id)) return "A mesma tag não pode aparecer mais de uma vez no orçamento.";
    seen.add(id);
  }
  return null;
}

export function collectTreeNodes(tree: BudgetAllocationNode[]): BudgetAllocationNode[] {
  const out: BudgetAllocationNode[] = [];
  const walk = (nodes: BudgetAllocationNode[]) => {
    for (const n of nodes) {
      out.push(n);
      if (n.children?.length) walk(n.children);
    }
  };
  walk(tree);
  return out;
}

export function buildAllocationTree(flatRows: FlatAllocationRow[]): BudgetAllocationNode[] {
  const byParent = new Map<string | null, FlatAllocationRow[]>();
  for (const row of flatRows) {
    const key = row.parentId;
    const list = byParent.get(key) ?? [];
    list.push(row);
    byParent.set(key, list);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
  }

  const build = (parentId: string | null): BudgetAllocationNode[] => {
    const rows = byParent.get(parentId) ?? [];
    return rows.map((row) => ({
      id: row.id,
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      tagId: row.tagId,
      tagName: row.tagName,
      allocationMode: row.allocationMode,
      percent: row.percent,
      amount: row.amount,
      sortOrder: row.sortOrder,
      children: build(row.id),
    }));
  };

  return build(null);
}

export type FlattenedInsert = {
  id: string;
  parentId: string | null;
  categoryId: string | null;
  tagId: string | null;
  allocationMode: BudgetAllocationMode;
  percent: number | null;
  amount: number;
  sortOrder: number;
};

export type TreeInputNode = {
  id?: string;
  categoryId?: string | null;
  tagId?: string | null;
  allocationMode: BudgetAllocationMode;
  percent?: number | null;
  amount?: number | null;
  children?: TreeInputNode[];
};

function validateTreeRefs(tree: TreeInputNode[]): string | null {
  const uniqueCatErr = assertUniqueRootCategoryIds(tree);
  if (uniqueCatErr) return uniqueCatErr;

  const allTags: { tagId?: string | null }[] = [];
  const walkChildren = (nodes: TreeInputNode[]) => {
    for (const n of nodes) {
      allTags.push({ tagId: n.tagId });
      if (n.children?.length) walkChildren(n.children);
    }
  };

  for (const root of tree) {
    if (root.children?.length) walkChildren(root.children);
  }

  if (allTags.length > 0) {
    const uniqueTagErr = assertUniqueTagIds(allTags);
    if (uniqueTagErr) return uniqueTagErr;
  }
  return null;
}

/**
 * Resolve amounts top-down e achata a árvore para insert.
 * Raiz: categoryId; filhos: tagId.
 */
export function flattenAndResolveTree(
  incomeAmount: number,
  tree: TreeInputNode[],
  makeId: () => string = () => crypto.randomUUID(),
): { rows: FlattenedInsert[]; error: string | null } {
  const refErr = validateTreeRefs(tree);
  if (refErr) return { rows: [], error: refErr };

  const rows: FlattenedInsert[] = [];

  const resolveGroup = (
    pool: number,
    nodes: TreeInputNode[],
    parentId: string | null,
    isRoot: boolean,
  ): string | null => {
    if (nodes.length === 0) return null;
    const err = validateSiblingGroup(
      pool,
      nodes.map((n) => ({
        allocationMode: n.allocationMode,
        percent: n.percent,
        amount: n.amount,
      })),
    );
    if (err) return err;

    const amounts = resolveSiblingAmounts(
      pool,
      nodes.map((n) => ({
        allocationMode: n.allocationMode,
        percent: n.percent,
        amount: n.amount,
      })),
    );

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]!;
      const amount = amounts[i] ?? 0;
      const id = node.id?.trim() || makeId();
      let percent = Number(node.percent ?? 0);
      if (node.allocationMode !== "percent") {
        percent = pool > 0 ? Number(((amount / pool) * 100).toFixed(2)) : 0;
      }

      rows.push({
        id,
        parentId,
        categoryId: isRoot ? (node.categoryId?.trim() || null) : null,
        tagId: isRoot ? null : (node.tagId?.trim() || null),
        allocationMode: node.allocationMode,
        percent,
        amount,
        sortOrder: i,
      });

      const children = node.children ?? [];
      if (children.length > 0) {
        const childErr = resolveGroup(amount, children, id, false);
        if (childErr) return childErr;
      }
    }
    return null;
  };

  const error = resolveGroup(incomeAmount, tree, null, true);
  return { rows, error };
}

export function computeBudgetTotals(incomeAmount: number, tree: BudgetAllocationNode[]): BudgetTotals {
  const allocatedRoot = tree.reduce((a, n) => a + n.amount, 0);
  const remainingRoot = Number((incomeAmount - allocatedRoot).toFixed(2));
  const allocatedPercentOfIncome =
    incomeAmount > 0 ? Number(((allocatedRoot / incomeAmount) * 100).toFixed(2)) : 0;
  return { allocatedRoot, remainingRoot, allocatedPercentOfIncome };
}

export function budgetStatus(planned: number, spent: number): BudgetStatus {
  if (spent > planned + DEPOSIT_SUM_EPS) return "over";
  if (planned <= 0) return spent > DEPOSIT_SUM_EPS ? "over" : "under";
  const ratio = spent / planned;
  if (ratio >= 0.9) return "on_track";
  return "under";
}

/**
 * Anexa spent/status.
 * Raiz: gasto por categoryId. Filhos: gasto por tagId (compras com essa tag no mês).
 */
export function attachActualsToTree(
  tree: BudgetAllocationNode[],
  actualsByCategoryId: Record<string, number>,
  actualsByTagId: Record<string, number> = {},
): BudgetAllocationNode[] {
  const enrich = (node: BudgetAllocationNode): BudgetAllocationNode => {
    const children = (node.children ?? []).map(enrich);
    const plannedAmount = node.amount;
    let spentAmount: number | undefined;
    let status: BudgetStatus | undefined;

    if (node.categoryId) {
      spentAmount = actualsByCategoryId[node.categoryId] ?? 0;
      status = budgetStatus(plannedAmount, spentAmount);
    } else if (node.tagId) {
      spentAmount = actualsByTagId[node.tagId] ?? 0;
      status = budgetStatus(plannedAmount, spentAmount);
    }

    return {
      ...node,
      children,
      plannedAmount,
      spentAmount,
      spentChildrenSum: 0,
      status,
    };
  };
  return tree.map(enrich);
}

export function fillRemainderAmount(pool: number, amounts: number[], lastIndex: number): number[] {
  if (amounts.length === 0 || lastIndex < 0 || lastIndex >= amounts.length) return amounts;
  const others = amounts.reduce((a, v, i) => (i === lastIndex ? a : a + v), 0);
  const next = [...amounts];
  next[lastIndex] = Number(Math.max(0, pool - others).toFixed(2));
  return next;
}

export function fillRemainderPercent(percents: number[], lastIndex: number): number[] {
  if (percents.length === 0 || lastIndex < 0 || lastIndex >= percents.length) return percents;
  const others = percents.reduce((a, v, i) => (i === lastIndex ? a : a + v), 0);
  const next = [...percents];
  next[lastIndex] = Number(Math.max(0, 100 - others).toFixed(2));
  return next;
}
