"use client";

import {
  ArrowDownCircle,
  ArrowUpCircle,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  WalletCards,
  Wallet,
  PiggyBank,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useMemo, useState } from "react";

import { PurchaseDetailDialog } from "@/features/purchases/purchase-detail-dialog";
import { useMonthMovements, type MonthMovementRow } from "@/shared/hooks/use-app-data";
import { formatCurrency, formatDisplayDate, formatYearMonthLabel } from "@/shared/utils/formatters";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

const currentMonthParam = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

function addMonths(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function groupMovements(list: MonthMovementRow[] | undefined) {
  if (!list) return { incoming: [] as MonthMovementRow[], outgoing: [] as MonthMovementRow[], future: [] as MonthMovementRow[] };
  return {
    incoming: list.filter((x) => x.type === "in"),
    outgoing: list.filter((x) => x.type === "out"),
    future: list.filter((x) => x.type === "future_out"),
  };
}

function OutMovementRow({
  item,
  onSelectPurchase,
}: {
  item: MonthMovementRow;
  onSelectPurchase: (id: string) => void;
}) {
  const isCard = item.sourceType === "card";
  const isClickable = Boolean(item.purchaseId);

  const inner = (
    <>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <ArrowUpCircle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-500" />
          <span className="font-medium text-red-950 dark:text-red-100">{item.title}</span>
          {isCard ? (
            <Badge variant="outline" className="font-normal">
              Cartão
            </Badge>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-6 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3 shrink-0" />
            {formatDisplayDate(item.date)}
          </span>
          {item.category ? <span>{item.category}</span> : null}
          {item.source ? <span>{item.source}</span> : null}
          {item.installmentCount && item.installmentCount > 1 ? (
            <span className="tabular-nums">
              Parcela {item.installmentNumber}/{item.installmentCount}
            </span>
          ) : null}
        </div>
        {isCard && item.statementMonth ? (
          <div className="pl-6 text-xs text-muted-foreground">
            Fatura de <span className="font-medium text-foreground">{formatYearMonthLabel(item.statementMonth)}</span>
            {item.dueDate ? (
              <>
                {" "}
                · venc. <span className="font-medium text-foreground">{formatDisplayDate(item.dueDate)}</span>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-right font-semibold tabular-nums text-red-700 dark:text-red-400">
          {formatCurrency(item.amount)}
        </span>
        {isClickable ? (
          <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
        ) : null}
      </div>
    </>
  );

  const baseClass =
    "flex w-full items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50/80 px-3 py-3 text-left transition dark:border-red-900/50 dark:bg-red-950/30";

  if (isClickable) {
    return (
      <button type="button" className={`${baseClass} hover:bg-red-100/90 dark:hover:bg-red-950/50`} onClick={() => onSelectPurchase(item.purchaseId!)}>
        {inner}
      </button>
    );
  }

  return <div className={baseClass}>{inner}</div>;
}

function FutureMovementRow({ item }: { item: MonthMovementRow }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-3 dark:border-amber-900/40 dark:bg-amber-950/25">
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <ArrowUpCircle className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-500" />
          <span className="font-medium text-amber-950 dark:text-amber-100">{item.title}</span>
          <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100 dark:bg-amber-900/50 dark:text-amber-100">
            Previsto
          </Badge>
          {item.sourceType === "card" ? (
            <Badge variant="outline" className="font-normal">
              Cartão
            </Badge>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-6 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3 shrink-0" />
            {formatDisplayDate(item.date)}
          </span>
          {item.source ? <span>{item.source}</span> : null}
        </div>
        {item.sourceType === "card" && item.statementMonth ? (
          <div className="pl-6 text-xs text-muted-foreground">
            Fatura de <span className="font-medium text-foreground">{formatYearMonthLabel(item.statementMonth)}</span>
            {item.dueDate ? (
              <>
                {" "}
                · venc. <span className="font-medium text-foreground">{formatDisplayDate(item.dueDate)}</span>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
      <span className="shrink-0 font-semibold tabular-nums text-amber-900 dark:text-amber-200/90">
        {formatCurrency(item.amount)}
      </span>
    </div>
  );
}

function InMovementRow({ item }: { item: MonthMovementRow }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-green-200 bg-green-50/80 px-3 py-3 dark:border-green-900/50 dark:bg-green-950/30">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <ArrowDownCircle className="h-4 w-4 shrink-0 text-green-600 dark:text-green-500" />
          <span className="font-medium text-green-900 dark:text-green-100">{item.title}</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 pl-6 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formatDisplayDate(item.date)}
          </span>
          {item.category ? <span>{item.category}</span> : null}
          {item.source ? <span>{item.source}</span> : null}
          {item.extra ? <span>{item.extra}</span> : null}
        </div>
      </div>
      <span className="shrink-0 font-semibold tabular-nums text-green-700 dark:text-green-400">
        +{formatCurrency(item.amount)}
      </span>
    </div>
  );
}

export function MovementsList() {
  const [month, setMonth] = useState<string>(currentMonthParam);
  const [detailPurchaseId, setDetailPurchaseId] = useState<string | null>(null);
  const { data: movementsResponse, isLoading } = useMonthMovements(month);
  const list = movementsResponse?.data;
  const sourcesSummary = movementsResponse?.sourcesSummary;
  const isCurrentMonth = month === currentMonthParam();
  const current = currentMonthParam();
  const minMonth = addMonths(current, -12);
  const maxMonth = addMonths(current, 12);
  const canGoPrev = month > minMonth;
  const canGoNext = month < maxMonth;

  const grouped = useMemo(() => groupMovements(list), [list]);

  const totals = useMemo(() => {
    if (!list) return { in: 0, out: 0 };
    let inTotal = 0;
    let outTotal = 0;
    for (const item of list) {
      if (item.type === "in") inTotal += item.amount;
      else outTotal += Math.abs(item.amount);
    }
    return { in: inTotal, out: outTotal };
  }, [list]);

  const hasAnySource = Boolean(
    sourcesSummary?.account || (sourcesSummary?.pockets?.length ?? 0) > 0 || (sourcesSummary?.cards?.length ?? 0) > 0
  );
  const allSufficient =
    hasAnySource &&
    (sourcesSummary?.account?.sufficient ?? true) &&
    (sourcesSummary?.pockets?.every((p) => p.sufficient) ?? true) &&
    (sourcesSummary?.cards?.every((c) => c.sufficient) ?? true);

  return (
    <div className="space-y-4">
      <PurchaseDetailDialog
        purchaseId={detailPurchaseId}
        open={detailPurchaseId !== null}
        onOpenChange={(open) => {
          if (!open) setDetailPurchaseId(null);
        }}
      />

      {isCurrentMonth && hasAnySource && sourcesSummary && (
        <Card className="border-primary/20 bg-primary/5 dark:bg-primary/10">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="h-4 w-4" />
              Dinheiro suficiente por fonte?
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Comparação do saldo (ou limite disponível) de cada origem com as saídas do mês que saem dela.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {sourcesSummary.account && (
              <div
                className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2.5 ${
                  sourcesSummary.account.sufficient
                    ? "border-green-200 bg-green-50/80 dark:border-green-900/50 dark:bg-green-950/30"
                    : "border-red-200 bg-red-50/80 dark:border-red-900/50 dark:bg-red-950/30"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="font-medium text-foreground">Conta corrente</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <span className="text-muted-foreground">
                    Saldo inicial: <span className="font-semibold tabular-nums text-foreground">{formatCurrency(sourcesSummary.account.balance)}</span>
                  </span>
                  <span className="text-muted-foreground">
                    Saídas do mês: <span className="font-semibold tabular-nums text-red-600 dark:text-red-500">{formatCurrency(sourcesSummary.account.outflows)}</span>
                  </span>
                  <span className="text-muted-foreground">
                    Saldo após o mês:{" "}
                    <span
                      className={`font-semibold tabular-nums ${
                        sourcesSummary.account.balance - sourcesSummary.account.outflows >= 0 ? "text-foreground" : "text-destructive"
                      }`}
                    >
                      {formatCurrency(sourcesSummary.account.balance - sourcesSummary.account.outflows)}
                    </span>
                  </span>
                  {sourcesSummary.account.sufficient ? (
                    <span className="flex items-center gap-1 font-medium text-green-700 dark:text-green-400">
                      <CheckCircle2 className="h-4 w-4" /> Suficiente
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 font-medium text-destructive">
                      <AlertTriangle className="h-4 w-4" /> Insuficiente
                    </span>
                  )}
                </div>
              </div>
            )}
            {sourcesSummary.pockets.map((p) => {
              const after = p.balance - p.outflows;
              return (
                <div
                  key={p.id}
                  className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2.5 ${
                    p.sufficient
                      ? "border-green-200 bg-green-50/80 dark:border-green-900/50 dark:bg-green-950/30"
                      : "border-red-200 bg-red-50/80 dark:border-red-900/50 dark:bg-red-950/30"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <PiggyBank className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="font-medium text-foreground">Caixinha {p.name}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    <span className="text-muted-foreground">
                      Saldo inicial: <span className="font-semibold tabular-nums text-foreground">{formatCurrency(p.balance)}</span>
                    </span>
                    <span className="text-muted-foreground">
                      Saídas do mês: <span className="font-semibold tabular-nums text-red-600 dark:text-red-500">{formatCurrency(p.outflows)}</span>
                    </span>
                    <span className="text-muted-foreground">
                      Saldo após o mês: <span className={`font-semibold tabular-nums ${after >= 0 ? "text-foreground" : "text-destructive"}`}>{formatCurrency(after)}</span>
                    </span>
                    {p.sufficient ? (
                      <span className="flex items-center gap-1 font-medium text-green-700 dark:text-green-400">
                        <CheckCircle2 className="h-4 w-4" /> Suficiente
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 font-medium text-destructive">
                        <AlertTriangle className="h-4 w-4" /> Insuficiente
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            {sourcesSummary.cards.map((c) => {
              const available = c.creditLimit - c.used;
              const after = available - c.outflows;
              return (
                <div
                  key={c.id}
                  className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2.5 ${
                    c.sufficient
                      ? "border-green-200 bg-green-50/80 dark:border-green-900/50 dark:bg-green-950/30"
                      : "border-red-200 bg-red-50/80 dark:border-red-900/50 dark:bg-red-950/30"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <WalletCards className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="font-medium text-foreground">Cartão {c.name}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    <span className="text-muted-foreground">
                      Limite disponível: <span className="font-semibold tabular-nums text-foreground">{formatCurrency(available)}</span>
                    </span>
                    <span className="text-muted-foreground">
                      Saídas do mês: <span className="font-semibold tabular-nums text-red-600 dark:text-red-500">{formatCurrency(c.outflows)}</span>
                    </span>
                    <span className="text-muted-foreground">
                      Disponível após o mês: <span className={`font-semibold tabular-nums ${after >= 0 ? "text-foreground" : "text-destructive"}`}>{formatCurrency(after)}</span>
                    </span>
                    {c.sufficient ? (
                      <span className="flex items-center gap-1 font-medium text-green-700 dark:text-green-400">
                        <CheckCircle2 className="h-4 w-4" /> Suficiente
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 font-medium text-destructive">
                        <AlertTriangle className="h-4 w-4" /> Insuficiente
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            {!allSufficient && (
              <p className="text-xs text-muted-foreground">
                Uma ou mais fontes não têm saldo (ou limite) suficiente para as saídas previstas do mês.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base">Filtrar por mês</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={() => setMonth(addMonths(month, -1))}
                disabled={!canGoPrev}
                aria-label="Mês anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-40 text-center text-sm font-medium text-foreground">
                {formatYearMonthLabel(month)}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={() => setMonth(addMonths(month, 1))}
                disabled={!canGoNext}
                aria-label="Próximo mês"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              Carregando...
            </div>
          ) : !list || list.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Nenhum movimento neste mês.
            </p>
          ) : (
            <>
              <div className="mb-6 flex flex-wrap gap-4 rounded-lg border border-border bg-muted/30 px-4 py-3 dark:bg-muted/20">
                <div className="flex items-center gap-2">
                  <ArrowDownCircle className="h-5 w-5 text-green-600 dark:text-green-500" />
                  <span className="text-sm text-muted-foreground">Entradas:</span>
                  <span className="font-semibold tabular-nums text-green-700 dark:text-green-400">
                    {formatCurrency(totals.in)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <ArrowUpCircle className="h-5 w-5 text-red-600 dark:text-red-500" />
                  <span className="text-sm text-muted-foreground">Saídas:</span>
                  <span className="font-semibold tabular-nums text-red-700 dark:text-red-400">
                    {formatCurrency(totals.out)}
                  </span>
                </div>
              </div>

              <div className="space-y-8">
                {grouped.incoming.length > 0 ? (
                  <section className="space-y-3">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Entradas</h2>
                    <ul className="space-y-2">
                      {grouped.incoming.map((item) => (
                        <li key={item.id}>
                          <InMovementRow item={item} />
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}

                {grouped.outgoing.length > 0 ? (
                  <section className="space-y-3">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Despesas</h2>
                    <p className="text-xs text-muted-foreground">
                      Toque em uma despesa cadastrada para ver parcelas, fatura do cartão e vencimento.
                    </p>
                    <ul className="space-y-2">
                      {grouped.outgoing.map((item) => (
                        <li key={item.id}>
                          <OutMovementRow item={item} onSelectPurchase={setDetailPurchaseId} />
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}

                {grouped.future.length > 0 ? (
                  <section className="space-y-3">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Recorrentes previstas</h2>
                    <ul className="space-y-2">
                      {grouped.future.map((item) => (
                        <li key={item.id}>
                          <FutureMovementRow item={item} />
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
