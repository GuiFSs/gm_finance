"use client";

import { format } from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  useCardStatementFunding,
  usePockets,
  useReplaceCardStatementFunding,
} from "@/shared/hooks/use-app-data";
import { DEPOSIT_SUM_EPS } from "@/shared/lib/deposit-split";
import { MonthSwitcher } from "@/features/month/ledger";
import { formatAmount, monthLabel } from "@/features/month/month-model";
import { PlaneBar, PlaneLegend } from "@/features/month/plane-bar";
import { cn } from "@/shared/lib/cn";
import { formatDisplayDate } from "@/shared/utils/formatters";
import { Button } from "@/shared/ui/button";
import { Modal } from "@/shared/ui/modal";
import { FormActions } from "@/shared/ui/page-header";
import { SelectOptions } from "@/shared/ui/select-options";

export type CardStatementFundingTarget = {
  id: string;
  name: string;
};

type PurchaseAssignment = {
  targetType: "account" | "pocket";
  pocketId: string;
};

const STATEMENT_MONTH_RE = /^\d{4}-\d{2}$/;

function installmentShortLabel(installmentNumber: number | null, installmentCount: number | null): string | null {
  if (installmentCount != null && installmentCount > 1 && installmentNumber != null) {
    return `${installmentNumber}/${installmentCount}`;
  }
  return null;
}

function aggregateBySource(
  lines: Array<{ id: string; amount: number }>,
  assignments: Record<string, PurchaseAssignment>,
  pocketNames: Map<string, string>
) {
  const buckets = new Map<string, { label: string; amount: number }>();
  for (const line of lines) {
    const a = assignments[line.id];
    if (!a) continue;
    const key = a.targetType === "account" ? "account:" : `pocket:${a.pocketId}`;
    const label =
      a.targetType === "account"
        ? "Conta corrente"
        : `Caixinha ${pocketNames.get(a.pocketId) ?? "?"}`;
    const prev = buckets.get(key);
    buckets.set(key, { label, amount: (prev?.amount ?? 0) + line.amount });
  }
  return Array.from(buckets.values());
}

