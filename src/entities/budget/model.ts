export type BudgetAllocationMode = "percent" | "amount";

export type BudgetStatus = "under" | "on_track" | "over";

export type MonthlyBudget = {
  id: string;
  month: string;
  incomeAmount: number;
  createdByUserId: string;
};

export type BudgetAllocation = {
  id: string;
  budgetId: string;
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

export type BudgetAllocationNode = {
  id: string;
  categoryId: string | null;
  categoryName?: string | null;
  tagId: string | null;
  tagName?: string | null;
  allocationMode: BudgetAllocationMode;
  percent: number | null;
  amount: number;
  sortOrder: number;
  children: BudgetAllocationNode[];
  plannedAmount?: number;
  spentAmount?: number;
  spentChildrenSum?: number;
  status?: BudgetStatus;
};

export type BudgetTotals = {
  allocatedRoot: number;
  remainingRoot: number;
  allocatedPercentOfIncome: number;
};

export type MonthlyBudgetPayload = {
  budget: MonthlyBudget | null;
  tree: BudgetAllocationNode[];
  totals: BudgetTotals;
  actualsByCategoryId: Record<string, number>;
  actualsByTagId: Record<string, number>;
};
