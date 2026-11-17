"use client";

import { Check, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { CardStatementFundingModal } from "@/features/cards/card-statement-funding-modal";
import { DayTile, LedgerRow, MonthSwitcher, PaidCheck, type TileTone } from "@/features/month/ledger";
import {
  computeMonthTotals,
  currentMonthParam,
  dayOfMonth,
  daysFromToday,
  dueWord,
  effectiveDate,
  formatAmount,
  monthName,
  rowStatus,
  shiftMonth,
  todayYmd,
  type MonthStatus,
} from "@/features/month/month-model";
import { MonthPlane } from "@/features/month/month-plane";
import { PurchaseDetailDialog } from "@/features/purchases/purchase-detail-dialog";
import {
  useMonthMovements,
  useSetCardStatementPaid,
  useSetPurchasePaid,
  type MonthMovementRow,
} from "@/shared/hooks/use-app-data";
import { cn } from "@/shared/lib/cn";
import { formatDisplayDate, formatYearMonthLabel } from "@/shared/utils/formatters";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/shared/ui/accordion";
import { Button } from "@/shared/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/toggle-group";

type ViewMode = "source" | "date";

const STATUS_LABEL: Record<MonthStatus, string> = {
  pago: "pago",
  aberto: "em aberto",
  previsto: "previsto",
  entradas: "entradas",
};

const CHECKING_ACCOUNT_LABEL = "Conta corrente";

type SourceGroup = {
  key: string;
  label: string;
  sortOrder: number;
  sourceType?: MonthMovementRow["sourceType"];
  sourceId?: string | null;
  items: MonthMovementRow[];
  subtotal: number;
};

function sourceGroupKey(item: MonthMovementRow): string {
  /** `""` não é nullish — sem `trim` gerava dois grupos “conta” vs `account`. */
  const t = (item.sourceType ?? "").trim();
  if (!t || t === "account") return "account";
  if ((t === "pocket" || t === "card") && item.sourceId) return `${t}:${item.sourceId}`;
  return `${t}:${item.source ?? item.id}`;
}

/** Agrupa saídas (realizadas e previstas) por conta, caixinha ou cartão. */
function groupBySource(items: MonthMovementRow[]): SourceGroup[] {
  const map = new Map<string, MonthMovementRow[]>();
  for (const item of items) {
    const k = sourceGroupKey(item);
    map.set(k, [...(map.get(k) ?? []), item]);
  }
  const out: SourceGroup[] = [];
  for (const [key, groupItems] of map) {
    const first = groupItems[0]!;
    const st = (first.sourceType ?? "").trim();
    const isAccount = !st || st === "account";
    out.push({
      key,
      label: isAccount ? CHECKING_ACCOUNT_LABEL : first.source?.trim() || (st === "pocket" ? "Caixinha" : "Cartão"),
      sortOrder: isAccount ? 0 : st === "pocket" ? 1 : 2,
      sourceType: first.sourceType,
      sourceId: first.sourceId ?? null,
      items: [...groupItems].sort((a, b) => a.date.localeCompare(b.date)),
      subtotal: groupItems.reduce((s, i) => s + Math.abs(i.amount), 0),
    });
  }
  return out.sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, "pt-BR", { sensitivity: "base" }));
}

/** Remove valores em R$ do rótulo de destino: o valor já está na linha. */
function cleanSource(s: string | null | undefined): string | null {
  if (!s) return null;
  const out = s.replace(/\s*R\$\s*[\d.\s\u00a0]+(?:,\d{2})?/gi, " ").replace(/\s+/g, " ").trim();
  return out || null;
}

function isForecastNote(s: string | null | undefined): boolean {
  return Boolean(s && /previst/i.test(s));
}

function cardName(label: string): string {
  return label.replace(/^Cartão\s+/i, "").trim() || label;
}

function tileTone(row: MonthMovementRow, todayStr: string): TileTone {
  if (row.type === "in") return "in";
  if (row.type === "future_in") return "forecast-in";
  const s = rowStatus(row);
  if (s === "aberto") return daysFromToday(effectiveDate(row), todayStr) <= 2 ? "open" : "open-later";
  if (s === "previsto") return "forecast";
  return "out";
}

