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
import { cn } from "@/shared/lib/cn";
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

function SourceMetric({
  label,
  value,
  sublabel,
  valueClassName,
}: {
  label: string;
  value: string;
  sublabel?: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border/80 bg-background/80 px-3 py-2.5 shadow-sm dark:bg-background/40">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={cn("text-base font-semibold tabular-nums leading-tight tracking-tight", valueClassName ?? "text-foreground")}>
        {value}
      </span>
      {sublabel ? <span className="text-[10px] text-muted-foreground">{sublabel}</span> : null}
    </div>
  );
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
              Conta e caixinhas: saldo atual vs. saídas do mês. Cartão: o &quot;usado&quot; já inclui as compras do mês — o
              limite disponível não é descontado de novo pelas saídas.
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
              const estimatedAtMonthStart = available + c.outflows;
              return (
                <div
                  key={c.id}
                  className={`flex flex-col gap-3 rounded-lg border px-3 py-3 sm:px-4 sm:py-4 ${
                    c.sufficient
                      ? "border-green-200 bg-green-50/80 dark:border-green-900/50 dark:bg-green-950/30"
                      : "border-red-200 bg-red-50/80 dark:border-red-900/50 dark:bg-red-950/30"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <WalletCards className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate font-semibold text-foreground">Cartão {c.name}</span>
                    </div>
                    {c.sufficient ? (
                      <Badge
                        variant="outline"
                        className="shrink-0 gap-1 border-green-600/45 bg-green-600/10 text-green-800 dark:border-green-500/50 dark:bg-green-500/15 dark:text-green-400"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Dentro do limite
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="shrink-0 gap-1">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Acima do limite
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
                    <SourceMetric label="Limite contratado" value={formatCurrency(c.creditLimit)} />
                    <SourceMetric label="Já utilizado" value={formatCurrency(c.used)} />
                    <SourceMetric
                      label="Disponível agora"
                      value={formatCurrency(available)}
                      valueClassName={available >= 0 ? "text-foreground" : "text-destructive"}
                      sublabel="Limite − uso"
                    />
                    <SourceMetric
                      label="Compras no mês"
                      value={formatCurrency(c.outflows)}
                      valueClassName="text-red-600 dark:text-red-400"
                      sublabel="Soma nesta tela"
                    />
                  </div>

                  <div className="rounded-md border border-dashed border-border/70 bg-muted/40 px-3 py-2.5 text-sm">
                    <p className="text-xs font-medium text-muted-foreground">Referência: limite no início do mês (estimado)</p>
                    <p className="mt-1 text-base font-semibold tabular-nums text-foreground">{formatCurrency(estimatedAtMonthStart)}</p>
                    <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
                      Soma do disponível atual com as compras do mês nesta tela. O total &quot;usado&quot; do cartão já inclui o mês.
                    </p>
                  </div>
                </div>
              );
            })}
            {!allSufficient && (
              <p className="text-xs text-muted-foreground">
                Uma ou mais fontes estão com saldo insuficiente ou com limite de cartão estourado.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base">Filtrar por mês</CardTitle>
            <div className="flex w-full max-w-md items-center justify-center gap-2 sm:w-auto sm:justify-end">
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
              <span className="min-w-0 flex-1 text-center text-sm font-medium text-foreground sm:min-w-[10rem] sm:flex-initial">
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
