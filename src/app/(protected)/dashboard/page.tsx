import { DashboardOverview } from "@/features/dashboard/dashboard-overview";

export default function DashboardPage() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Dashboard</h2>
      <DashboardOverview />
    </div>
  );
}
