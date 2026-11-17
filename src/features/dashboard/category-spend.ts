import type { BudgetAllocationNode, BudgetStatus } from "@/entities/budget/model";
import { budgetStatus } from "@/shared/lib/budget-allocation";

export type CategorySpendRow = {
  categoryId: string;
  name: string;
  planned: number;
  spent: number;
  status: BudgetStatus | "unbudgeted";
  inBudget: boolean;
};

export function buildCategorySpendRows(
  tree: BudgetAllocationNode[],
  actualsByCategoryId: Record<string, number>,
  categories: Array<{ id: string; name: string }>,
): CategorySpendRow[] {
  const nameById = new Map(categories.map((c) => [c.id, c.name]));
  const rowsById = new Map<string, CategorySpendRow>();

  for (const node of tree) {
    if (!node.categoryId) continue;
    const planned = node.plannedAmount ?? node.amount ?? 0;
    const spent = node.spentAmount ?? actualsByCategoryId[node.categoryId] ?? 0;
    rowsById.set(node.categoryId, {
      categoryId: node.categoryId,
      name: node.categoryName ?? nameById.get(node.categoryId) ?? "Categoria",
      planned,
      spent,
      status: node.status ?? budgetStatus(planned, spent),
      inBudget: true,
    });
  }

  for (const [categoryId, spent] of Object.entries(actualsByCategoryId)) {
    if (rowsById.has(categoryId)) continue;
    const amount = Number(spent) || 0;
    if (amount <= 0) continue;
    rowsById.set(categoryId, {
      categoryId,
      name: nameById.get(categoryId) ?? "Categoria",
      planned: 0,
      spent: amount,
      status: "unbudgeted",
      inBudget: false,
    });
  }

  return [...rowsById.values()].sort((a, b) => b.spent - a.spent || a.name.localeCompare(b.name, "pt-BR"));
}
