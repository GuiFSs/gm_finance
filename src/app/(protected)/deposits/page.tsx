import { DepositManagement } from "@/features/deposits/deposit-management";

export default function DepositsPage() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Depósitos</h2>
      <DepositManagement />
    </div>
  );
}
