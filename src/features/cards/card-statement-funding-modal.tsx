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
import { formatCurrency, formatDisplayDate, formatYearMonthLabel } from "@/shared/utils/formatters";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Modal } from "@/shared/ui/modal";
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

  return (
    <Modal open={open} onClose={onClose} title={`Pagamento da fatura — ${card.name}`} size="3xl">
      <div className="min-w-0 space-y-4">
        <p className="text-sm text-muted-foreground">
          Para cada mês de referência da fatura, escolha de onde sairá o dinheiro para pagar cada compra (conta
          corrente ou caixinha). Pode haver um plano diferente por mês; cada cartão tem seus próprios planos.
        </p>
        <div>
          <Label htmlFor="stmt-month">Mês da fatura (referência)</Label>
          <Input
            id="stmt-month"
            type="month"
            value={statementMonth}
            onChange={(e) => setStatementMonth(e.target.value)}
            className="mt-1.5 max-w-xs"
          />
        </div>

        <div className="rounded-lg border border-border bg-muted/35 px-3 py-2.5">
          <p className="text-xs font-medium text-muted-foreground">
            Total a pagar na fatura ({formatYearMonthLabel(statementMonth)})
          </p>
          {invoiceTotalLoading ? (
            <p className="mt-1 text-sm text-muted-foreground">Calculando…</p>
          ) : invoiceTotalError ? (
            <p className="mt-1 text-sm text-destructive">
              Não foi possível calcular o total da fatura. Tente novamente.
            </p>
          ) : invoiceTotal === null ? (
            <>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-muted-foreground">—</p>
              <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                {STATEMENT_MONTH_RE.test(statementMonth.trim())
                  ? "Não foi possível obter o total desta fatura. Recarregue a página ou tente novamente."
                  : "Informe o mês de referência da fatura (formato AAAA-MM)."}
              </p>
            </>
          ) : (
            <>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">
                {formatCurrency(invoiceTotal)}
              </p>
              <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                {invoiceTotal <= DEPOSIT_SUM_EPS
                  ? "Nenhuma compra lançada para este mês de fatura neste cartão."
                  : useInvoiceFromList
                    ? "Mesmo valor do subtotal do grupo deste cartão na lista de movimentos."
                    : "Soma das compras registradas no app para este mês de referência (cada parcela conta no mês da data da parcela)."}
              </p>
            </>
          )}
        </div>

        {fundingPlans && fundingPlans.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Meses já planejados:</span>
            {fundingPlans.map((m) => (
              <Button
                key={m.statementMonth}
                type="button"
                variant={statementMonth === m.statementMonth ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setStatementMonth(m.statementMonth)}
              >
                {formatYearMonthLabel(m.statementMonth)}
              </Button>
            ))}
          </div>
        ) : null}

        <div className="space-y-3">
          <Label>Fonte por compra</Label>

          {!STATEMENT_MONTH_RE.test(statementMonth.trim()) ? (
            <p className="text-sm text-muted-foreground">Informe o mês da fatura para listar as compras.</p>
          ) : funding.isFetching && invoiceLines === null ? (
            <p className="text-sm text-muted-foreground">Carregando compras…</p>
          ) : funding.isError && invoiceLines === null ? (
            <p className="text-sm text-destructive">Não foi possível carregar a lista de compras.</p>
          ) : invoiceLines && invoiceLines.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma compra neste mês de fatura.</p>
          ) : invoiceLines && invoiceLines.length > 0 ? (
            <div className="max-h-[min(24rem,50dvh)] space-y-2 overflow-y-auto pr-0.5">
              {invoiceLines.map((line) => {
                const inst = installmentShortLabel(line.installmentNumber, line.installmentCount);
                const assignment = assignments[line.id] ?? { targetType: "account" as const, pocketId: "" };
                return (
                  <div
                    key={line.id}
                    className="min-w-0 rounded-lg border border-border/80 bg-muted/20 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="wrap-break-word font-medium leading-snug text-foreground">{line.title}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {formatDisplayDate(line.purchaseDate)}
                          {inst ? ` · ${inst} parcelas` : null}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                        {formatCurrency(line.amount)}
                      </span>
                    </div>
                    <div
                      className={`mt-3 grid grid-cols-1 gap-3 ${assignment.targetType === "pocket" ? "sm:grid-cols-2" : ""}`}
                    >
                      <div className="min-w-0">
                        <Label className="text-xs">Pagar com</Label>
                        <SelectOptions
                          className="w-full min-w-0"
                          value={assignment.targetType}
                          onValueChange={(v) =>
                            updateAssignment(line.id, { targetType: v as "account" | "pocket" })
                          }
                          options={[
                            { value: "account", label: "Conta corrente" },
                            { value: "pocket", label: "Caixinha" },
                          ]}
                        />
                      </div>
                      {assignment.targetType === "pocket" ? (
                        <div className="min-w-0">
                          <Label className="text-xs">Caixinha</Label>
                          <SelectOptions
                            className="w-full min-w-0"
                            value={assignment.pocketId}
                            onValueChange={(v) => updateAssignment(line.id, { pocketId: v })}
                            options={pocketOptions}
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          {sourceSummary.length > 0 && invoiceTotal != null && invoiceTotal > DEPOSIT_SUM_EPS ? (
            <div className="rounded-lg border border-border/60 bg-background/80 px-3 py-2.5">
              <p className="text-xs font-medium text-muted-foreground">Resumo por fonte</p>
              <ul className="mt-1.5 space-y-1 text-sm">
                {sourceSummary.map((row) => (
                  <li key={row.label} className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="text-foreground">{row.label}</span>
                    <span className="tabular-nums font-medium text-foreground">
                      {formatCurrency(row.amount)}
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                        ({((row.amount / invoiceTotal) * 100).toFixed(0)}%)
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            className="h-auto min-h-9 w-full justify-center px-2 text-destructive hover:text-destructive sm:w-auto sm:justify-start"
            onClick={() => void removePlan()}
            disabled={replaceFunding.isPending || !fundingPlans?.some((m) => m.statementMonth === statementMonth)}
          >
            Remover plano deste mês
          </Button>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="button"
              className="w-full sm:w-auto"
              onClick={() => void save()}
              disabled={replaceFunding.isPending || !hasPurchases}
            >
              {replaceFunding.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
