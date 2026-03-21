import { MovementsList } from "@/features/movements/movements-list";

export default function MovementsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Movimentos do mês
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Entradas em verde e saídas (incluindo previstas) em vermelho.
        </p>
      </header>
      <MovementsList />
    </div>
  );
}
