"use client";

import { Plus, Trash2 } from "lucide-react";
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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/shared/ui/accordion";
import { Button } from "@/shared/ui/button";
import { CurrencyInput } from "@/shared/ui/currency-input";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Modal } from "@/shared/ui/modal";
import { SelectOptions } from "@/shared/ui/select-options";

export type CardStatementFundingTarget = {
  id: string;
  name: string;
};

type FundingSplitDraft = {
  uid: string;
  targetType: "account" | "pocket";
  pocketId: string;
  amount: number;
};

function newFundingRow(partial?: Partial<FundingSplitDraft>): FundingSplitDraft {
  return {
    uid: crypto.randomUUID(),
    targetType: "account",
    pocketId: "",
    amount: 0,
    ...partial,
  };
}

function defaultFundingRows(): FundingSplitDraft[] {
  return [newFundingRow({ targetType: "account", amount: 0 })];
}

function sharePercent(amount: number, total: number): number {
  if (total <= DEPOSIT_SUM_EPS) return 0;
  return (amount / total) * 100;
}

const STATEMENT_MONTH_RE = /^\d{4}-\d{2}$/;

function installmentShortLabel(installmentNumber: number | null, installmentCount: number | null): string | null {
  if (installmentCount != null && installmentCount > 1 && installmentNumber != null) {
    return `${installmentNumber}/${installmentCount}`;
  }
  return null;
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
  const [rowsOverride, setRowsOverride] = useState<FundingSplitDraft[] | null>(null);

  useEffect(() => {
    if (!open) return;
    setStatementMonthState(initialStatementMonth ?? format(new Date(), "yyyy-MM"));
    setRowsOverride(null);
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

  const rowsFromServer = useMemo(() => {
    if (!fundingPlans) return defaultFundingRows();
    const block = fundingPlans.find((x) => x.statementMonth === statementMonth);
    if (!block?.splits?.length) return defaultFundingRows();
    return block.splits.map((s) =>
      newFundingRow({
        targetType: s.targetType,
        pocketId: s.pocketId ?? "",
        amount: s.amount,
      })
    );
  }, [fundingPlans, statementMonth]);

  const rows = rowsOverride ?? rowsFromServer;

  const updateRows = useCallback(
    (fn: (current: FundingSplitDraft[]) => FundingSplitDraft[]) => {
      setRowsOverride((prev) => fn(prev ?? rowsFromServer));
    },
    [rowsFromServer]
  );

  const setStatementMonth = useCallback((ym: string) => {
    setStatementMonthState(ym);
    setRowsOverride(null);
  }, []);

  const pocketOptions = (pockets.data ?? []).map((p) => ({ value: p.id, label: p.name }));
  const sumTotal = rows.reduce((a, r) => a + r.amount, 0);
  const sumOk = sumTotal > DEPOSIT_SUM_EPS;
  const planDiffersFromInvoice =
    sumOk &&
    invoiceTotal != null &&
    invoiceTotal > DEPOSIT_SUM_EPS &&
    Math.abs(sumTotal - invoiceTotal) > DEPOSIT_SUM_EPS;

  const save = async () => {
    if (!card) return;
    if (!sumOk) {
      toast.error("A soma dos valores deve ser maior que zero.");
      return;
    }
    for (const r of rows) {
      if (r.amount < 0) {
        toast.error("Os valores não podem ser negativos.");
        return;
      }
      if (r.targetType === "pocket" && !r.pocketId.trim()) {
        toast.error("Selecione a caixinha em cada linha que vem de caixinha.");
        return;
      }
    }
    try {
      await replaceFunding.mutateAsync({
        cardId: card.id,
        statementMonth,
        splits: rows.map((r) => ({
          targetType: r.targetType,
          pocketId: r.targetType === "pocket" ? r.pocketId : undefined,
          amount: r.amount,
        })),
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
    <Modal open={open} onClose={onClose} title={`Pagamento da fatura — ${card.name}`} size="lg">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Para cada mês de referência da fatura, informe quanto pretende retirar de cada fonte (conta corrente e/ou
          caixinhas). Os percentuais abaixo de cada valor são calculados em relação ao total planejado. Pode haver um
          plano diferente por mês; cada cartão tem seus próprios planos.
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
                    ? "Mesmo valor do subtotal do grupo deste cartão na lista de movimentos (por fonte de pagamento)."
                    : "Soma das compras registradas no app para este mês de referência (cada parcela conta no mês da data da parcela)."}
              </p>
            </>
          )}
        </div>

        {STATEMENT_MONTH_RE.test(statementMonth.trim()) ? (
          <Accordion type="single" collapsible className="w-full overflow-hidden rounded-lg border border-border">
            <AccordionItem value="invoice-purchases" className="border-0">
              <AccordionTrigger className="px-3 py-3 text-sm hover:no-underline">
                <span className="text-left">
                  <span className="font-medium text-foreground">Compras nesta fatura</span>
                  {invoiceLines != null ? (
                    <span className="ml-2 text-xs font-normal text-muted-foreground tabular-nums">
                      ({invoiceLines.length} {invoiceLines.length === 1 ? "item" : "itens"})
                    </span>
                  ) : null}
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-3 pb-3 pt-0">
                {funding.isFetching && invoiceLines === null ? (
                  <p className="text-sm text-muted-foreground">Carregando compras…</p>
                ) : funding.isError && invoiceLines === null ? (
                  <p className="text-sm text-destructive">Não foi possível carregar a lista de compras.</p>
                ) : invoiceLines && invoiceLines.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma compra neste mês de fatura.</p>
                ) : invoiceLines && invoiceLines.length > 0 ? (
                  <ul className="max-h-56 space-y-2 overflow-y-auto pr-1 text-sm">
                    {invoiceLines.map((line) => {
                      const inst = installmentShortLabel(line.installmentNumber, line.installmentCount);
                      return (
                        <li
                          key={line.id}
                          className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-md border border-border/60 bg-background/80 px-2.5 py-2"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-medium leading-snug text-foreground">{line.title}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {formatDisplayDate(line.purchaseDate)}
                              {inst ? ` · ${inst} parcelas` : null}
                            </p>
                          </div>
                          <span className="shrink-0 tabular-nums font-semibold text-foreground">
                            {formatCurrency(line.amount)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        ) : null}

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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label>Valores por fonte (R$)</Label>
            <span className={`text-xs tabular-nums ${sumOk ? "text-muted-foreground" : "text-destructive"}`}>
              Total planejado: {formatCurrency(sumTotal)}
            </span>
          </div>
          {planDiffersFromInvoice && invoiceTotal != null ? (
            <p className="text-xs text-amber-800 dark:text-amber-200/90">
              O total planejado difere da fatura em {formatCurrency(sumTotal - invoiceTotal)} (fatura:{" "}
              {formatCurrency(invoiceTotal)}).
            </p>
          ) : null}
          <div className="space-y-2">
            {rows.map((row) => {
              const pct = sharePercent(row.amount, sumTotal);
              return (
                <div
                  key={row.uid}
                  className="grid grid-cols-1 gap-2 rounded-lg border border-border/80 bg-muted/20 p-3 sm:grid-cols-12 sm:items-start"
                >
                  <div className="sm:col-span-4">
                    <Label className="text-xs">Origem</Label>
                    <SelectOptions
                      value={row.targetType}
                      onValueChange={(v) =>
                        updateRows((prev) =>
                          prev.map((x) =>
                            x.uid === row.uid
                              ? { ...x, targetType: v as "account" | "pocket", pocketId: v === "account" ? "" : x.pocketId }
                              : x
                          )
                        )
                      }
                      options={[
                        { value: "account", label: "Conta corrente" },
                        { value: "pocket", label: "Caixinha" },
                      ]}
                    />
                  </div>
                  {row.targetType === "pocket" ? (
                    <div className="sm:col-span-4">
                      <Label className="text-xs">Caixinha</Label>
                      <SelectOptions
                        value={row.pocketId}
                        onValueChange={(v) =>
                          updateRows((prev) => prev.map((x) => (x.uid === row.uid ? { ...x, pocketId: v } : x)))
                        }
                        options={pocketOptions}
                      />
                    </div>
                  ) : (
                    <div className="hidden sm:col-span-4 sm:block" />
                  )}
                  <div className={row.targetType === "pocket" ? "sm:col-span-3" : "sm:col-span-7"}>
                    <Label className="text-xs">Valor (R$)</Label>
                    <CurrencyInput
                      value={row.amount}
                      onChange={(v) =>
                        updateRows((prev) => prev.map((x) => (x.uid === row.uid ? { ...x, amount: v } : x)))
                      }
                    />
                    <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">
                      {sumOk ? `${pct.toFixed(1)}% do total planejado` : "—"}
                      {sumOk && invoiceTotal != null && invoiceTotal > DEPOSIT_SUM_EPS ? (
                        <>
                          {" "}
                          · {sharePercent(row.amount, invoiceTotal).toFixed(1)}% da fatura
                        </>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex justify-end sm:col-span-1 sm:pt-5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0"
                      disabled={rows.length <= 1}
                      onClick={() => updateRows((prev) => prev.filter((x) => x.uid !== row.uid))}
                      aria-label="Remover linha"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
            onClick={() => updateRows((prev) => [...prev, newFundingRow({ amount: 0 })])}
          >
            <Plus className="mr-1 h-4 w-4" />
            Adicionar fonte
          </Button>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={() => void removePlan()}
            disabled={replaceFunding.isPending || !fundingPlans?.some((m) => m.statementMonth === statementMonth)}
          >
            Remover plano deste mês
          </Button>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void save()} disabled={replaceFunding.isPending || !sumOk}>
              {replaceFunding.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
