import type { MonthMovementRow } from "@/shared/hooks/use-app-data";

import { computeMonthTotals, formatAmount, type MonthTotals } from "@/features/month/month-model";

export type PeriodColumn = {
  key: string;
  label: string;
  /** Set on year columns. Tapping one returns the page to that month. */
  month?: string;
  totals: MonthTotals;
};

const EPS = 0.004;

export function yearMonthParams(year: number): string[] {
  return Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`);
}

/** Intervalo de datas inclusivo de um mês (`YYYY-MM`) ou de um ano (`YYYY`). */
export function periodDateRange(period: string): { startDate: string; endDate: string } {
  if (/^\d{4}$/.test(period)) return { startDate: `${period}-01-01`, endDate: `${period}-12-31` };
  const [year, month] = period.split("-").map(Number) as [number, number];
  const lastDay = new Date(year, month, 0).getDate();
  return { startDate: `${period}-01`, endDate: `${period}-${String(lastDay).padStart(2, "0")}` };
}

export function monthAbbrev(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
}

export function yearColumns(year: number, lists: Array<MonthMovementRow[] | undefined>): PeriodColumn[] {
  return yearMonthParams(year).map((month, index) => ({
    key: month,
    label: monthAbbrev(month),
    month,
    totals: computeMonthTotals(lists[index]),
  }));
}

export function sumMonthTotals(parts: MonthTotals[]): MonthTotals {
  const totals = {
    inRealized: 0,
    futureIn: 0,
    entradas: 0,
    pago: 0,
    aberto: 0,
    previsto: 0,
    saidas: 0,
    sobra: 0,
  };
  for (const part of parts) {
    totals.inRealized += part.inRealized;
    totals.futureIn += part.futureIn;
    totals.entradas += part.entradas;
    totals.pago += part.pago;
    totals.aberto += part.aberto;
    totals.previsto += part.previsto;
    totals.saidas += part.saidas;
    totals.sobra += part.sobra;
  }
  return totals;
}

/** Height of a column on the shared scale: income when something is left, spending when it is not. */
export function columnMagnitude(totals: MonthTotals): number {
  return Math.max(totals.entradas, totals.saidas);
}

export function periodHasMovement(columns: PeriodColumn[]): boolean {
  return columns.some((column) => columnMagnitude(column.totals) > EPS);
}

export function columnSummary(label: string, totals: MonthTotals): string {
  const left = totals.sobra < 0 ? "falta" : "sobra";
  return `${label}: entra ${formatAmount(totals.entradas)}, sai ${formatAmount(totals.saidas)}, ${left} ${formatAmount(Math.abs(totals.sobra))}`;
}
