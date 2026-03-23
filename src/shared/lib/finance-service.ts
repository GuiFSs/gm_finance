import { and, asc, desc, eq, gt, gte, inArray, isNull, lte, ne, or, sql } from "drizzle-orm";
import { addMonths, endOfMonth, format, getDate, startOfMonth } from "date-fns";

import { db, schema } from "@/db";
import type { PaymentSourceType } from "@/shared/types/domain";
import { DEPOSIT_SUM_EPS, distributeAmountsByPercent } from "@/shared/lib/deposit-split";
import { formatCurrency, parseLocalDateYmd } from "@/shared/utils/formatters";

/**
 * Data de referência do servidor (yyyy-MM-dd) para decidir se débitos de **compra** já “venceram”.
 * Depósitos, ajustes e transferências entram no saldo na data do lançamento; só parcelas de compra
 * ficam de fora até `occurredAt` ≤ este dia (evita timezone que escondia depósitos de hoje).
 */
export function ledgerBalanceCutoffDate(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export type DepositSplitInput = {
  targetType: "account" | "pocket";
  pocketId?: string | null;
  amount: number;
};

export { distributeAmountsByPercent } from "@/shared/lib/deposit-split";

type PurchaseInput = {
  title: string;
  description?: string;
  amount: number;
  purchaseDate: string;
  categoryId?: string;
  createdByUserId: string;
  paymentSourceType: PaymentSourceType;
  paymentSourceId?: string;
  installmentCount: number;
  recurringOriginId?: string;
  tagIds: string[];
};

export async function seedInitialUsers() {
  const existing = await db.select().from(schema.users);
  if (existing.length > 0) return;

  await db.insert(schema.users).values([
    { id: "user_guilherme", name: "Guilherme", pin: "env-controlled" },
    { id: "user_maryane", name: "Maryane", pin: "env-controlled" },
  ]);
}

export async function getCheckingBalance() {
  const cutoff = ledgerBalanceCutoffDate();
  const result = await db
    .select({
      total: sql<number>`coalesce(sum(case when ${schema.accountEntries.referenceType} = 'purchase' and ${schema.accountEntries.occurredAt} > ${cutoff} then 0 else ${schema.accountEntries.amount} end), 0)`,
    })
    .from(schema.accountEntries);
  return result[0]?.total ?? 0;
}

export async function getPocketBalances() {
  const cutoff = ledgerBalanceCutoffDate();
  const rows = await db
    .select({
      id: schema.pockets.id,
      name: schema.pockets.name,
      description: schema.pockets.description,
      balance: sql<number>`coalesce(sum(case when ${schema.pocketEntries.referenceType} = 'purchase' and ${schema.pocketEntries.occurredAt} > ${cutoff} then 0 else ${schema.pocketEntries.amount} end), 0)`,
    })
    .from(schema.pockets)
    .leftJoin(schema.pocketEntries, eq(schema.pocketEntries.pocketId, schema.pockets.id))
    .groupBy(schema.pockets.id)
    .orderBy(asc(schema.pockets.name));

  return rows;
}

export async function getTotalBalance() {
  const [checking, pockets] = await Promise.all([getCheckingBalance(), getPocketBalances()]);
  const pocketTotal = pockets.reduce((acc, pocket) => acc + pocket.balance, 0);
  return checking + pocketTotal;
}

type DbExecutor = Pick<typeof db, "insert" | "delete" | "select" | "update">;

async function insertPurchaseWithLedger(executor: DbExecutor, input: PurchaseInput) {
  const installments = Math.max(1, input.installmentCount);
  const purchaseDate = parseLocalDateYmd(input.purchaseDate);

  const purchaseRows = Array.from({ length: installments }, (_, idx) => {
    const installmentDate = format(addMonths(purchaseDate, idx), "yyyy-MM-dd");
    return {
      id: crypto.randomUUID(),
      title: input.title,
      description: input.description,
      amount: Number((input.amount / installments).toFixed(2)),
      purchaseDate: installmentDate,
      categoryId: input.categoryId,
      createdByUserId: input.createdByUserId,
      paymentSourceType: input.paymentSourceType,
      paymentSourceId: input.paymentSourceId,
      installmentCount: installments,
      installmentNumber: idx + 1,
      recurringOriginId: input.recurringOriginId,
    };
  });

  await executor.insert(schema.purchases).values(purchaseRows);

  const firstPurchaseId = purchaseRows[0]?.id;
  if (!firstPurchaseId) return;

  if (input.tagIds.length > 0) {
    const tagRows = input.tagIds.map((tagId) => ({
      purchaseId: firstPurchaseId,
      tagId,
    }));
    await executor.insert(schema.purchaseTags).values(tagRows);
  }

  for (const row of purchaseRows) {
    if (row.paymentSourceType === "account") {
      await executor.insert(schema.accountEntries).values({
        id: crypto.randomUUID(),
        amount: -Math.abs(row.amount),
        entryType: "purchase",
        referenceType: "purchase",
        referenceId: row.id,
        createdByUserId: row.createdByUserId,
        occurredAt: row.purchaseDate,
      });
    }

    if (row.paymentSourceType === "pocket" && row.paymentSourceId) {
      await executor.insert(schema.pocketEntries).values({
        id: crypto.randomUUID(),
        pocketId: row.paymentSourceId,
        amount: -Math.abs(row.amount),
        entryType: "purchase",
        referenceType: "purchase",
        referenceId: row.id,
        createdByUserId: row.createdByUserId,
        occurredAt: row.purchaseDate,
      });
    }
  }
}

export async function createPurchase(input: PurchaseInput) {
  await insertPurchaseWithLedger(db, input);
}

export async function deletePurchaseGroup(purchaseId: string, userId: string): Promise<boolean> {
  const detail = await getPurchaseDetailById(purchaseId, userId);
  if (!detail) return false;
  const ids = detail.installments.map((i) => i.id);
  await db.transaction(async (tx) => {
    await tx.delete(schema.purchaseTags).where(inArray(schema.purchaseTags.purchaseId, ids));
    await tx.delete(schema.accountEntries).where(
      and(eq(schema.accountEntries.referenceType, "purchase"), inArray(schema.accountEntries.referenceId, ids))
    );
    await tx.delete(schema.pocketEntries).where(
      and(eq(schema.pocketEntries.referenceType, "purchase"), inArray(schema.pocketEntries.referenceId, ids))
    );
    await tx.delete(schema.purchases).where(inArray(schema.purchases.id, ids));
  });
  return true;
}

export async function updatePurchaseGroup(purchaseId: string, userId: string, input: PurchaseInput): Promise<boolean> {
  const detail = await getPurchaseDetailById(purchaseId, userId);
  if (!detail) return false;
  const ids = detail.installments.map((i) => i.id);
  await db.transaction(async (tx) => {
    await tx.delete(schema.purchaseTags).where(inArray(schema.purchaseTags.purchaseId, ids));
    await tx.delete(schema.accountEntries).where(
      and(eq(schema.accountEntries.referenceType, "purchase"), inArray(schema.accountEntries.referenceId, ids))
    );
    await tx.delete(schema.pocketEntries).where(
      and(eq(schema.pocketEntries.referenceType, "purchase"), inArray(schema.pocketEntries.referenceId, ids))
    );
    await tx.delete(schema.purchases).where(inArray(schema.purchases.id, ids));
    await insertPurchaseWithLedger(tx, input);
  });
  return true;
}

function assertValidDepositSplits(input: {
  amount: number;
  splits: DepositSplitInput[];
}) {
  if (input.splits.length === 0) {
    throw new Error("Informe pelo menos um destino.");
  }
  const sum = input.splits.reduce((a, s) => a + s.amount, 0);
  if (Math.abs(sum - input.amount) > DEPOSIT_SUM_EPS) {
    throw new Error("A soma das partes deve ser igual ao valor total do depósito.");
  }
  for (const s of input.splits) {
    if (s.targetType === "pocket" && !s.pocketId?.trim()) {
      throw new Error("Selecione a caixinha em cada parte que vai para caixinha.");
    }
  }
}

async function removeDepositLedgerEntries(executor: DbExecutor, depositId: string) {
  await executor.delete(schema.accountEntries).where(
    and(eq(schema.accountEntries.referenceType, "deposit"), eq(schema.accountEntries.referenceId, depositId)),
  );
  await executor.delete(schema.pocketEntries).where(
    and(eq(schema.pocketEntries.referenceType, "deposit"), eq(schema.pocketEntries.referenceId, depositId)),
  );
}

async function insertDepositSplitsAndLedger(
  executor: DbExecutor,
  depositId: string,
  input: { splits: DepositSplitInput[]; depositDate: string; createdByUserId: string },
) {
  for (let i = 0; i < input.splits.length; i++) {
    const s = input.splits[i]!;
    const amt = Math.abs(s.amount);
    await executor.insert(schema.depositSplits).values({
      id: crypto.randomUUID(),
      depositId,
      targetType: s.targetType,
      pocketId: s.targetType === "pocket" ? s.pocketId ?? null : null,
      amount: amt,
      sortOrder: i,
    });

    if (s.targetType === "account") {
      await executor.insert(schema.accountEntries).values({
        id: crypto.randomUUID(),
        amount: amt,
        entryType: "deposit",
        referenceType: "deposit",
        referenceId: depositId,
        createdByUserId: input.createdByUserId,
        occurredAt: input.depositDate,
      });
    } else if (s.pocketId) {
      await executor.insert(schema.pocketEntries).values({
        id: crypto.randomUUID(),
        pocketId: s.pocketId,
        amount: amt,
        entryType: "deposit",
        referenceType: "deposit",
        referenceId: depositId,
        createdByUserId: input.createdByUserId,
        occurredAt: input.depositDate,
      });
    }
  }
}

export async function createDeposit(input: {
  title: string;
  amount: number;
  depositDate: string;
  createdByUserId: string;
  recurringDepositId?: string;
  splits: DepositSplitInput[];
}) {
  assertValidDepositSplits(input);

  const depositId = crypto.randomUUID();
  const first = input.splits[0]!;
  await db.insert(schema.deposits).values({
    id: depositId,
    title: input.title,
    amount: input.amount,
    depositDate: input.depositDate,
    createdByUserId: input.createdByUserId,
    targetType: first.targetType,
    pocketId: first.targetType === "pocket" ? first.pocketId ?? null : null,
    recurringDepositId: input.recurringDepositId ?? null,
  });

  await insertDepositSplitsAndLedger(db, depositId, {
    splits: input.splits,
    depositDate: input.depositDate,
    createdByUserId: input.createdByUserId,
  });
}

export async function updateDeposit(
  depositId: string,
  input: {
    title: string;
    amount: number;
    depositDate: string;
    createdByUserId: string;
    splits: DepositSplitInput[];
  },
) {
  assertValidDepositSplits(input);

  const first = input.splits[0]!;
  await db.transaction(async (tx) => {
    await removeDepositLedgerEntries(tx, depositId);
    await tx.delete(schema.depositSplits).where(eq(schema.depositSplits.depositId, depositId));
    await tx
      .update(schema.deposits)
      .set({
        title: input.title,
        amount: input.amount,
        depositDate: input.depositDate,
        targetType: first.targetType,
        pocketId: first.targetType === "pocket" ? first.pocketId ?? null : null,
      })
      .where(eq(schema.deposits.id, depositId));
    await insertDepositSplitsAndLedger(tx, depositId, {
      splits: input.splits,
      depositDate: input.depositDate,
      createdByUserId: input.createdByUserId,
    });
  });
}

export async function deleteDeposit(depositId: string) {
  await db.transaction(async (tx) => {
    await removeDepositLedgerEntries(tx, depositId);
    await tx.delete(schema.deposits).where(eq(schema.deposits.id, depositId));
  });
}

export async function createTransfer(input: {
  fromType: "account" | "pocket";
  fromPocketId?: string;
  toType: "account" | "pocket";
  toPocketId?: string;
  amount: number;
  transferDate: string;
  createdByUserId: string;
}) {
  const transferId = crypto.randomUUID();
  const amount = Math.abs(input.amount);
  const base = {
    referenceType: "transfer" as const,
    referenceId: transferId,
    createdByUserId: input.createdByUserId,
    occurredAt: input.transferDate,
  };

  if (input.fromType === "account") {
    await db.insert(schema.accountEntries).values({
      id: crypto.randomUUID(),
      amount: -amount,
      entryType: "transfer_out",
      ...base,
    });
  } else if (input.fromPocketId) {
    await db.insert(schema.pocketEntries).values({
      id: crypto.randomUUID(),
      pocketId: input.fromPocketId,
      amount: -amount,
      entryType: "transfer_out",
      ...base,
    });
  }

  if (input.toType === "account") {
    await db.insert(schema.accountEntries).values({
      id: crypto.randomUUID(),
      amount,
      entryType: "transfer_in",
      ...base,
    });
  } else if (input.toPocketId) {
    await db.insert(schema.pocketEntries).values({
      id: crypto.randomUUID(),
      pocketId: input.toPocketId,
      amount,
      entryType: "transfer_in",
      ...base,
    });
  }
}

export async function runRecurringExpenses() {
  const today = format(new Date(), "yyyy-MM-dd");
  const recurringRows = await db
    .select()
    .from(schema.recurringExpenses)
    .where(and(eq(schema.recurringExpenses.isActive, true), lte(schema.recurringExpenses.nextExecutionDate, today)));

  const recurringIds = recurringRows.map((r) => r.id);
  const tagLinkRows =
    recurringIds.length > 0
      ? await db
          .select({
            recurringId: schema.recurringExpenseTags.recurringExpenseId,
            tagId: schema.recurringExpenseTags.tagId,
          })
          .from(schema.recurringExpenseTags)
          .where(inArray(schema.recurringExpenseTags.recurringExpenseId, recurringIds))
      : [];

  const tagIdsByRecurring = new Map<string, string[]>();
  for (const row of tagLinkRows) {
    const list = tagIdsByRecurring.get(row.recurringId) ?? [];
    list.push(row.tagId);
    tagIdsByRecurring.set(row.recurringId, list);
  }

  for (const recurring of recurringRows) {
    await createPurchase({
      title: recurring.title,
      amount: recurring.amount,
      purchaseDate: recurring.nextExecutionDate,
      createdByUserId: recurring.createdByUserId,
      paymentSourceType: recurring.paymentSourceType,
      paymentSourceId: recurring.paymentSourceId ?? undefined,
      categoryId: recurring.categoryId ?? undefined,
      installmentCount: 1,
      recurringOriginId: recurring.id,
      tagIds: tagIdsByRecurring.get(recurring.id) ?? [],
    });

    await db
      .update(schema.recurringExpenses)
      .set({
        nextExecutionDate: format(addMonths(parseLocalDateYmd(recurring.nextExecutionDate), 1), "yyyy-MM-dd"),
      })
      .where(eq(schema.recurringExpenses.id, recurring.id));
  }

  return recurringRows.length;
}

export async function runRecurringDeposits() {
  const today = format(new Date(), "yyyy-MM-dd");
  const rows = await db
    .select()
    .from(schema.recurringDeposits)
    .where(and(eq(schema.recurringDeposits.isActive, true), lte(schema.recurringDeposits.nextExecutionDate, today)));

  for (const r of rows) {
    const splitRows = await db
      .select()
      .from(schema.recurringDepositSplits)
      .where(eq(schema.recurringDepositSplits.recurringDepositId, r.id))
      .orderBy(asc(schema.recurringDepositSplits.sortOrder));

    let splits: DepositSplitInput[];
    if (splitRows.length > 0) {
      const percents = splitRows.map((s) => s.percent);
      const amounts = distributeAmountsByPercent(r.amount, percents);
      splits = splitRows.map((s, i) => ({
        targetType: s.targetType as "account" | "pocket",
        pocketId: s.pocketId,
        amount: amounts[i] ?? 0,
      }));
    } else {
      splits = [
        {
          targetType: (r.targetType as "account" | "pocket") ?? "account",
          pocketId: r.pocketId,
          amount: r.amount,
        },
      ];
    }

    await createDeposit({
      title: r.title,
      amount: r.amount,
      depositDate: r.nextExecutionDate,
      createdByUserId: r.createdByUserId,
      recurringDepositId: r.id,
      splits,
    });
    await db
      .update(schema.recurringDeposits)
      .set({
        nextExecutionDate: format(addMonths(parseLocalDateYmd(r.nextExecutionDate), 1), "yyyy-MM-dd"),
      })
      .where(eq(schema.recurringDeposits.id, r.id));
  }

  return rows.length;
}

export async function createBalanceAdjustment(input: {
  targetType: "account" | "pocket";
  targetId?: string;
  amount: number;
  reason: string;
  adjustmentDate: string;
  createdByUserId: string;
}) {
  const adjustmentId = crypto.randomUUID();
  await db.insert(schema.balanceAdjustments).values({
    id: adjustmentId,
    targetType: input.targetType,
    targetId: input.targetId,
    amount: input.amount,
    reason: input.reason,
    adjustmentDate: input.adjustmentDate,
    createdByUserId: input.createdByUserId,
  });

  if (input.targetType === "account") {
    await db.insert(schema.accountEntries).values({
      id: crypto.randomUUID(),
      amount: input.amount,
      entryType: "adjustment",
      referenceType: "balance_adjustment",
      referenceId: adjustmentId,
      createdByUserId: input.createdByUserId,
      occurredAt: input.adjustmentDate,
    });
    return;
  }

  if (!input.targetId) return;
  await db.insert(schema.pocketEntries).values({
    id: crypto.randomUUID(),
    pocketId: input.targetId,
    amount: input.amount,
    entryType: "adjustment",
    referenceType: "balance_adjustment",
    referenceId: adjustmentId,
    createdByUserId: input.createdByUserId,
    occurredAt: input.adjustmentDate,
  });
}

export async function getPurchases(filters: {
  categoryId?: string;
  tagId?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
}) {
  const conditions = [];
  if (filters.categoryId) conditions.push(eq(schema.purchases.categoryId, filters.categoryId));
  if (filters.userId) conditions.push(eq(schema.purchases.createdByUserId, filters.userId));
  if (filters.startDate) conditions.push(gte(schema.purchases.purchaseDate, filters.startDate));
  if (filters.endDate) conditions.push(lte(schema.purchases.purchaseDate, filters.endDate));

  const purchaseRows = await db
    .select({
      id: schema.purchases.id,
      title: schema.purchases.title,
      description: schema.purchases.description,
      amount: schema.purchases.amount,
      purchaseDate: schema.purchases.purchaseDate,
      categoryId: schema.purchases.categoryId,
      categoryName: schema.categories.name,
      createdByUserId: schema.purchases.createdByUserId,
      userName: schema.users.name,
      paymentSourceType: schema.purchases.paymentSourceType,
      paymentSourceId: schema.purchases.paymentSourceId,
      installmentCount: schema.purchases.installmentCount,
      installmentNumber: schema.purchases.installmentNumber,
    })
    .from(schema.purchases)
    .leftJoin(schema.categories, eq(schema.categories.id, schema.purchases.categoryId))
    .leftJoin(schema.users, eq(schema.users.id, schema.purchases.createdByUserId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(schema.purchases.purchaseDate));

  const ids = purchaseRows.map((row) => row.id);
  const tagRows =
    ids.length === 0
      ? []
      : await db
          .select({
            purchaseId: schema.purchaseTags.purchaseId,
            tagId: schema.purchaseTags.tagId,
            tagName: schema.tags.name,
          })
          .from(schema.purchaseTags)
          .innerJoin(schema.tags, eq(schema.tags.id, schema.purchaseTags.tagId))
          .where(inArray(schema.purchaseTags.purchaseId, ids));

  const tagMap = new Map<string, string[]>();
  const tagIdMap = new Map<string, string[]>();
  for (const row of tagRows) {
    const current = tagMap.get(row.purchaseId) ?? [];
    current.push(row.tagName);
    tagMap.set(row.purchaseId, current);

    const currentIds = tagIdMap.get(row.purchaseId) ?? [];
    currentIds.push(row.tagId);
    tagIdMap.set(row.purchaseId, currentIds);
  }

  const merged = purchaseRows.map((row) => ({ ...row, tags: tagMap.get(row.id) ?? [], tagIds: tagIdMap.get(row.id) ?? [] }));
  if (!filters.tagId) return merged;
  return merged.filter((row) => row.tagIds.includes(filters.tagId as string));
}

export async function getDashboardData() {
  const [checkingBalance, pocketBalances, totalBalance] = await Promise.all([
    getCheckingBalance(),
    getPocketBalances(),
    getTotalBalance(),
  ]);

  const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const monthly = await db
    .select({ total: sql<number>`coalesce(sum(${schema.purchases.amount}), 0)` })
    .from(schema.purchases)
    .where(gte(schema.purchases.purchaseDate, monthStart));

  const expensesByCategory = await db
    .select({
      name: schema.categories.name,
      total: sql<number>`coalesce(sum(${schema.purchases.amount}), 0)`,
    })
    .from(schema.purchases)
    .leftJoin(schema.categories, eq(schema.categories.id, schema.purchases.categoryId))
    .groupBy(schema.categories.name)
    .orderBy(desc(sql`coalesce(sum(${schema.purchases.amount}), 0)`))
    .limit(8);

  const biggestExpenses = await db
    .select({
      title: schema.purchases.title,
      amount: schema.purchases.amount,
      purchaseDate: schema.purchases.purchaseDate,
    })
    .from(schema.purchases)
    .orderBy(desc(schema.purchases.amount))
    .limit(5);

  const upcomingInstallments = await db
    .select({
      title: schema.purchases.title,
      amount: schema.purchases.amount,
      installmentNumber: schema.purchases.installmentNumber,
      installmentCount: schema.purchases.installmentCount,
      purchaseDate: schema.purchases.purchaseDate,
      cardName: schema.cards.name,
    })
    .from(schema.purchases)
    .leftJoin(schema.cards, eq(schema.cards.id, schema.purchases.paymentSourceId))
    .where(eq(schema.purchases.paymentSourceType, "card"))
    .orderBy(asc(schema.purchases.purchaseDate))
    .limit(8);

  const upcomingRecurring = await db
    .select({
      title: schema.recurringExpenses.title,
      amount: schema.recurringExpenses.amount,
      nextExecutionDate: schema.recurringExpenses.nextExecutionDate,
    })
    .from(schema.recurringExpenses)
    .where(eq(schema.recurringExpenses.isActive, true))
    .orderBy(asc(schema.recurringExpenses.nextExecutionDate))
    .limit(8);

  const upcomingRecurringDepositRows = await db
    .select({
      id: schema.recurringDeposits.id,
      title: schema.recurringDeposits.title,
      amount: schema.recurringDeposits.amount,
      nextExecutionDate: schema.recurringDeposits.nextExecutionDate,
    })
    .from(schema.recurringDeposits)
    .where(eq(schema.recurringDeposits.isActive, true))
    .orderBy(asc(schema.recurringDeposits.nextExecutionDate))
    .limit(8);

  const urdIds = upcomingRecurringDepositRows.map((r) => r.id);
  const urdSplitRows =
    urdIds.length > 0
      ? await db
          .select({
            recurringDepositId: schema.recurringDepositSplits.recurringDepositId,
            targetType: schema.recurringDepositSplits.targetType,
            percent: schema.recurringDepositSplits.percent,
            pocketName: schema.pockets.name,
          })
          .from(schema.recurringDepositSplits)
          .leftJoin(schema.pockets, eq(schema.pockets.id, schema.recurringDepositSplits.pocketId))
          .where(inArray(schema.recurringDepositSplits.recurringDepositId, urdIds))
          .orderBy(asc(schema.recurringDepositSplits.sortOrder))
      : [];

  const urdSplitsMap = new Map<string, typeof urdSplitRows>();
  for (const row of urdSplitRows) {
    const list = urdSplitsMap.get(row.recurringDepositId) ?? [];
    list.push(row);
    urdSplitsMap.set(row.recurringDepositId, list);
  }

  const upcomingRecurringDeposits = upcomingRecurringDepositRows.map((row) => {
    const parts = urdSplitsMap.get(row.id);
    const destinationSummary =
      parts && parts.length > 0
        ? parts
            .map((p) =>
              p.targetType === "account"
                ? `Conta ${Number(p.percent).toFixed(0)}%`
                : `Caixinha ${p.pocketName ?? "?"} ${Number(p.percent).toFixed(0)}%`
            )
            .join(" · ")
        : "Conta 100%";
    return {
      title: row.title,
      amount: row.amount,
      nextExecutionDate: row.nextExecutionDate,
      destinationSummary,
    };
  });

  const cardUsage = await db
    .select({
      cardId: schema.cards.id,
      cardName: schema.cards.name,
      creditLimit: schema.cards.creditLimit,
      used: sql<number>`coalesce(sum(${schema.purchases.amount}), 0)`,
    })
    .from(schema.cards)
    .leftJoin(
      schema.purchases,
      and(eq(schema.purchases.paymentSourceType, "card"), eq(schema.purchases.paymentSourceId, schema.cards.id)),
    )
    .groupBy(schema.cards.id);

  return {
    totalBalance,
    checkingBalance,
    pocketBalances,
    monthlyExpenses: monthly[0]?.total ?? 0,
    expensesByCategory: expensesByCategory.map((x) => ({ name: x.name ?? "Uncategorized", total: x.total })),
    balanceEvolution: await buildBalanceEvolution(),
    biggestExpenses,
    upcomingInstallments,
    upcomingRecurring,
    upcomingRecurringDeposits,
    cardUsage,
  };
}

async function buildBalanceEvolution() {
  const cutoff = ledgerBalanceCutoffDate();
  const accountRows = await db
    .select({ date: schema.accountEntries.occurredAt, amount: schema.accountEntries.amount })
    .from(schema.accountEntries)
    .where(
      or(ne(schema.accountEntries.referenceType, "purchase"), lte(schema.accountEntries.occurredAt, cutoff)),
    )
    .orderBy(asc(schema.accountEntries.occurredAt));

  const map = new Map<string, number>();
  for (const row of accountRows) {
    const previous = map.get(row.date) ?? 0;
    map.set(row.date, previous + row.amount);
  }

  const sorted = Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  let running = 0;
  return sorted.map(([date, change]) => {
    running += change;
    return { date, balance: running };
  });
}

export type MonthMovement = {
  id: string;
  type: "in" | "out" | "future_out" | "future_in";
  date: string;
  title: string;
  amount: number;
  category?: string | null;
  source?: string | null;
  sourceType?: "account" | "pocket" | "card";
  sourceId?: string | null;
  extra?: string | null;
  /** Present for movements generated from a purchase row (opens detail dialog). */
  purchaseId?: string;
  installmentNumber?: number;
  installmentCount?: number;
  /** yyyy-MM — mês da fatura do cartão (quando aplicável). */
  statementMonth?: string;
  /** Data prevista de vencimento da fatura (cartão). */
  dueDate?: string | null;
};

/** Mês de referência da fatura: compras no dia de fechamento em diante vão para o mês seguinte. */
export function cardStatementMonth(purchaseDate: string, closingDay: number): string {
  const d = parseLocalDateYmd(purchaseDate);
  const day = getDate(d);
  const anchor = day >= closingDay ? addMonths(d, 1) : d;
  return format(startOfMonth(anchor), "yyyy-MM");
}

/** Vencimento no dia `dueDay` do mesmo mês de referência da fatura (não no mês seguinte). */
export function cardDueDateForStatement(statementMonthYm: string, dueDay: number): string {
  const [y, m] = statementMonthYm.split("-").map(Number);
  if (!y || !m) return "";
  const statementStart = new Date(y, m - 1, 1);
  const lastDay = endOfMonth(statementStart).getDate();
  const day = Math.min(Math.max(1, dueDay), lastDay);
  return format(new Date(y, m - 1, day), "yyyy-MM-dd");
}

export type SourceSummary = {
  account?: { balance: number; outflows: number; sufficient: boolean };
  pockets: Array<{ id: string; name: string; balance: number; outflows: number; sufficient: boolean }>;
  cards: Array<{ id: string; name: string; creditLimit: number; used: number; outflows: number; sufficient: boolean }>;
};

export async function getMonthMovements(month: string): Promise<MonthMovement[]> {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return [];
  const targetYm = `${y}-${String(m).padStart(2, "0")}`;
  const start = format(startOfMonth(new Date(y, m - 1)), "yyyy-MM-dd");
  const end = format(endOfMonth(new Date(y, m - 1)), "yyyy-MM-dd");
  const today = format(new Date(), "yyyy-MM-dd");
  const movements: MonthMovement[] = [];

  const depositsInMonth = await db
    .select({
      id: schema.deposits.id,
      title: schema.deposits.title,
      amount: schema.deposits.amount,
      depositDate: schema.deposits.depositDate,
      recurringDepositId: schema.deposits.recurringDepositId,
    })
    .from(schema.deposits)
    .where(and(gte(schema.deposits.depositDate, start), lte(schema.deposits.depositDate, end)));

  const depositIds = depositsInMonth.map((d) => d.id);
  const splitRowsForMonth =
    depositIds.length > 0
      ? await db
          .select({
            depositId: schema.depositSplits.depositId,
            targetType: schema.depositSplits.targetType,
            amount: schema.depositSplits.amount,
            pocketName: schema.pockets.name,
          })
          .from(schema.depositSplits)
          .leftJoin(schema.pockets, eq(schema.pockets.id, schema.depositSplits.pocketId))
          .where(inArray(schema.depositSplits.depositId, depositIds))
          .orderBy(asc(schema.depositSplits.sortOrder))
      : [];

  const splitsByDeposit = new Map<string, typeof splitRowsForMonth>();
  for (const row of splitRowsForMonth) {
    const list = splitsByDeposit.get(row.depositId) ?? [];
    list.push(row);
    splitsByDeposit.set(row.depositId, list);
  }

  for (const d of depositsInMonth) {
    const parts = splitsByDeposit.get(d.id);
    const source =
      parts && parts.length > 0
        ? parts
            .map((p) =>
              p.targetType === "account"
                ? `Conta ${formatCurrency(p.amount)}`
                : `Caixinha ${p.pocketName ?? "?"} ${formatCurrency(p.amount)}`
            )
            .join(" · ")
        : "Conta corrente";
    movements.push({
      id: `deposit-${d.id}`,
      type: "in",
      date: d.depositDate,
      title: d.title,
      amount: d.amount,
      source,
      extra: parts && parts.length > 1 ? "Depósito (dividido)" : "Depósito",
    });
  }

  const realizedRecurringDepositIds = new Set(
    depositsInMonth.map((d) => d.recurringDepositId).filter((x): x is string => Boolean(x)),
  );

  const recurringDepositsDueInMonth = await db
    .select({
      id: schema.recurringDeposits.id,
      title: schema.recurringDeposits.title,
      amount: schema.recurringDeposits.amount,
      nextExecutionDate: schema.recurringDeposits.nextExecutionDate,
      targetType: schema.recurringDeposits.targetType,
      pocketId: schema.recurringDeposits.pocketId,
      pocketName: schema.pockets.name,
    })
    .from(schema.recurringDeposits)
    .leftJoin(schema.pockets, eq(schema.pockets.id, schema.recurringDeposits.pocketId))
    .where(
      and(
        eq(schema.recurringDeposits.isActive, true),
        gte(schema.recurringDeposits.nextExecutionDate, start),
        lte(schema.recurringDeposits.nextExecutionDate, end),
      ),
    );

  const futureRecurringDepositIds = recurringDepositsDueInMonth
    .map((r) => r.id)
    .filter((id) => !realizedRecurringDepositIds.has(id));

  const recurringDepositSplitRows =
    futureRecurringDepositIds.length > 0
      ? await db
          .select({
            recurringDepositId: schema.recurringDepositSplits.recurringDepositId,
            targetType: schema.recurringDepositSplits.targetType,
            percent: schema.recurringDepositSplits.percent,
            pocketName: schema.pockets.name,
          })
          .from(schema.recurringDepositSplits)
          .leftJoin(schema.pockets, eq(schema.pockets.id, schema.recurringDepositSplits.pocketId))
          .where(inArray(schema.recurringDepositSplits.recurringDepositId, futureRecurringDepositIds))
          .orderBy(asc(schema.recurringDepositSplits.sortOrder))
      : [];

  const splitsByRecurringDeposit = new Map<string, typeof recurringDepositSplitRows>();
  for (const row of recurringDepositSplitRows) {
    const list = splitsByRecurringDeposit.get(row.recurringDepositId) ?? [];
    list.push(row);
    splitsByRecurringDeposit.set(row.recurringDepositId, list);
  }

  for (const r of recurringDepositsDueInMonth) {
    if (realizedRecurringDepositIds.has(r.id)) continue;
    const splitParts = splitsByRecurringDeposit.get(r.id);
    let source: string;
    if (splitParts && splitParts.length > 0) {
      const amounts = distributeAmountsByPercent(
        r.amount,
        splitParts.map((p) => p.percent),
      );
      source = amounts
        .map((amt, i) => {
          const p = splitParts[i];
          if (!p) return "";
          return p.targetType === "account"
            ? `Conta ${formatCurrency(amt)}`
            : `Caixinha ${p.pocketName ?? "?"} ${formatCurrency(amt)}`;
        })
        .filter(Boolean)
        .join(" · ");
    } else {
      const tt = r.targetType ?? "account";
      if (tt === "pocket" && r.pocketName) {
        source = `Caixinha ${r.pocketName} ${formatCurrency(r.amount)}`;
      } else if (tt === "pocket") {
        source = "Caixinha";
      } else {
        source = "Conta corrente";
      }
    }
    movements.push({
      id: `future-deposit-${r.id}`,
      type: "future_in",
      date: r.nextExecutionDate,
      title: r.title,
      amount: Math.abs(r.amount),
      source,
      extra: "Depósito recorrente (previsto)",
    });
  }

  const accountEntriesIn = await db
    .select({
      id: schema.accountEntries.id,
      amount: schema.accountEntries.amount,
      occurredAt: schema.accountEntries.occurredAt,
      referenceType: schema.accountEntries.referenceType,
      referenceId: schema.accountEntries.referenceId,
    })
    .from(schema.accountEntries)
    .where(and(gte(schema.accountEntries.occurredAt, start), lte(schema.accountEntries.occurredAt, end), sql`${schema.accountEntries.amount} > 0`));
  for (const e of accountEntriesIn) {
    if (e.referenceType === "transfer") {
      movements.push({
        id: `transfer-in-${e.id}`,
        type: "in",
        date: e.occurredAt,
        title: "Transferência recebida",
        amount: e.amount,
        source: "Conta corrente",
        extra: "Transferência",
      });
    }
    if (e.referenceType === "balance_adjustment") {
      const adj = await db
        .select({ reason: schema.balanceAdjustments.reason })
        .from(schema.balanceAdjustments)
        .where(eq(schema.balanceAdjustments.id, e.referenceId))
        .limit(1);
      movements.push({
        id: `adjustment-in-${e.id}`,
        type: "in",
        date: e.occurredAt,
        title: adj[0]?.reason ?? "Ajuste",
        amount: e.amount,
        source: "Conta corrente",
        extra: "Ajuste",
      });
    }
  }

  const purchaseFields = {
    id: schema.purchases.id,
    title: schema.purchases.title,
    amount: schema.purchases.amount,
    purchaseDate: schema.purchases.purchaseDate,
    paymentSourceType: schema.purchases.paymentSourceType,
    paymentSourceId: schema.purchases.paymentSourceId,
    installmentNumber: schema.purchases.installmentNumber,
    installmentCount: schema.purchases.installmentCount,
    categoryName: schema.categories.name,
    pocketName: schema.pockets.name,
    cardName: schema.cards.name,
    closingDay: schema.cards.closingDay,
    dueDay: schema.cards.dueDay,
  };

  const nonCardPurchases = await db
    .select(purchaseFields)
    .from(schema.purchases)
    .leftJoin(schema.categories, eq(schema.categories.id, schema.purchases.categoryId))
    .leftJoin(schema.pockets, eq(schema.pockets.id, schema.purchases.paymentSourceId))
    .leftJoin(schema.cards, eq(schema.cards.id, schema.purchases.paymentSourceId))
    .where(
      and(
        ne(schema.purchases.paymentSourceType, "card"),
        gte(schema.purchases.purchaseDate, start),
        lte(schema.purchases.purchaseDate, end)
      )
    );

  const cardPurchasesAll = await db
    .select(purchaseFields)
    .from(schema.purchases)
    .leftJoin(schema.categories, eq(schema.categories.id, schema.purchases.categoryId))
    .leftJoin(schema.pockets, eq(schema.pockets.id, schema.purchases.paymentSourceId))
    .leftJoin(schema.cards, eq(schema.cards.id, schema.purchases.paymentSourceId))
    .where(eq(schema.purchases.paymentSourceType, "card"));

  const cardPurchasesInMonth = cardPurchasesAll.filter(
    (p) => p.closingDay != null && cardStatementMonth(p.purchaseDate, p.closingDay) === targetYm
  );

  for (const p of [...nonCardPurchases, ...cardPurchasesInMonth]) {
    let source = "Conta corrente";
    if (p.paymentSourceType === "pocket" && p.pocketName) source = `Caixinha ${p.pocketName}`;
    if (p.paymentSourceType === "card" && p.cardName) source = `Cartão ${p.cardName}`;
    const extra = (p.installmentCount ?? 0) > 1 ? `${p.installmentNumber}/${p.installmentCount} parcelas` : null;
    let statementMonth: string | undefined;
    let dueDate: string | null | undefined;
    if (p.paymentSourceType === "card" && p.closingDay != null && p.dueDay != null) {
      statementMonth = cardStatementMonth(p.purchaseDate, p.closingDay);
      dueDate = cardDueDateForStatement(statementMonth, p.dueDay);
    }
    movements.push({
      id: `purchase-${p.id}`,
      type: "out",
      date: p.purchaseDate,
      title: p.title,
      amount: -Math.abs(p.amount),
      category: p.categoryName ?? null,
      source,
      sourceType: p.paymentSourceType as "account" | "pocket" | "card",
      sourceId: p.paymentSourceId ?? null,
      extra: extra ?? undefined,
      purchaseId: p.id,
      installmentNumber: p.installmentNumber,
      installmentCount: p.installmentCount,
      statementMonth,
      dueDate: dueDate ?? null,
    });
  }

  const accountEntriesOut = await db
    .select({
      id: schema.accountEntries.id,
      amount: schema.accountEntries.amount,
      occurredAt: schema.accountEntries.occurredAt,
      referenceType: schema.accountEntries.referenceType,
      referenceId: schema.accountEntries.referenceId,
    })
    .from(schema.accountEntries)
    .where(
      and(
        gte(schema.accountEntries.occurredAt, start),
        lte(schema.accountEntries.occurredAt, end),
        sql`${schema.accountEntries.amount} < 0`,
        ne(schema.accountEntries.referenceType, "purchase")
      )
    );
  for (const e of accountEntriesOut) {
    if (e.referenceType === "transfer") {
      movements.push({
        id: `transfer-out-${e.id}`,
        type: "out",
        date: e.occurredAt,
        title: "Transferência",
        amount: e.amount,
        source: "Conta corrente",
        sourceType: "account",
        sourceId: null,
        extra: "Saída",
      });
    }
    if (e.referenceType === "balance_adjustment") {
      const adj = await db
        .select({ reason: schema.balanceAdjustments.reason })
        .from(schema.balanceAdjustments)
        .where(eq(schema.balanceAdjustments.id, e.referenceId))
        .limit(1);
      movements.push({
        id: `adjustment-${e.id}`,
        type: "out",
        date: e.occurredAt,
        title: adj[0]?.reason ?? "Ajuste",
        amount: e.amount,
        source: "Conta corrente",
        sourceType: "account",
        sourceId: null,
        extra: "Ajuste",
      });
    }
  }

  const futureRecurring = await db
    .select({
      id: schema.recurringExpenses.id,
      title: schema.recurringExpenses.title,
      amount: schema.recurringExpenses.amount,
      nextExecutionDate: schema.recurringExpenses.nextExecutionDate,
      paymentSourceType: schema.recurringExpenses.paymentSourceType,
      paymentSourceId: schema.recurringExpenses.paymentSourceId,
      pocketName: schema.pockets.name,
      cardName: schema.cards.name,
      closingDay: schema.cards.closingDay,
      dueDay: schema.cards.dueDay,
    })
    .from(schema.recurringExpenses)
    .leftJoin(schema.pockets, eq(schema.pockets.id, schema.recurringExpenses.paymentSourceId))
    .leftJoin(schema.cards, eq(schema.cards.id, schema.recurringExpenses.paymentSourceId))
    .where(and(eq(schema.recurringExpenses.isActive, true), gt(schema.recurringExpenses.nextExecutionDate, today)));
  for (const r of futureRecurring) {
    const d = r.nextExecutionDate;
    if (r.paymentSourceType === "card" && r.closingDay != null) {
      if (cardStatementMonth(d, r.closingDay) !== targetYm) continue;
    } else if (d < start || d > end) {
      continue;
    }
    let source = "Conta corrente";
    if (r.paymentSourceType === "pocket" && r.pocketName) source = `Caixinha ${r.pocketName}`;
    if (r.paymentSourceType === "card" && r.cardName) source = `Cartão ${r.cardName}`;
    let statementMonth: string | undefined;
    let dueDate: string | null | undefined;
    if (r.paymentSourceType === "card" && r.closingDay != null && r.dueDay != null) {
      statementMonth = cardStatementMonth(d, r.closingDay);
      dueDate = cardDueDateForStatement(statementMonth, r.dueDay);
    }
    movements.push({
      id: `future-${r.id}`,
      type: "future_out",
      date: r.nextExecutionDate,
      title: r.title,
      amount: -Math.abs(r.amount),
      source,
      sourceType: r.paymentSourceType as "account" | "pocket" | "card",
      sourceId: r.paymentSourceId ?? null,
      extra: "Recorrente (previsto)",
      statementMonth,
      dueDate: dueDate ?? null,
    });
  }

  movements.sort((a, b) => {
    const dateCmp = a.date.localeCompare(b.date);
    if (dateCmp !== 0) return dateCmp;
    const order = { in: 0, future_in: 1, out: 2, future_out: 3 };
    return order[a.type] - order[b.type];
  });
  return movements;
}

export function computeSourcesSummary(
  movements: MonthMovement[],
  ctx: {
    checkingBalance: number;
    pocketBalances: Array<{ id: string; name: string; balance: number }>;
    cardUsage: Array<{ cardId: string; cardName: string; creditLimit: number; used: number }>;
  }
): SourceSummary {
  const outflows = movements.filter((x) => x.type === "out" || x.type === "future_out");
  let accountOutflows = 0;
  const pocketOutflows = new Map<string, number>();
  const cardOutflows = new Map<string, number>();

  for (const o of outflows) {
    const amount = Math.abs(o.amount);
    if (o.sourceType === "account" || !o.sourceType) {
      accountOutflows += amount;
    } else if (o.sourceType === "pocket" && o.sourceId) {
      pocketOutflows.set(o.sourceId, (pocketOutflows.get(o.sourceId) ?? 0) + amount);
    } else if (o.sourceType === "card" && o.sourceId) {
      cardOutflows.set(o.sourceId, (cardOutflows.get(o.sourceId) ?? 0) + amount);
    }
  }

  const summary: SourceSummary = { pockets: [], cards: [] };

  if (accountOutflows > 0) {
    summary.account = {
      balance: ctx.checkingBalance,
      outflows: accountOutflows,
      sufficient: ctx.checkingBalance >= accountOutflows,
    };
  }

  for (const p of ctx.pocketBalances) {
    const out = pocketOutflows.get(p.id) ?? 0;
    if (out > 0) {
      summary.pockets.push({
        id: p.id,
        name: p.name,
        balance: p.balance,
        outflows: out,
        sufficient: p.balance >= out,
      });
    }
  }

  for (const c of ctx.cardUsage) {
    const out = cardOutflows.get(c.cardId) ?? 0;
    if (out > 0) {
      const available = c.creditLimit - c.used;
      summary.cards.push({
        id: c.cardId,
        name: c.cardName,
        creditLimit: c.creditLimit,
        used: c.used,
        outflows: out,
        /**
         * `used` no sistema já soma todas as compras no cartão (incluindo o mês).
         * Limite disponível = L - used já está "depois" dessas compras.
         * Não usar `available >= out` (subtrai o mês duas vezes). Basta não estourar o limite.
         */
        sufficient: available >= 0,
      });
    }
  }

  return summary;
}

export type PurchaseDetailInstallment = {
  id: string;
  purchaseDate: string;
  amount: number;
  installmentNumber: number;
  installmentCount: number;
  statementMonth: string | null;
  dueDate: string | null;
};

export async function getPurchaseDetailById(purchaseId: string, userId: string) {
  const row = await db
    .select({
      id: schema.purchases.id,
      title: schema.purchases.title,
      description: schema.purchases.description,
      amount: schema.purchases.amount,
      purchaseDate: schema.purchases.purchaseDate,
      categoryId: schema.purchases.categoryId,
      categoryName: schema.categories.name,
      paymentSourceType: schema.purchases.paymentSourceType,
      paymentSourceId: schema.purchases.paymentSourceId,
      installmentNumber: schema.purchases.installmentNumber,
      installmentCount: schema.purchases.installmentCount,
      createdByUserId: schema.purchases.createdByUserId,
      cardName: schema.cards.name,
      pocketName: schema.pockets.name,
      closingDay: schema.cards.closingDay,
      dueDay: schema.cards.dueDay,
    })
    .from(schema.purchases)
    .leftJoin(schema.categories, eq(schema.categories.id, schema.purchases.categoryId))
    .leftJoin(schema.cards, eq(schema.cards.id, schema.purchases.paymentSourceId))
    .leftJoin(schema.pockets, eq(schema.pockets.id, schema.purchases.paymentSourceId))
    .where(eq(schema.purchases.id, purchaseId))
    .limit(1);

  const main = row[0];
  if (!main || main.createdByUserId !== userId) return null;

  const siblingWhere = and(
    eq(schema.purchases.title, main.title),
    eq(schema.purchases.paymentSourceType, main.paymentSourceType),
    eq(schema.purchases.installmentCount, main.installmentCount),
    eq(schema.purchases.createdByUserId, main.createdByUserId),
    main.paymentSourceId ? eq(schema.purchases.paymentSourceId, main.paymentSourceId) : isNull(schema.purchases.paymentSourceId)
  );

  const siblings = await db
    .select({
      id: schema.purchases.id,
      purchaseDate: schema.purchases.purchaseDate,
      amount: schema.purchases.amount,
      installmentNumber: schema.purchases.installmentNumber,
      installmentCount: schema.purchases.installmentCount,
    })
    .from(schema.purchases)
    .where(siblingWhere)
    .orderBy(asc(schema.purchases.installmentNumber));

  const totalAmount = siblings.reduce((sum, s) => sum + s.amount, 0);
  const firstPurchaseIdForTags = siblings[0]?.id;
  const tagRows =
    firstPurchaseIdForTags === undefined
      ? []
      : await db
          .select({ tagId: schema.purchaseTags.tagId })
          .from(schema.purchaseTags)
          .where(eq(schema.purchaseTags.purchaseId, firstPurchaseIdForTags));
  const tagIds = tagRows.map((r) => r.tagId);

  const installments: PurchaseDetailInstallment[] = siblings.map((s) => {
    let statementMonth: string | null = null;
    let dueDate: string | null = null;
    if (main.paymentSourceType === "card" && main.closingDay != null && main.dueDay != null) {
      statementMonth = cardStatementMonth(s.purchaseDate, main.closingDay);
      dueDate = cardDueDateForStatement(statementMonth, main.dueDay);
    }
    return {
      id: s.id,
      purchaseDate: s.purchaseDate,
      amount: s.amount,
      installmentNumber: s.installmentNumber,
      installmentCount: s.installmentCount,
      statementMonth,
      dueDate,
    };
  });

  return {
    id: main.id,
    title: main.title,
    description: main.description,
    categoryId: main.categoryId ?? null,
    categoryName: main.categoryName,
    paymentSourceType: main.paymentSourceType,
    paymentSourceId: main.paymentSourceId,
    cardName: main.cardName,
    pocketName: main.pocketName,
    closingDay: main.closingDay,
    dueDay: main.dueDay,
    totalAmount,
    firstPurchaseDate: siblings[0]?.purchaseDate ?? main.purchaseDate,
    tagIds,
    installments,
  };
}
