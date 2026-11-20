import { differenceInCalendarDays, format } from "date-fns";

import type { MonthMovementRow } from "@/shared/hooks/use-app-data";

export type MonthStatus = "pago" | "aberto" | "previsto" | "entradas";

export type MonthTotals = {
  inRealized: number;
  futureIn: number;
  entradas: number;
  pago: number;
  aberto: number;
  previsto: number;
  saidas: number;
  sobra: number;
};

export function currentMonthParam(): string {
  return format(new Date(), "yyyy-MM");
}

export function todayYmd(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monthName(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long" });
}

export function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }).replace(" de ", " ");
}

function localDay(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function daysFromToday(ymd: string, todayStr: string): number {
  return differenceInCalendarDays(localDay(ymd), localDay(todayStr));
}

/** Data que manda no compromisso: vencimento da fatura no cartão, data do lançamento no resto. */
export function effectiveDate(row: MonthMovementRow): string {
  if (row.sourceType === "card" && row.dueDate) return row.dueDate;
  return row.date;
}

export function rowStatus(row: MonthMovementRow): MonthStatus {
  if (row.type === "in" || row.type === "future_in") return "entradas";
  if (row.paid === false) return "aberto";
  if (row.type === "future_out" && row.paid !== true) return "previsto";
  return "pago";
}

/**
 * Ajuste de saldo (conta ou caixinha) muda o saldo guardado.
 * Não é entrada nem saída: fica de fora do entra/sai, da sobra e da lista do mês.
 */
export function isBalanceAdjustment(row: MonthMovementRow): boolean {
  return row.id.includes("adjustment") || row.extra === "Ajuste";
}

export function computeMonthTotals(list: MonthMovementRow[] | undefined): MonthTotals {
  const t = { inRealized: 0, futureIn: 0, pago: 0, aberto: 0, previsto: 0 };
  for (const row of list ?? []) {
    if (isBalanceAdjustment(row)) continue;
    const amount = Math.abs(row.amount);
    if (row.type === "in") t.inRealized += amount;
    else if (row.type === "future_in") t.futureIn += amount;
    else {
      const s = rowStatus(row);
      if (s === "aberto") t.aberto += amount;
      else if (s === "previsto") t.previsto += amount;
      else t.pago += amount;
    }
  }
  const entradas = t.inRealized + t.futureIn;
  const saidas = t.pago + t.aberto + t.previsto;
  return { ...t, entradas, saidas, sobra: entradas - saidas };
}

/** Linha de compromisso em aberto: compra de conta/caixinha ou a fatura inteira de um cartão. */
export type OpenItem =
  | {
      kind: "purchase";
      key: string;
      purchaseId: string;
      title: string;
      date: string;
      amount: number;
      source: string | null;
      installment: string | null;
    }
  | {
      kind: "statement";
      key: string;
      cardId: string;
      statementMonth: string;
      title: string;
      date: string;
      amount: number;
      count: number;
    };

export function openItems(list: MonthMovementRow[] | undefined, viewMonth: string): OpenItem[] {
  const out: OpenItem[] = [];
  const statements = new Map<string, Extract<OpenItem, { kind: "statement" }>>();
  for (const row of list ?? []) {
    if (row.type !== "out" && row.type !== "future_out") continue;
    if (row.paid !== false) continue;
    if (row.sourceType === "card" && row.sourceId) {
      const statementMonth = row.statementMonth ?? viewMonth;
      const key = `${row.sourceId}:${statementMonth}`;
      const existing = statements.get(key);
      if (existing) {
        existing.amount += Math.abs(row.amount);
        existing.count += 1;
      } else {
        statements.set(key, {
          kind: "statement",
          key,
          cardId: row.sourceId,
          statementMonth,
          title: `Fatura ${(row.source ?? "cartão").replace(/^Cartão\s+/i, "")}`,
          date: effectiveDate(row),
          amount: Math.abs(row.amount),
          count: 1,
        });
      }
      continue;
    }
    if (!row.purchaseId) continue;
    out.push({
      kind: "purchase",
      key: row.id,
      purchaseId: row.purchaseId,
      title: row.title,
      date: row.date,
      amount: Math.abs(row.amount),
      source: row.source ?? null,
      installment:
        row.installmentCount && row.installmentCount > 1 ? `${row.installmentNumber}/${row.installmentCount}` : null,
    });
  }
  return [...out, ...statements.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** "hoje", "amanhã", "em 3 dias"; datas passadas ficam "em aberto" (pago nunca é inferido). */
export function dueWord(ymd: string, todayStr: string): string {
  const diff = daysFromToday(ymd, todayStr);
  if (diff === 0) return "hoje";
  if (diff === 1) return "amanhã";
  if (diff > 1) return `em ${diff} dias`;
  return "em aberto";
}

export function dayOfMonth(ymd: string): string {
  return String(Number(ymd.slice(8, 10)));
}

const amountFormat = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Valor sem "R$" para linhas; o sinal acompanha a direção. */
export function formatAmount(value: number, sign?: "+" | "−"): string {
  const s = amountFormat.format(Math.abs(value));
  return sign ? `${sign}${s}` : s;
}
