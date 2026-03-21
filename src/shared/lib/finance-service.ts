import { and, asc, desc, eq, gt, gte, inArray, lte, ne, sql } from "drizzle-orm";
import { addMonths, endOfMonth, format, startOfMonth } from "date-fns";

import { db, schema } from "@/db";
import type { PaymentSourceType } from "@/shared/types/domain";

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
  const result = await db.select({ total: sql<number>`coalesce(sum(${schema.accountEntries.amount}), 0)` }).from(schema.accountEntries);
  return result[0]?.total ?? 0;
}

export async function getPocketBalances() {
  const rows = await db
    .select({
      id: schema.pockets.id,
      name: schema.pockets.name,
      description: schema.pockets.description,
      balance: sql<number>`coalesce(sum(${schema.pocketEntries.amount}), 0)`,
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

export async function createPurchase(input: PurchaseInput) {
  const installments = Math.max(1, input.installmentCount);
  const purchaseDate = new Date(input.purchaseDate);

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

  await db.insert(schema.purchases).values(purchaseRows);

  const firstPurchaseId = purchaseRows[0]?.id;
  if (!firstPurchaseId) return;

  if (input.tagIds.length > 0) {
    const tagRows = input.tagIds.map((tagId) => ({
      purchaseId: firstPurchaseId,
      tagId,
    }));
    await db.insert(schema.purchaseTags).values(tagRows);
  }

  for (const row of purchaseRows) {
    if (row.paymentSourceType === "account") {
      await db.insert(schema.accountEntries).values({
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
      await db.insert(schema.pocketEntries).values({
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

export async function createDeposit(input: {
  title: string;
  amount: number;
  depositDate: string;
  createdByUserId: string;
}) {
  const depositId = crypto.randomUUID();
  await db.insert(schema.deposits).values({
    id: depositId,
    title: input.title,
    amount: input.amount,
    depositDate: input.depositDate,
    createdByUserId: input.createdByUserId,
  });

  await db.insert(schema.accountEntries).values({
    id: crypto.randomUUID(),
    amount: Math.abs(input.amount),
    entryType: "deposit",
    referenceType: "deposit",
    referenceId: depositId,
    createdByUserId: input.createdByUserId,
    occurredAt: input.depositDate,
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

  for (const recurring of recurringRows) {
    await createPurchase({
      title: recurring.title,
      amount: recurring.amount,
      purchaseDate: recurring.nextExecutionDate,
      createdByUserId: recurring.createdByUserId,
      paymentSourceType: recurring.paymentSourceType,
      paymentSourceId: recurring.paymentSourceId ?? undefined,
      installmentCount: 1,
      recurringOriginId: recurring.id,
      tagIds: [],
    });

    await db
      .update(schema.recurringExpenses)
      .set({
        nextExecutionDate: format(addMonths(new Date(recurring.nextExecutionDate), 1), "yyyy-MM-dd"),
      })
      .where(eq(schema.recurringExpenses.id, recurring.id));
  }

  return recurringRows.length;
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
    cardUsage,
  };
}

async function buildBalanceEvolution() {
  const accountRows = await db
    .select({ date: schema.accountEntries.occurredAt, amount: schema.accountEntries.amount })
    .from(schema.accountEntries)
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
  type: "in" | "out" | "future_out";
  date: string;
  title: string;
  amount: number;
  category?: string | null;
  source?: string | null;
  sourceType?: "account" | "pocket" | "card";
  sourceId?: string | null;
  extra?: string | null;
};

export type SourceSummary = {
  account?: { balance: number; outflows: number; sufficient: boolean };
  pockets: Array<{ id: string; name: string; balance: number; outflows: number; sufficient: boolean }>;
  cards: Array<{ id: string; name: string; creditLimit: number; used: number; outflows: number; sufficient: boolean }>;
};

export async function getMonthMovements(month: string): Promise<MonthMovement[]> {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return [];
  const start = format(startOfMonth(new Date(y, m - 1)), "yyyy-MM-dd");
  const end = format(endOfMonth(new Date(y, m - 1)), "yyyy-MM-dd");
  const today = format(new Date(), "yyyy-MM-dd");
  const movements: MonthMovement[] = [];

  const depositsInMonth = await db
    .select({ id: schema.deposits.id, title: schema.deposits.title, amount: schema.deposits.amount, depositDate: schema.deposits.depositDate })
    .from(schema.deposits)
    .where(and(gte(schema.deposits.depositDate, start), lte(schema.deposits.depositDate, end)));
  for (const d of depositsInMonth) {
    movements.push({
      id: `deposit-${d.id}`,
      type: "in",
      date: d.depositDate,
      title: d.title,
      amount: d.amount,
      source: "Conta corrente",
      extra: "Depósito",
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

  const purchasesInMonth = await db
    .select({
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
    })
    .from(schema.purchases)
    .leftJoin(schema.categories, eq(schema.categories.id, schema.purchases.categoryId))
    .leftJoin(schema.pockets, eq(schema.pockets.id, schema.purchases.paymentSourceId))
    .leftJoin(schema.cards, eq(schema.cards.id, schema.purchases.paymentSourceId))
    .where(and(gte(schema.purchases.purchaseDate, start), lte(schema.purchases.purchaseDate, end)));
  for (const p of purchasesInMonth) {
    let source = "Conta corrente";
    if (p.paymentSourceType === "pocket" && p.pocketName) source = `Caixinha ${p.pocketName}`;
    if (p.paymentSourceType === "card" && p.cardName) source = `Cartão ${p.cardName}`;
    const extra = (p.installmentCount ?? 0) > 1 ? `${p.installmentNumber}/${p.installmentCount} parcelas` : null;
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
    })
    .from(schema.recurringExpenses)
    .leftJoin(schema.pockets, eq(schema.pockets.id, schema.recurringExpenses.paymentSourceId))
    .leftJoin(schema.cards, eq(schema.cards.id, schema.recurringExpenses.paymentSourceId))
    .where(
      and(
        eq(schema.recurringExpenses.isActive, true),
        gte(schema.recurringExpenses.nextExecutionDate, start),
        lte(schema.recurringExpenses.nextExecutionDate, end),
        gt(schema.recurringExpenses.nextExecutionDate, today)
      )
    );
  for (const r of futureRecurring) {
    let source = "Conta corrente";
    if (r.paymentSourceType === "pocket" && r.pocketName) source = `Caixinha ${r.pocketName}`;
    if (r.paymentSourceType === "card" && r.cardName) source = `Cartão ${r.cardName}`;
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
    });
  }

  movements.sort((a, b) => {
    const dateCmp = a.date.localeCompare(b.date);
    if (dateCmp !== 0) return dateCmp;
    const order = { in: 0, out: 1, future_out: 2 };
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
        sufficient: available >= out,
      });
    }
  }

  return summary;
}
