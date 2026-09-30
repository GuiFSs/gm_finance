import { and, eq, inArray, or } from "drizzle-orm";
import { addDays, addMonths, format, startOfMonth } from "date-fns";
import { createHash } from "crypto";

import { db, schema } from "@/db";
import {
  cardDueDateForStatement,
  cardStatementMonth,
} from "@/shared/lib/finance-service";
import { formatCurrency } from "@/shared/utils/formatters";

export type DueSoonItem =
  | {
      kind: "card_statement";
      cardId: string;
      cardName: string;
      dueDate: string;
      statementMonth: string;
      total: number;
    }
  | {
      kind: "purchase";
      purchaseId: string;
      title: string;
      purchaseDate: string;
      amount: number;
    }
  | {
      kind: "recurring";
      recurringId: string;
      title: string;
      nextExecutionDate: string;
      amount: number;
    };

export type DueSoonDigest = {
  today: string;
  tomorrow: string;
  items: DueSoonItem[];
  title: string;
  body: string;
  hash: string;
};

function ymd(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function whenLabel(date: string, today: string, tomorrow: string): string {
  if (date === today) return "hoje";
  if (date === tomorrow) return "amanhã";
  return date;
}

function statementMonthCandidates(ref: Date): string[] {
  const cur = startOfMonth(ref);
  return [-1, 0, 1].map((delta) => format(addMonths(cur, delta), "yyyy-MM"));
}

function formatDigestBody(items: DueSoonItem[], today: string, tomorrow: string): string {
  const parts = items.slice(0, 4).map((item) => {
    if (item.kind === "card_statement") {
      return `${item.cardName} vence ${whenLabel(item.dueDate, today, tomorrow)} (${formatCurrency(item.total)})`;
    }
    if (item.kind === "purchase") {
      return `${item.title} ${whenLabel(item.purchaseDate, today, tomorrow)} (${formatCurrency(Math.abs(item.amount))})`;
    }
    return `${item.title} ${whenLabel(item.nextExecutionDate, today, tomorrow)} (${formatCurrency(Math.abs(item.amount))})`;
  });
  const extra = items.length > 4 ? ` · +${items.length - 4}` : "";
  return parts.join(" · ") + extra;
}

function digestTitle(items: DueSoonItem[], today: string, tomorrow: string): string {
  const dates = new Set(
    items.map((i) =>
      i.kind === "card_statement"
        ? i.dueDate
        : i.kind === "purchase"
          ? i.purchaseDate
          : i.nextExecutionDate,
    ),
  );
  const hasToday = dates.has(today);
  const hasTomorrow = dates.has(tomorrow);
  if (hasToday && hasTomorrow) return "Vencimentos — hoje/amanhã";
  if (hasToday) return "Vencimentos — hoje";
  return "Vencimentos — amanhã";
}

export async function buildDueSoonDigest(now = new Date()): Promise<DueSoonDigest> {
  const today = ymd(now);
  const tomorrow = ymd(addDays(now, 1));
  const items: DueSoonItem[] = [];

  const cards = await db
    .select({
      id: schema.cards.id,
      name: schema.cards.name,
      closingDay: schema.cards.closingDay,
      dueDay: schema.cards.dueDay,
    })
    .from(schema.cards);

  const cardPurchases =
    cards.length === 0
      ? []
      : await db
          .select({
            paymentSourceId: schema.purchases.paymentSourceId,
            amount: schema.purchases.amount,
            purchaseDate: schema.purchases.purchaseDate,
          })
          .from(schema.purchases)
          .where(
            and(
              eq(schema.purchases.paymentSourceType, "card"),
              inArray(
                schema.purchases.paymentSourceId,
                cards.map((c) => c.id),
              ),
            ),
          );

  for (const card of cards) {
    for (const statementMonth of statementMonthCandidates(now)) {
      const dueDate = cardDueDateForStatement(statementMonth, card.dueDay, card.closingDay);
      if (dueDate !== today && dueDate !== tomorrow) continue;

      let total = 0;
      for (const p of cardPurchases) {
        if (p.paymentSourceId !== card.id) continue;
        if (cardStatementMonth(p.purchaseDate, card.closingDay) !== statementMonth) continue;
        total += Math.abs(Number(p.amount));
      }

      items.push({
        kind: "card_statement",
        cardId: card.id,
        cardName: card.name,
        dueDate,
        statementMonth,
        total: Number(total.toFixed(2)),
      });
    }
  }

  const purchases = await db
    .select({
      id: schema.purchases.id,
      title: schema.purchases.title,
      amount: schema.purchases.amount,
      purchaseDate: schema.purchases.purchaseDate,
      recurringOriginId: schema.purchases.recurringOriginId,
    })
    .from(schema.purchases)
    .where(
      and(
        or(
          eq(schema.purchases.paymentSourceType, "account"),
          eq(schema.purchases.paymentSourceType, "pocket"),
        ),
        or(
          eq(schema.purchases.purchaseDate, today),
          eq(schema.purchases.purchaseDate, tomorrow),
        ),
      ),
    );

  const materializedRecurringKeys = new Set(
    purchases
      .filter((p) => p.recurringOriginId)
      .map((p) => `${p.recurringOriginId}:${p.purchaseDate}`),
  );

  for (const p of purchases) {
    items.push({
      kind: "purchase",
      purchaseId: p.id,
      title: p.title,
      purchaseDate: p.purchaseDate,
      amount: Number(p.amount),
    });
  }

  const recurrings = await db
    .select({
      id: schema.recurringExpenses.id,
      title: schema.recurringExpenses.title,
      amount: schema.recurringExpenses.amount,
      nextExecutionDate: schema.recurringExpenses.nextExecutionDate,
    })
    .from(schema.recurringExpenses)
    .where(
      and(
        eq(schema.recurringExpenses.isActive, true),
        or(
          eq(schema.recurringExpenses.nextExecutionDate, today),
          eq(schema.recurringExpenses.nextExecutionDate, tomorrow),
        ),
      ),
    );

  for (const r of recurrings) {
    const key = `${r.id}:${r.nextExecutionDate}`;
    if (materializedRecurringKeys.has(key)) continue;
    items.push({
      kind: "recurring",
      recurringId: r.id,
      title: r.title,
      nextExecutionDate: r.nextExecutionDate,
      amount: Number(r.amount),
    });
  }

  items.sort((a, b) => {
    const da =
      a.kind === "card_statement"
        ? a.dueDate
        : a.kind === "purchase"
          ? a.purchaseDate
          : a.nextExecutionDate;
    const dbDate =
      b.kind === "card_statement"
        ? b.dueDate
        : b.kind === "purchase"
          ? b.purchaseDate
          : b.nextExecutionDate;
    const byDate = da.localeCompare(dbDate);
    if (byDate !== 0) return byDate;
    const ta =
      a.kind === "card_statement" ? a.cardName : a.title;
    const tb =
      b.kind === "card_statement" ? b.cardName : b.title;
    return ta.localeCompare(tb, "pt-BR");
  });

  const title = items.length === 0 ? "Vencimentos" : digestTitle(items, today, tomorrow);
  const body = items.length === 0 ? "" : formatDigestBody(items, today, tomorrow);
  const hash = createHash("sha256")
    .update(JSON.stringify({ today, tomorrow, items }))
    .digest("hex")
    .slice(0, 32);

  return { today, tomorrow, items, title, body, hash };
}

export const DUE_SOON_KIND = "due_soon" as const;

export async function hasDueSoonSendForDate(sendDate: string): Promise<boolean> {
  const rows = await db
    .select({ id: schema.notificationSends.id })
    .from(schema.notificationSends)
    .where(
      and(
        eq(schema.notificationSends.kind, DUE_SOON_KIND),
        eq(schema.notificationSends.sendDate, sendDate),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

export async function recordDueSoonSend(sendDate: string, digestHash: string): Promise<void> {
  await db.insert(schema.notificationSends).values({
    id: crypto.randomUUID(),
    kind: DUE_SOON_KIND,
    sendDate,
    digestHash,
  });
}
