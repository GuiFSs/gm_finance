import { GoalManagement } from "@/features/goals/goal-management";

export default function GoalsPage() {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">Metas</h2>
      <GoalManagement />
    </div>
  );
}
