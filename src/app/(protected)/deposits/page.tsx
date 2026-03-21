import { DepositManagement } from "@/features/deposits/deposit-management";

export default function DepositsPage() {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">Depósitos</h2>
      <DepositManagement />
    </div>
  );
}
