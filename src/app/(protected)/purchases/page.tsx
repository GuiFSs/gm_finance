import { PurchaseList } from "@/features/purchases/purchase-list";

export default function PurchasesPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Despesas
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Registre e acompanhe suas compras e gastos.
        </p>
      </header>
      <PurchaseList />
    </div>
  );
}
