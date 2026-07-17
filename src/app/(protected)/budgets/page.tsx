import { BudgetPlanner } from "@/features/budgets/budget-planner";

export default function BudgetsPage() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Orçamento</h2>
      <BudgetPlanner />
    </div>
  );
}
