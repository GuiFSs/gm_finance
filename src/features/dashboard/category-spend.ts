import { monthName } from "@/features/month/month-model";
import type { MonthMovementRow } from "@/shared/hooks/use-app-data";

export const UNCATEGORIZED_LABEL = "sem categoria";
export const UNTAGGED_LABEL = "sem tag";

export type CategorySlice = {
  name: string;
  spent: number;
  percent: number;
  color: string;
};

/** Flat fills, stepped around the hue wheel so neighboring slices stay apart. */
const CATEGORY_COLORS = [
  "#e23b32",
  "#3b82f6",
  "#22a06b",
  "#f97316",
  "#a855c7",
  "#14b8a6",
  "#ec4899",
  "#e3a008",
  "#6366f1",
  "#84cc16",
  "#0ea5e9",
  "#d946ef",
];

const UNCATEGORIZED_COLOR = "#a3a39e";

/** Purchase outflows in the period. A purchase with no category is "sem categoria". */
export function categorySlicesFromMovements(lists: Array<MonthMovementRow[] | undefined>): CategorySlice[] {
  const totals = new Map<string, number>();
  for (const list of lists) {
    for (const row of list ?? []) accumulate(totals, row);
  }
  return slicesFromTotals(totals);
}

/**
 * Tags das compras de uma categoria. Compra com várias tags reparte o valor entre elas,
 * para a pizza somar o total da categoria. Sem tag vira "sem tag".
 */
export function tagSlicesForCategory(
  lists: Array<MonthMovementRow[] | undefined>,
  categoryName: string,
): CategorySlice[] {
  const totals = new Map<string, number>();
  for (const list of lists) {
    for (const row of list ?? []) accumulate(totals, row, categoryName);
  }
  return slicesFromTotals(totals);
}

export type MonthGroup = { month: string; label: string; slices: CategorySlice[] };

/**
 * Cada mês do ano, com a fatia de cada categoria (ou das tags da categoria aberta).
 * A porcentagem é do mês. A cor é a mesma da pizza do ano, para a categoria não mudar de cor entre os meses.
 */
export function monthlyGroups(
  months: string[],
  lists: Array<MonthMovementRow[] | undefined>,
  palette: CategorySlice[],
  categoryName?: string | null,
): MonthGroup[] {
  const colors = new Map(palette.map((slice) => [slice.name, slice.color]));
  return months.map((month, index) => {
    const totals = new Map<string, number>();
    for (const row of lists[index] ?? []) accumulate(totals, row, categoryName);
    return { month, label: monthName(month), slices: slicesFromTotals(totals, colors) };
  });
}

function accumulate(totals: Map<string, number>, row: MonthMovementRow, categoryName?: string | null) {
  if (!row.purchaseId) return;
  const category = row.category?.trim() || UNCATEGORIZED_LABEL;
  if (!categoryName) {
    totals.set(category, (totals.get(category) ?? 0) + Math.abs(row.amount));
    return;
  }
  if (category !== categoryName) return;
  const amount = Math.abs(row.amount);
  const tags = [...new Set((row.tags ?? []).map((tag) => tag.trim()).filter(Boolean))];
  if (tags.length === 0) {
    totals.set(UNTAGGED_LABEL, (totals.get(UNTAGGED_LABEL) ?? 0) + amount);
    return;
  }
  const share = amount / tags.length;
  for (const tag of tags) totals.set(tag, (totals.get(tag) ?? 0) + share);
}

function slicesFromTotals(totals: Map<string, number>, fixedColors?: Map<string, string>): CategorySlice[] {
  const entries = [...totals.entries()].filter(([, spent]) => spent > 0.004);
  entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"));
  const percents = sharePercents(entries.map(([, spent]) => spent));
  const ranked = colorsFor(entries.map(([name]) => name));
  return entries.map(([name, spent], index) => ({
    name,
    spent,
    percent: percents[index] ?? 0,
    color: fixedColors?.get(name) ?? ranked.get(name) ?? CATEGORY_COLORS[0],
  }));
}

function colorsFor(names: string[]): Map<string, string> {
  const colors = new Map<string, string>();
  let next = 0;
  for (const name of names) {
    if (name === UNCATEGORIZED_LABEL || name === UNTAGGED_LABEL) {
      colors.set(name, UNCATEGORIZED_COLOR);
      continue;
    }
    colors.set(name, CATEGORY_COLORS[next % CATEGORY_COLORS.length]);
    next += 1;
  }
  return colors;
}

/** Integer percents that sum to 100. */
export function sharePercents(values: number[]): number[] {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return values.map(() => 0);
  const raw = values.map((value) => (value / total) * 100);
  const floors = raw.map((value) => Math.floor(value));
  let left = 100 - floors.reduce((sum, value) => sum + value, 0);
  const order = raw
    .map((value, index) => ({ index, frac: value - Math.floor(value) }))
    .sort((a, b) => b.frac - a.frac || a.index - b.index);
  for (const item of order) {
    if (left <= 0) break;
    floors[item.index] += 1;
    left -= 1;
  }
  return floors;
}