export function CardStatementFundingModal({
  card,
  open,
  onClose,
  initialStatementMonth,
  /** Total da fatura já conhecido na lista (ex.: subtotal do grupo do cartão em Movimentos). Só vale para `invoiceTotalFromListMonth`. */
  invoiceTotalFromList,
  /** Mês (yyyy-MM) em que `invoiceTotalFromList` foi obtido na lista. */
  invoiceTotalFromListMonth,
}: {
  card: CardStatementFundingTarget | null;
  open: boolean;
  onClose: () => void;
  /** Quando definido (ex.: mês da tela de movimentos), o seletor de mês da fatura abre neste valor. */
  initialStatementMonth?: string;
  invoiceTotalFromList?: number;
  invoiceTotalFromListMonth?: string;
}) {
  const pockets = usePockets();
  const [statementMonth, setStatementMonthState] = useState(
    () => initialStatementMonth ?? format(new Date(), "yyyy-MM")
  );
  const [assignmentsOverride, setAssignmentsOverride] = useState<Record<string, PurchaseAssignment> | null>(null);

  useEffect(() => {
    if (!open) return;
    setStatementMonthState(initialStatementMonth ?? format(new Date(), "yyyy-MM"));
    setAssignmentsOverride(null);
  }, [open, initialStatementMonth]);

  const funding = useCardStatementFunding(card?.id ?? null, statementMonth);
  const replaceFunding = useReplaceCardStatementFunding();
  const fundingPlans = funding.data?.plans;
  const invoiceTotalFromApi = funding.data?.invoiceTotal ?? null;
  const invoiceLines = funding.data?.invoiceLines ?? null;

  const useInvoiceFromList =
    invoiceTotalFromList != null &&
    invoiceTotalFromListMonth != null &&
    statementMonth.trim() === invoiceTotalFromListMonth.trim();

  const invoiceTotal =
    useInvoiceFromList && invoiceTotalFromList != null ? invoiceTotalFromList : invoiceTotalFromApi;

  const invoiceTotalLoading = !useInvoiceFromList && funding.isFetching;
  const invoiceTotalError = !useInvoiceFromList && funding.isError;

  const assignmentsFromServer = useMemo(() => {
    const result: Record<string, PurchaseAssignment> = {};
    const block = fundingPlans?.find((x) => x.statementMonth === statementMonth);
    for (const s of block?.splits ?? []) {
      if (s.purchaseId) {
        result[s.purchaseId] = {
          targetType: s.targetType,
          pocketId: s.pocketId ?? "",
        };
      }
    }
    for (const line of invoiceLines ?? []) {
      if (!result[line.id]) {
        result[line.id] = { targetType: "account", pocketId: "" };
      }
    }
    return result;
  }, [fundingPlans, statementMonth, invoiceLines]);

  const assignments = assignmentsOverride ?? assignmentsFromServer;

  const updateAssignment = useCallback(
    (purchaseId: string, patch: Partial<PurchaseAssignment>) => {
      setAssignmentsOverride((prev) => {
        const base = prev ?? assignmentsFromServer;
        const current = base[purchaseId] ?? { targetType: "account" as const, pocketId: "" };
        const next = { ...current, ...patch };
        if (patch.targetType === "account") {
          next.pocketId = "";
        }
        return { ...base, [purchaseId]: next };
      });
    },
    [assignmentsFromServer]
  );

  const setStatementMonth = useCallback((ym: string) => {
    setStatementMonthState(ym);
    setAssignmentsOverride(null);
  }, []);

  const pocketOptions = (pockets.data ?? []).map((p) => ({ value: p.id, label: p.name }));
  const pocketNames = useMemo(
    () => new Map((pockets.data ?? []).map((p) => [p.id, p.name])),
    [pockets.data]
  );

  const hasPurchases = (invoiceLines?.length ?? 0) > 0;
  const sourceSummary =
    hasPurchases && invoiceLines
      ? aggregateBySource(invoiceLines, assignments, pocketNames)
      : [];

  const save = async () => {
    if (!card) return;
    if (!invoiceLines?.length) {
      toast.error("Não há compras nesta fatura para planejar.");
      return;
    }
    for (const line of invoiceLines) {
      const a = assignments[line.id];
      if (!a) {
        toast.error("Selecione a fonte para cada compra.");
        return;
      }
      if (a.targetType === "pocket" && !a.pocketId.trim()) {
        toast.error("Selecione a caixinha em cada compra que vem de caixinha.");
        return;
      }
    }
    try {
      await replaceFunding.mutateAsync({
        cardId: card.id,
        statementMonth,
        splits: invoiceLines.map((line) => {
          const a = assignments[line.id]!;
          return {
            purchaseId: line.id,
            targetType: a.targetType,
            pocketId: a.targetType === "pocket" ? a.pocketId : undefined,
            amount: line.amount,
          };
        }),
      });
      toast.success("Plano de pagamento salvo");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar");
    }
  };

  const removePlan = async () => {
    if (!card) return;
    try {
      await replaceFunding.mutateAsync({ cardId: card.id, statementMonth, splits: [] });
      toast.success("Plano removido para este mês");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível remover");
    }
  };

  if (!card) return null;

  const validMonth = STATEMENT_MONTH_RE.test(statementMonth.trim());
  const hasPlan = Boolean(fundingPlans?.some((m) => m.statementMonth === statementMonth));
  const summaryTotal = sourceSummary.reduce((s, r) => s + r.amount, 0);

  return (
    <Modal open={open} onClose={onClose} title={
        <>
          pagar fatura · <span className="normal-case">{card.name}</span>
        </>
      } size="2xl">
      <div className="min-w-0 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[15px] text-muted-foreground">De onde sai o dinheiro de cada compra.</p>
          <MonthSwitcher month={statementMonth} onChange={setStatementMonth} />
        </div>

        {fundingPlans && fundingPlans.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-[15px] text-muted-foreground">já planejado</span>
            {fundingPlans.map((m) => (
              <Button
                key={m.statementMonth}
                type="button"
                size="sm"
                variant={statementMonth === m.statementMonth ? "default" : "outline"}
                onClick={() => setStatementMonth(m.statementMonth)}
                aria-pressed={statementMonth === m.statementMonth}
              >
                {monthLabel(m.statementMonth)}
              </Button>
            ))}
          </div>
        ) : null}

        <div>
          <div className="flex items-baseline justify-between gap-3 border-b-2 border-foreground pb-1.5">
            <span className="text-[15px] font-bold lowercase text-foreground">fatura de {monthLabel(statementMonth)}</span>
            <span className="text-2xl font-bold tabular-nums text-foreground">
              {invoiceTotalLoading ? "…" : invoiceTotal == null || invoiceTotalError ? "—" : formatAmount(invoiceTotal, "−")}
            </span>
          </div>
          {invoiceTotalError ? (
            <p className="pt-2 text-[15px] text-ink-out">Não foi possível calcular o total. Tente de novo.</p>
          ) : null}

          {sourceSummary.length > 0 && summaryTotal > DEPOSIT_SUM_EPS ? (
            <div className="pt-3">
              <PlaneBar
                label={`Fontes: ${sourceSummary.map((r) => `${r.label} ${formatAmount(r.amount)}`).join(", ")}`}
                segments={sourceSummary.map((r) => ({ key: r.label, value: r.amount, tone: "out" as const }))}
              />
              <PlaneLegend
                className="mt-3"
                items={sourceSummary.map((r) => ({
                  key: r.label,
                  label: `${r.label} ${Math.round((r.amount / summaryTotal) * 100)}%`,
                  tone: "out" as const,
                  amount: formatAmount(r.amount),
                }))}
              />
            </div>
          ) : null}
        </div>

        <div>
          {!validMonth ? (
            <p className="py-4 text-[15px] text-muted-foreground">Escolha o mês da fatura.</p>
          ) : funding.isFetching && invoiceLines === null ? (
            <p className="py-4 text-[15px] text-muted-foreground">Carregando compras…</p>
          ) : funding.isError && invoiceLines === null ? (
            <p className="py-4 text-[15px] text-ink-out">Não foi possível carregar as compras.</p>
          ) : invoiceLines && invoiceLines.length === 0 ? (
            <p className="py-4 text-[15px] text-muted-foreground">Nenhuma compra nesta fatura.</p>
          ) : invoiceLines && invoiceLines.length > 0 ? (
            <ul className="max-h-[min(26rem,50dvh)] overflow-y-auto">
              {invoiceLines.map((line) => {
                const inst = installmentShortLabel(line.installmentNumber, line.installmentCount);
                const assignment = assignments[line.id] ?? { targetType: "account" as const, pocketId: "" };
                return (
                  <li key={line.id} className="border-t border-border py-3 first:border-t-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-medium text-foreground">{line.title}</p>
                        <p className="text-[15px] text-muted-foreground">
                          {formatDisplayDate(line.purchaseDate)}
                          {inst ? ` · ${inst}` : null}
                        </p>
                      </div>
                      <span className="shrink-0 text-[15px] font-medium tabular-nums text-foreground">
                        {formatAmount(line.amount, "−")}
                      </span>
                    </div>
                    <div className={cn("mt-2 grid grid-cols-1 gap-2", assignment.targetType === "pocket" && "grid-cols-2")}>
                      <SelectOptions
                        aria-label={`Pagar ${line.title} com`}
                        className="w-full min-w-0"
                        value={assignment.targetType}
                        onValueChange={(v) => updateAssignment(line.id, { targetType: v as "account" | "pocket" })}
                        options={[
                          { value: "account", label: "Conta corrente" },
                          { value: "pocket", label: "Caixinha" },
                        ]}
                      />
                      {assignment.targetType === "pocket" ? (
                        <SelectOptions
                          aria-label={`Caixinha para ${line.title}`}
                          className="w-full min-w-0"
                          value={assignment.pocketId}
                          onValueChange={(v) => updateAssignment(line.id, { pocketId: v })}
                          options={[{ value: "", label: "Qual caixinha?" }, ...pocketOptions]}
                        />
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>

        <FormActions
          aside={
            hasPlan ? (
              <Button
                type="button"
                variant="ghost"
                className="w-full text-ink-out hover:text-ink-out sm:w-auto"
                onClick={() => void removePlan()}
                disabled={replaceFunding.isPending}
              >
                remover plano deste mês
              </Button>
            ) : null
          }
        >
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void save()} disabled={replaceFunding.isPending || !hasPurchases}>
            {replaceFunding.isPending ? "Salvando…" : "Salvar plano"}
          </Button>
        </FormActions>
      </div>
    </Modal>
  );
}
