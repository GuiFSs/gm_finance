import { RecurringManagement } from "@/features/recurring/recurring-management";

export default function RecurringPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Despesas recorrentes
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure gastos que se repetem todo mês e execute quando quiser.
        </p>
      </header>
      <RecurringManagement />
    </div>
  );
}