function statusWord(row: MonthMovementRow, todayStr: string, isCurrentMonth: boolean): string | null {
  if (row.type === "in") return null;
  const s = rowStatus(row);
  const date = effectiveDate(row);
  if (row.type === "future_in") {
    const diff = daysFromToday(date, todayStr);
    if (!isCurrentMonth || diff < 0) return "previsto";
    return diff === 0 ? "entra hoje" : diff === 1 ? "entra amanhã" : `entra em ${diff} dias`;
  }
  if (s === "aberto") return isCurrentMonth ? dueWord(date, todayStr) : "em aberto";
  if (s === "previsto") {
    const diff = daysFromToday(date, todayStr);
    if (!isCurrentMonth || diff < 0) return "previsto";
    return diff === 0 ? "hoje" : diff === 1 ? "amanhã" : `em ${diff} dias`;
  }
  return "pago";
}

export function MovementsList() {
  const searchParams = useSearchParams();
  const current = currentMonthParam();
  const minMonth = shiftMonth(current, -12);
  const maxMonth = shiftMonth(current, 12);
  const monthParam = searchParams.get("month");
  const statusParam = searchParams.get("status");

  const [month, setMonth] = useState(() =>
    monthParam && /^\d{4}-\d{2}$/.test(monthParam) && monthParam >= minMonth && monthParam <= maxMonth ? monthParam : current,
  );
  const [status, setStatus] = useState<MonthStatus | null>(() =>
    statusParam && statusParam in STATUS_LABEL ? (statusParam as MonthStatus) : null,
  );
  const [view, setView] = useState<ViewMode>("source");
  const [detailPurchaseId, setDetailPurchaseId] = useState<string | null>(null);
  const [fundingCard, setFundingCard] = useState<{ id: string; name: string; invoiceTotal?: number } | null>(null);
  const [fundingEpoch, setFundingEpoch] = useState(0);

  const { data, isLoading, isError, error } = useMonthMovements(month);
  const setPurchasePaid = useSetPurchasePaid();
  const setStatementPaid = useSetCardStatementPaid();
  const purchasePendingId = setPurchasePaid.isPending ? setPurchasePaid.variables?.purchaseId : undefined;
  const cardPendingId = setStatementPaid.isPending ? setStatementPaid.variables?.cardId : undefined;

  const list = data?.data;
  const sourcesSummary = data?.sourcesSummary;
  const isCurrentMonth = month === current;
  const todayStr = todayYmd();
  const totals = useMemo(() => computeMonthTotals(list), [list]);
  const deficit = totals.sobra < 0;

  const filtered = useMemo(
    () => (list ?? []).filter((row) => !status || rowStatus(row) === status),
    [list, status],
  );
  const incoming = useMemo(
    () => filtered.filter((r) => r.type === "in" || r.type === "future_in").sort((a, b) => a.date.localeCompare(b.date)),
    [filtered],
  );
  const outgoingGroups = useMemo(
    () => groupBySource(filtered.filter((r) => r.type === "out" || r.type === "future_out")),
    [filtered],
  );
  const chronological = useMemo(
    () => [...filtered].sort((a, b) => effectiveDate(a).localeCompare(effectiveDate(b))),
    [filtered],
  );

  function togglePurchase(purchaseId: string, paid: boolean) {
    setPurchasePaid.mutate(
      { purchaseId, paid },
      { onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível atualizar o pagamento") },
    );
  }

  function toggleStatement(cardId: string, paid: boolean, statementMonth = month) {
    setStatementPaid.mutate(
      { cardId, statementMonth, paid },
      { onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível atualizar a fatura") },
    );
  }

  function renderRow(row: MonthMovementRow, opts: { showSource: boolean }) {
    const isCard = row.sourceType === "card";
    const isIn = row.type === "in" || row.type === "future_in";
    const inCardGroup = isCard && !opts.showSource;
    const word = inCardGroup && rowStatus(row) !== "pago" ? null : statusWord(row, todayStr, isCurrentMonth);
    const meta = [
      word,
      opts.showSource || isIn ? cleanSource(row.source) : null,
      isForecastNote(row.category) ? null : row.category,
      row.installmentCount && row.installmentCount > 1 ? `${row.installmentNumber}/${row.installmentCount}` : null,
      isForecastNote(row.extra) || /parcela/i.test(row.extra ?? "") ? null : row.extra,
    ]
      .filter(Boolean)
      .join(" · ");
    const urgent =
      !inCardGroup && rowStatus(row) === "aberto" && isCurrentMonth && daysFromToday(effectiveDate(row), todayStr) <= 0;

    let action: ReactNode = null;
    if (!isCard && row.purchaseId && typeof row.paid === "boolean") {
      action = (
        <PaidCheck
          paid={row.paid}
          pending={purchasePendingId === row.purchaseId}
          label={row.title}
          onToggle={(next) => togglePurchase(row.purchaseId!, next)}
        />
      );
    } else if (isCard && opts.showSource && row.sourceId && typeof row.paid === "boolean") {
      action = (
        <PaidCheck
          paid={row.paid}
          pending={cardPendingId === row.sourceId}
          label={`a fatura ${cardName(row.source ?? "")}`}
          onToggle={(next) => toggleStatement(row.sourceId!, next, row.statementMonth ?? month)}
        />
      );
    }

    return (
      <LedgerRow
        key={row.id}
        tile={<DayTile day={dayOfMonth(inCardGroup ? row.date : effectiveDate(row))} tone={tileTone(row, todayStr)} />}
        title={row.title}
        meta={<span className={urgent ? "text-ink-open" : undefined}>{meta}</span>}
        amount={
          isIn ? (
            <span className="text-ink-in">{formatAmount(row.amount, "+")}</span>
          ) : (
            formatAmount(row.amount, "−")
          )
        }
        onOpen={row.purchaseId ? () => setDetailPurchaseId(row.purchaseId!) : undefined}
        openLabel={`Ver ${row.title}`}
        action={action}
      />
    );
  }

  return (
    <div className="pb-4">
      <PurchaseDetailDialog
        purchaseId={detailPurchaseId}
        open={detailPurchaseId !== null}
        onOpenChange={(o) => !o && setDetailPurchaseId(null)}
      />
      <CardStatementFundingModal
        key={fundingCard ? `${fundingCard.id}-${fundingEpoch}-${month}` : "idle"}
        card={fundingCard ? { id: fundingCard.id, name: fundingCard.name } : null}
        open={!!fundingCard}
        initialStatementMonth={month}
        invoiceTotalFromList={fundingCard?.invoiceTotal}
        invoiceTotalFromListMonth={fundingCard?.invoiceTotal != null ? month : undefined}
        onClose={() => setFundingCard(null)}
      />

      <header className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold lowercase leading-none tracking-tight text-foreground">movimentos</h1>
        <MonthSwitcher month={month} onChange={setMonth} min={minMonth} max={maxMonth} />
      </header>

      <section aria-label="Resumo do mês" className="pt-6 md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:items-end md:gap-10">
        <div>
          <p className="text-[15px] font-medium lowercase text-muted-foreground">
            {deficit ? "falta" : "sobra"} em {monthName(month)}
          </p>
          {isLoading ? (
            <>
              <p className="mt-1 h-12 w-44 animate-pulse bg-muted" aria-label="Carregando" />
              <p className="mt-2 h-5 w-40 animate-pulse bg-muted" />
            </>
          ) : (
            <>
              <p className={cn("mt-1 text-[48px] font-bold leading-none tracking-[-0.03em] tabular-nums", deficit && "text-ink-out")}>
                <span className="mr-1.5 text-2xl font-medium tracking-normal">{deficit ? "−R$" : "R$"}</span>
                {formatAmount(totals.sobra)}
              </p>
              <p className="mt-2 text-[15px] text-muted-foreground tabular-nums">
                entra {formatAmount(totals.entradas)} · sai {formatAmount(totals.saidas)}
              </p>
            </>
          )}
        </div>
        {isLoading ? (
          <div className="mt-5 h-12 animate-pulse bg-muted md:mt-0" />
        ) : (
          <MonthPlane className="mt-5 md:mt-0" size="md" totals={totals} active={status} onSelect={setStatus} />
        )}
      </section>

      <div className="sticky top-0 z-20 -mx-4 mt-6 flex items-center justify-between gap-3 border-b border-border bg-background px-4 py-2 pt-[calc(0.5rem+env(safe-area-inset-top))] sm:-mx-6 sm:px-6 md:static md:mx-0 md:px-0 md:pt-2">
        {status ? (
          <Button variant="secondary" size="sm" className="gap-1.5" onClick={() => setStatus(null)}>
            só {STATUS_LABEL[status]}
            <X aria-hidden />
            <span className="sr-only">Limpar filtro</span>
          </Button>
        ) : (
          <span className="text-[15px] text-muted-foreground tabular-nums">
            {list ? `${list.length} lançamentos` : ""}
          </span>
        )}
        <ToggleGroup
          type="single"
          value={view}
          onValueChange={(v) => v && setView(v as ViewMode)}
          aria-label="Organizar por"
          className="gap-0 border border-input"
        >
          <ToggleGroupItem value="source" className="h-8 px-3 data-[state=on]:bg-foreground data-[state=on]:text-background">
            por fonte
          </ToggleGroupItem>
          <ToggleGroupItem value="date" className="h-8 px-3 data-[state=on]:bg-foreground data-[state=on]:text-background">
            por data
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {isLoading ? (
        <div className="space-y-3 pt-6" aria-label="Carregando">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-12 animate-pulse bg-muted" />
          ))}
        </div>
      ) : isError ? (
        <div className="space-y-2 py-10">
          <p className="text-[15px] font-medium text-ink-out">Não foi possível carregar os movimentos.</p>
          <p className="text-[15px] text-muted-foreground">{error instanceof Error ? error.message : "Erro desconhecido"}</p>
        </div>
      ) : !list || list.length === 0 ? (
        <p className="py-10 text-[15px] text-muted-foreground">Nenhum movimento em {monthName(month)}.</p>
      ) : filtered.length === 0 ? (
        <p className="py-10 text-[15px] text-muted-foreground">Nada {STATUS_LABEL[status!]} em {monthName(month)}.</p>
      ) : view === "date" ? (
        <div className="pt-2">{chronological.map((row) => renderRow(row, { showSource: true }))}</div>
      ) : (
        <div>
          {incoming.length > 0 ? (
            <GroupBlock title="entradas">
              {incoming.map((row) => renderRow(row, { showSource: false }))}
            </GroupBlock>
          ) : null}
          {outgoingGroups.map((g) => {
            const isCard = g.sourceType === "card" && Boolean(g.sourceId);
            const outItems = g.items.filter((i) => i.type === "out");
            const cardPaid = isCard && outItems.length > 0 && outItems.every((i) => i.paid === true);
            const dueDate = isCard ? g.items.find((i) => i.dueDate)?.dueDate : null;
            const plan = isCard ? g.items.find((i) => i.cardFundingPlan)?.cardFundingPlan : null;
            return (
              <GroupBlock
                key={g.key}
                title={g.label}
                subtotal={formatAmount(g.subtotal, "−")}
                meta={
                  isCard
                    ? [
                        `fatura de ${formatYearMonthLabel(g.items[0]?.statementMonth ?? month).toLowerCase()}`,
                        dueDate ? `vence ${formatDisplayDate(dueDate).slice(0, 5)}` : null,
                        plan ? `paga com ${plan}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")
                    : null
                }
                actions={
                  isCard ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant={cardPaid ? "secondary" : "outline"}
                        disabled={cardPendingId === g.sourceId || outItems.length === 0}
                        onClick={() => toggleStatement(g.sourceId!, !cardPaid)}
                        className={cn("gap-1.5", cardPaid && "bg-plane-out text-white hover:bg-plane-out/90")}
                      >
                        {cardPaid ? <Check aria-hidden /> : null}
                        {cardPaid ? "fatura paga" : "marcar fatura paga"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setFundingCard({
                            id: g.sourceId!,
                            name: cardName(g.label),
                            invoiceTotal: outItems.length ? outItems.reduce((s, i) => s + Math.abs(i.amount), 0) : undefined,
                          });
                          setFundingEpoch((x) => x + 1);
                        }}
                      >
                        pagar com…
                      </Button>
                    </>
                  ) : null
                }
              >
                {g.items.map((row) => renderRow(row, { showSource: false }))}
              </GroupBlock>
            );
          })}
        </div>
      )}

      {isCurrentMonth && sourcesSummary ? <SourcesSection summary={sourcesSummary} /> : null}
    </div>
  );
}

function GroupBlock({
  title,
  subtotal,
  meta,
  actions,
  children,
}: {
  title: string;
  subtotal?: ReactNode;
  meta?: string | null;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="pt-8">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="min-w-0 text-2xl font-bold leading-tight tracking-tight text-foreground">{title}</h2>
        {subtotal ? <span className="shrink-0 text-[15px] font-medium tabular-nums text-foreground">{subtotal}</span> : null}
      </div>
      {meta ? <p className="mt-0.5 text-[15px] text-muted-foreground">{meta}</p> : null}
      {actions ? <div className="mt-2 flex flex-wrap gap-2">{actions}</div> : null}
      <div className="mt-2 border-t-2 border-foreground">{children}</div>
    </section>
  );
}

type SourcesSummary = NonNullable<ReturnType<typeof useMonthMovements>["data"]>["sourcesSummary"];

function SourcesSection({ summary }: { summary: SourcesSummary }) {
  const rows: Array<{ key: string; name: string; detail: string; ok: boolean; word: string }> = [];
  if (summary.account) {
    const after = summary.account.balance - summary.account.outflows;
    rows.push({
      key: "account",
      name: "Conta corrente",
      detail: `${formatAmount(summary.account.balance)} → ${formatAmount(after, after < 0 ? "−" : undefined)}`,
      ok: summary.account.sufficient,
      word: summary.account.sufficient ? "cobre" : "não cobre",
    });
  }
  for (const p of summary.pockets) {
    const after = p.balance - p.outflows;
    rows.push({
      key: p.id,
      name: p.name,
      detail: `${formatAmount(p.balance)} → ${formatAmount(after, after < 0 ? "−" : undefined)}`,
      ok: p.sufficient,
      word: p.sufficient ? "cobre" : "não cobre",
    });
  }
  for (const c of summary.cards) {
    const available = c.creditLimit - c.used;
    rows.push({
      key: c.id,
      name: `Cartão ${c.name}`,
      detail: `livre ${formatAmount(available, available < 0 ? "−" : undefined)} de ${formatAmount(c.creditLimit)}`,
      ok: c.sufficient,
      word: c.sufficient ? "no limite" : "acima do limite",
    });
  }
  if (rows.length === 0) return null;
  const short = rows.filter((r) => !r.ok).length;

  return (
    <Accordion type="single" collapsible className="mt-10 border-t-2 border-foreground">
      <AccordionItem value="sources" className="border-b-0">
        <AccordionTrigger className="py-4 text-2xl font-bold hover:no-underline">
          <span className="flex items-baseline gap-3">
            fontes
            <span className={cn("text-[15px] font-medium", short ? "text-ink-out" : "text-muted-foreground")}>
              {short ? `${short} não ${short === 1 ? "cobre" : "cobrem"} o mês` : "todas cobrem o mês"}
            </span>
          </span>
        </AccordionTrigger>
        <AccordionContent>
          <p className="pb-2 text-[15px] text-muted-foreground">Saldo hoje → depois das saídas que ainda não saíram.</p>
          <ul>
            {rows.map((r) => (
              <li key={r.key} className="flex min-h-12 items-center gap-3 border-t border-border py-2">
                <span className={cn("size-2.5 shrink-0", r.ok ? "bg-plane-in" : "bg-plane-out")} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] text-foreground">{r.name}</span>
                  <span className="block text-[15px] tabular-nums text-muted-foreground">{r.detail}</span>
                </span>
                <span className={cn("text-[15px] font-medium", r.ok ? "text-muted-foreground" : "text-ink-out")}>{r.word}</span>
              </li>
            ))}
          </ul>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
