import { addMonths, endOfMonth, format, getDate, startOfMonth } from "date-fns";

import { parseLocalDateYmd } from "@/shared/utils/formatters";

/**
 * Mês da fatura = mês do vencimento (quando a fatura pesa no caixa).
 * Compras no dia de fechamento em diante vão para a fatura seguinte.
 *
 * Ex.: fecha dia 30, vence dia 7. Compra em 15/09 → fatura 2026-10, vence 07/10.
 * Compra em 06/10 (após 30/09) → fatura 2026-11, vence 07/11.
 */
export function cardStatementMonth(purchaseDate: string, closingDay: number, dueDay: number): string {
  const d = parseLocalDateYmd(purchaseDate);
  const day = getDate(d);
  const cycleMonth = startOfMonth(day >= closingDay ? addMonths(d, 1) : d);
  const dueMonth = dueDay <= closingDay ? addMonths(cycleMonth, 1) : cycleMonth;
  return format(startOfMonth(dueMonth), "yyyy-MM");
}

/** Vencimento no dia `dueDay` do mês da fatura (já o mês de pagamento). */
export function cardDueDateForStatement(statementMonthYm: string, dueDay: number): string {
  const [y, m] = statementMonthYm.split("-").map(Number);
  if (!y || !m) return "";
  const monthStart = new Date(y, m - 1, 1);
  const lastDay = endOfMonth(monthStart).getDate();
  const day = Math.min(Math.max(1, dueDay), lastDay);
  return format(new Date(y, m - 1, day), "yyyy-MM-dd");
}
