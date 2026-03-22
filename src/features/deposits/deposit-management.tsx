"use client";

import { Pencil, PiggyBank, Plus, Repeat, Trash2 } from "lucide-react";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import {
  useCreateDeposit,
  useCreateRecurringDeposit,
  useCurrentUser,
  useDeleteDeposit,
  useDeleteRecurringDeposit,
  useDeposits,
  usePockets,
  type DepositRow,
  type RecurringDepositRow,
  useRecurringDeposits,
  useRunRecurring,
  useUpdateDeposit,
  useUpdateRecurringDeposit,
} from "@/shared/hooks/use-app-data";
import { DEPOSIT_SUM_EPS, PERCENT_SUM_EPS, amountsToPercents, distributeAmountsByPercent } from "@/shared/lib/deposit-split";
import { formatCurrency, formatDisplayDate, toInputDate } from "@/shared/utils/formatters";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { CurrencyInput } from "@/shared/ui/currency-input";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Modal } from "@/shared/ui/modal";
import { SelectOptions } from "@/shared/ui/select-options";
import { cn } from "@/shared/lib/cn";

const TARGET_LABEL: Record<"account" | "pocket", string> = {
  account: "Conta corrente",
  pocket: "Caixinha",
};

const manualBaseSchema = z.object({
  title: z.string().min(1),
  amount: z.number().positive(),
  depositDate: z.string().min(1),
});

const recurringBaseSchema = z.object({
  title: z.string().min(1),
  amount: z.number().positive(),
  nextExecutionDate: z.string().min(1),
});

type AllocationMode = "amount" | "percent";

type SplitRowDraft = {
  uid: string;
  targetType: "account" | "pocket";
  pocketId: string;
  amount: number;
  percent: number;
};

function newSplitRow(partial?: Partial<SplitRowDraft>): SplitRowDraft {
  return {
    uid: crypto.randomUUID(),
    targetType: "account",
    pocketId: "",
    amount: 0,
    percent: 0,
    ...partial,
  };
}

function defaultManualRows(total: number): SplitRowDraft[] {
  return [newSplitRow({ targetType: "account", percent: 100, amount: total })];
}

function defaultRecurringRows(): SplitRowDraft[] {
  return [newSplitRow({ targetType: "account", percent: 100, amount: 0 })];
}

function formatPctPt(value: number) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(value);
}

function formatSplitsSummary(
  splits: Array<{ targetType: string; pocketName?: string | null; amount: number; percent?: number }>,
  mode: "deposit" | "recurring"
) {
  if (splits.length === 0) return "—";
  return splits
    .map((s) => {
      if (mode === "recurring" && s.percent != null) {
        return s.targetType === "account"
          ? `Conta ${Number(s.percent).toFixed(0)}%`
          : `Caixinha ${s.pocketName ?? "?"} ${Number(s.percent).toFixed(0)}%`;
      }
      return s.targetType === "account"
        ? `Conta ${formatCurrency(s.amount)}`
        : `Caixinha ${s.pocketName ?? "?"} ${formatCurrency(s.amount)}`;
    })
    .join(" · ");
}

type TabId = "manual" | "recurring";

export function DepositManagement() {
  const deposits = useDeposits();
  const recurring = useRecurringDeposits();
  const pockets = usePockets();
  const createDeposit = useCreateDeposit();
  const updateDeposit = useUpdateDeposit();
  const deleteDeposit = useDeleteDeposit();
  const createRecurring = useCreateRecurringDeposit();
  const updateRecurring = useUpdateRecurringDeposit();
  const deleteRecurring = useDeleteRecurringDeposit();
  const runRecurring = useRunRecurring();
  const currentUser = useCurrentUser();

  const [activeTab, setActiveTab] = useState<TabId>("manual");
  const [openCreate, setOpenCreate] = useState(false);
  const [editingManualDeposit, setEditingManualDeposit] = useState<DepositRow | null>(null);
  const [deletingManualDeposit, setDeletingManualDeposit] = useState<DepositRow | null>(null);
  const [openRecurringCreate, setOpenRecurringCreate] = useState(false);
  const [editingItem, setEditingItem] = useState<RecurringDepositRow | null>(null);
  const [deletingItem, setDeletingItem] = useState<RecurringDepositRow | null>(null);

  const [manualMode, setManualMode] = useState<AllocationMode>("amount");
  const [manualRows, setManualRows] = useState<SplitRowDraft[]>(() => defaultManualRows(0));

  const [recurringMode, setRecurringMode] = useState<AllocationMode>("percent");
  const [recurringRows, setRecurringRows] = useState<SplitRowDraft[]>(defaultRecurringRows);

  const manualForm = useForm<z.infer<typeof manualBaseSchema>>({
    resolver: zodResolver(manualBaseSchema),
    defaultValues: {
      title: "",
      amount: 0,
      depositDate: toInputDate(new Date()),
    },
  });

  const recurringForm = useForm<z.infer<typeof recurringBaseSchema>>({
    resolver: zodResolver(recurringBaseSchema),
    defaultValues: {
      title: "",
      amount: 0,
      nextExecutionDate: toInputDate(new Date()),
    },
  });

  const pocketOptions = (pockets.data ?? []).map((p) => ({ value: p.id, label: p.name }));

  const openManualModal = () => {
    setEditingManualDeposit(null);
    manualForm.reset({
      title: "",
      amount: 0,
      depositDate: toInputDate(new Date()),
    });
    setManualMode("amount");
    setManualRows(defaultManualRows(0));
    setOpenCreate(true);
  };

  const openEditManualDeposit = (deposit: DepositRow) => {
    setEditingManualDeposit(deposit);
    manualForm.reset({
      title: deposit.title,
      amount: deposit.amount,
      depositDate: deposit.depositDate,
    });
    setManualMode("amount");
    if (deposit.splits.length > 0) {
      setManualRows(
        deposit.splits.map((s) =>
          newSplitRow({
            targetType: s.targetType,
            pocketId: s.pocketId ?? "",
            amount: s.amount,
            percent: deposit.amount > 0 ? (s.amount / deposit.amount) * 100 : 0,
          })
        )
      );
    } else {
      setManualRows(defaultManualRows(deposit.amount));
    }
    setOpenCreate(true);
  };

  const buildManualSplits = (total: number): { targetType: "account" | "pocket"; pocketId?: string; amount: number }[] => {
    if (manualMode === "percent") {
      const percents = manualRows.map((r) => r.percent);
      const sumP = percents.reduce((a, b) => a + b, 0);
      if (Math.abs(sumP - 100) > PERCENT_SUM_EPS) {
        throw new Error("A soma dos percentuais deve ser 100%.");
      }
      for (const r of manualRows) {
        if (r.targetType === "pocket" && !r.pocketId.trim()) throw new Error("Selecione a caixinha em cada linha.");
      }
      const amounts = distributeAmountsByPercent(total, percents);
      return manualRows.map((r, i) => ({
        targetType: r.targetType,
        pocketId: r.targetType === "pocket" ? r.pocketId : undefined,
        amount: amounts[i] ?? 0,
      }));
    }
    const amounts = manualRows.map((r) => r.amount);
    const sumA = amounts.reduce((a, b) => a + b, 0);
    if (Math.abs(sumA - total) > DEPOSIT_SUM_EPS) {
      throw new Error("A soma dos valores deve ser igual ao total do depósito.");
    }
    for (const r of manualRows) {
      if (r.targetType === "pocket" && !r.pocketId.trim()) throw new Error("Selecione a caixinha em cada linha.");
    }
    return manualRows.map((r, i) => ({
      targetType: r.targetType,
      pocketId: r.targetType === "pocket" ? r.pocketId : undefined,
      amount: amounts[i] ?? 0,
    }));
  };

  const onManualSubmit = manualForm.handleSubmit(async (values) => {
    if (!currentUser.data?.id) return;
    try {
      const splits = buildManualSplits(values.amount);
      if (editingManualDeposit) {
        await updateDeposit.mutateAsync({
          id: editingManualDeposit.id,
          title: values.title,
          amount: values.amount,
          depositDate: values.depositDate,
          splits,
        });
        toast.success("Depósito atualizado");
      } else {
        await createDeposit.mutateAsync({
          title: values.title,
          amount: values.amount,
          depositDate: values.depositDate,
          createdByUserId: currentUser.data.id,
          splits,
        });
        toast.success("Depósito registrado");
      }
      setOpenCreate(false);
      setEditingManualDeposit(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    }
  });

  const onConfirmDeleteManual = async () => {
    if (!deletingManualDeposit) return;
    try {
      await deleteDeposit.mutateAsync(deletingManualDeposit.id);
      toast.success("Depósito excluído");
      setDeletingManualDeposit(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível excluir.");
    }
  };

  const buildRecurringPercents = (total: number): { targetType: "account" | "pocket"; pocketId?: string; percent: number }[] => {
    for (const r of recurringRows) {
      if (r.targetType === "pocket" && !r.pocketId.trim()) throw new Error("Selecione a caixinha em cada linha.");
    }
    if (recurringMode === "percent") {
      const percents = recurringRows.map((r) => r.percent);
      const sumP = percents.reduce((a, b) => a + b, 0);
      if (Math.abs(sumP - 100) > PERCENT_SUM_EPS) {
        throw new Error("A soma dos percentuais deve ser 100%.");
      }
      return recurringRows.map((r, i) => ({
        targetType: r.targetType,
        pocketId: r.targetType === "pocket" ? r.pocketId : undefined,
        percent: percents[i] ?? 0,
      }));
    }
    const amounts = recurringRows.map((r) => r.amount);
    const sumA = amounts.reduce((a, b) => a + b, 0);
    if (Math.abs(sumA - total) > DEPOSIT_SUM_EPS) {
      throw new Error("A soma dos valores deve ser igual ao total.");
    }
    const percents = amountsToPercents(total, amounts);
    return recurringRows.map((r, i) => ({
      targetType: r.targetType,
      pocketId: r.targetType === "pocket" ? r.pocketId : undefined,
      percent: percents[i] ?? 0,
    }));
  };

  const onRecurringSubmit = recurringForm.handleSubmit(async (values) => {
    if (!currentUser.data?.id) return;
    try {
      const splits = buildRecurringPercents(values.amount);
      await createRecurring.mutateAsync({
        title: values.title,
        amount: values.amount,
        recurrenceType: "monthly",
        nextExecutionDate: values.nextExecutionDate,
        createdByUserId: currentUser.data.id,
        splits,
      });
      toast.success("Depósito recorrente criado");
      setOpenRecurringCreate(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    }
  });

  const openEdit = (item: RecurringDepositRow) => {
    setEditingItem(item);
    recurringForm.reset({
      title: item.title,
      amount: item.amount,
      nextExecutionDate: item.nextExecutionDate,
    });
    setRecurringMode("percent");
    if (item.splits.length > 0) {
      const amounts = distributeAmountsByPercent(
        item.amount,
        item.splits.map((x) => x.percent)
      );
      setRecurringRows(
        item.splits.map((s, i) =>
          newSplitRow({
            targetType: s.targetType,
            pocketId: s.pocketId ?? "",
            percent: s.percent,
            amount: amounts[i] ?? 0,
          })
        )
      );
    } else {
      setRecurringRows(defaultRecurringRows());
    }
  };

  const onEditSubmit = recurringForm.handleSubmit(async (values) => {
    if (!editingItem) return;
    try {
      const splits = buildRecurringPercents(values.amount);
      await updateRecurring.mutateAsync({
        id: editingItem.id,
        title: values.title,
        amount: values.amount,
        nextExecutionDate: values.nextExecutionDate,
        splits,
      });
      toast.success("Depósito recorrente atualizado");
      setEditingItem(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    }
  });

  const onConfirmDelete = async () => {
    if (!deletingItem) return;
    await deleteRecurring.mutateAsync(deletingItem.id);
    toast.success("Depósito recorrente removido");
    setDeletingItem(null);
  };

  const onRunRecurring = async () => {
    await runRecurring.mutateAsync();
    toast.success("Recorrentes processados");
  };

  const totalManual = manualForm.watch("amount") ?? 0;
  const totalRecurring = recurringForm.watch("amount") ?? 0;

  const manualSumAmount = manualRows.reduce((a, r) => a + r.amount, 0);
  const manualSumPercent = manualRows.reduce((a, r) => a + r.percent, 0);
  const manualPreviewAmountsFromPercent =
    totalManual > 0 && manualMode === "percent"
      ? distributeAmountsByPercent(
          totalManual,
          manualRows.map((r) => r.percent)
        )
      : [];
  const recurringSumAmount = recurringRows.reduce((a, r) => a + r.amount, 0);
  const recurringSumPercent = recurringRows.reduce((a, r) => a + r.percent, 0);

  const list = recurring.data ?? [];
  const depositList = deposits.data ?? [];

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col gap-4 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex min-w-0 flex-wrap gap-1">
            <button
              type="button"
              onClick={() => setActiveTab("manual")}
              className={cn(
                "rounded-md px-2.5 py-2 text-sm font-medium transition-colors sm:px-3",
                activeTab === "manual"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              Depósitos avulsos
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("recurring")}
              className={cn(
                "rounded-md px-2.5 py-2 text-sm font-medium transition-colors sm:px-3",
                activeTab === "recurring"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              Depósitos recorrentes
            </button>
          </div>
          <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
            {activeTab === "manual" ? (
              <Button className="w-full sm:w-auto" onClick={openManualModal}>
                Novo depósito
              </Button>
            ) : (
              <>
                <Button
                  className="w-full sm:w-auto"
                  onClick={() => {
                    recurringForm.reset({
                      title: "",
                      amount: 0,
                      nextExecutionDate: toInputDate(new Date()),
                    });
                    setRecurringMode("percent");
                    setRecurringRows(defaultRecurringRows());
                    setOpenRecurringCreate(true);
                  }}
                >
                  Novo depósito recorrente
                </Button>
                <Button
                  className="w-full sm:w-auto"
                  variant="outline"
                  onClick={onRunRecurring}
                  disabled={runRecurring.isPending}
                >
                  {runRecurring.isPending ? "Executando..." : "Executar agora"}
                </Button>
              </>
            )}
          </div>
        </div>

        <Modal
          open={openCreate}
          onClose={() => {
            setOpenCreate(false);
            setEditingManualDeposit(null);
          }}
          title={editingManualDeposit ? "Editar depósito" : "Novo depósito"}
          size="lg"
        >
          <form onSubmit={onManualSubmit} className="space-y-4">
            <div>
              <Label htmlFor="dep-title">Título</Label>
              <Input id="dep-title" placeholder="Ex: Salário, bônus" {...manualForm.register("title")} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label>Valor total</Label>
                <CurrencyInput
                  value={manualForm.watch("amount") ?? 0}
                  onChange={(v) => {
                    manualForm.setValue("amount", v);
                    if (manualMode === "amount" && manualRows.length === 1) {
                      setManualRows((rows) =>
                        rows.map((r) => ({ ...r, amount: v, percent: 100 }))
                      );
                    }
                  }}
                />
              </div>
              <div>
                <Label>Data</Label>
                <Input type="date" {...manualForm.register("depositDate")} />
              </div>
            </div>
            <div>
              <Label>Como dividir</Label>
              <SelectOptions
                value={manualMode}
                onValueChange={(v) => setManualMode(v as AllocationMode)}
                options={[
                  { value: "amount", label: "Valores em reais (R$)" },
                  { value: "percent", label: "Percentuais (%)" },
                ]}
              />
            </div>
            <div className="space-y-3 rounded-md border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Destinos</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => setManualRows((r) => [...r, newSplitRow()])}
                >
                  <Plus className="h-4 w-4" />
                  Adicionar
                </Button>
              </div>
              {manualRows.map((row, rowIndex) => {
                const showManualCross =
                  manualRows.length > 1 && totalManual > 0;
                const pctOfTotal =
                  manualMode === "amount" && totalManual > 0
                    ? (row.amount / totalManual) * 100
                    : null;
                const brlFromPercent =
                  manualMode === "percent" && manualPreviewAmountsFromPercent.length === manualRows.length
                    ? (manualPreviewAmountsFromPercent[rowIndex] ?? 0)
                    : null;

                return (
                <div key={row.uid} className="space-y-2 rounded-md bg-muted/30 p-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 sm:items-end">
                  <div className="sm:col-span-4">
                    <Label className="text-xs">Destino</Label>
                    <SelectOptions
                      value={row.targetType}
                      onValueChange={(v) => {
                        const t = v as "account" | "pocket";
                        setManualRows((rows) =>
                          rows.map((x) => (x.uid === row.uid ? { ...x, targetType: t, pocketId: t === "account" ? "" : x.pocketId } : x))
                        );
                      }}
                      options={[
                        { value: "account", label: TARGET_LABEL.account },
                        { value: "pocket", label: TARGET_LABEL.pocket },
                      ]}
                    />
                  </div>
                  {row.targetType === "pocket" && (
                    <div className="sm:col-span-4">
                      <Label className="text-xs">Caixinha</Label>
                      <SelectOptions
                        value={row.pocketId}
                        onValueChange={(v) =>
                          setManualRows((rows) => rows.map((x) => (x.uid === row.uid ? { ...x, pocketId: v } : x)))
                        }
                        options={pocketOptions}
                      />
                    </div>
                  )}
                  <div className={row.targetType === "pocket" ? "sm:col-span-3" : "sm:col-span-7"}>
                    {manualMode === "amount" ? (
                      <>
                        <Label className="text-xs">Valor (R$)</Label>
                        <CurrencyInput
                          value={row.amount}
                          onChange={(v) =>
                            setManualRows((rows) => rows.map((x) => (x.uid === row.uid ? { ...x, amount: v } : x)))
                          }
                        />
                      </>
                    ) : (
                      <>
                        <Label className="text-xs">Percentual (%)</Label>
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={row.percent || ""}
                          onChange={(e) => {
                            const n = Number.parseFloat(e.target.value);
                            setManualRows((rows) =>
                              rows.map((x) => (x.uid === row.uid ? { ...x, percent: Number.isFinite(n) ? n : 0 } : x))
                            );
                          }}
                        />
                      </>
                    )}
                  </div>
                  <div className="flex justify-end sm:col-span-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      disabled={manualRows.length <= 1}
                      onClick={() => setManualRows((rows) => rows.filter((x) => x.uid !== row.uid))}
                      aria-label="Remover linha"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  </div>
                  {showManualCross && (
                    <p className="text-xs text-muted-foreground">
                      {manualMode === "amount" && pctOfTotal != null && (
                        <>
                          Equivale a <span className="font-medium text-foreground">{formatPctPt(pctOfTotal)}%</span> do
                          valor total
                        </>
                      )}
                      {manualMode === "percent" && brlFromPercent != null && (
                        <>
                          Equivale a <span className="font-medium text-foreground">{formatCurrency(brlFromPercent)}</span>{" "}
                          neste destino
                        </>
                      )}
                    </p>
                  )}
                </div>
                );
              })}
              <p className="text-xs text-muted-foreground">
                {manualMode === "amount" ? (
                  <>
                    Soma das partes: <strong>{formatCurrency(manualSumAmount)}</strong> · Total:{" "}
                    <strong>{formatCurrency(totalManual)}</strong>
                    {Math.abs(manualSumAmount - totalManual) > DEPOSIT_SUM_EPS && (
                      <span className="text-destructive"> — ajuste para coincidir</span>
                    )}
                  </>
                ) : (
                  <>
                    Soma dos %: <strong>{manualSumPercent.toFixed(2)}%</strong>
                    {Math.abs(manualSumPercent - 100) > PERCENT_SUM_EPS && (
                      <span className="text-destructive"> — deve somar 100%</span>
                    )}
                  </>
                )}
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setOpenCreate(false);
                  setEditingManualDeposit(null);
                }}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={createDeposit.isPending || updateDeposit.isPending}>
                {createDeposit.isPending || updateDeposit.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </form>
        </Modal>

        <Modal
          open={!!deletingManualDeposit}
          onClose={() => setDeletingManualDeposit(null)}
          title="Excluir depósito"
          size="sm"
        >
          <div className="space-y-4">
            {deletingManualDeposit && (
              <p className="text-sm text-muted-foreground">
                Tem certeza que deseja excluir <strong className="text-foreground">{deletingManualDeposit.title}</strong>{" "}
                ({formatCurrency(deletingManualDeposit.amount)})? O saldo da conta e das caixinhas será revertido conforme
                este lançamento.
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDeletingManualDeposit(null)}>
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={onConfirmDeleteManual}
                disabled={deleteDeposit.isPending}
              >
                {deleteDeposit.isPending ? "Excluindo..." : "Excluir"}
              </Button>
            </div>
          </div>
        </Modal>

        <Modal
          open={openRecurringCreate}
          onClose={() => setOpenRecurringCreate(false)}
          title="Novo depósito recorrente"
          size="lg"
        >
          <form onSubmit={onRecurringSubmit} className="space-y-4">
            <div>
              <Label htmlFor="rec-dep-title">Título</Label>
              <Input id="rec-dep-title" placeholder="Ex: Salário, mesada" {...recurringForm.register("title")} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label>Valor total (mensal)</Label>
                <CurrencyInput
                  value={recurringForm.watch("amount") ?? 0}
                  onChange={(v) => {
                    recurringForm.setValue("amount", v);
                    if (recurringMode === "amount" && recurringRows.length === 1) {
                      setRecurringRows((rows) => rows.map((r) => ({ ...r, amount: v, percent: 100 })));
                    }
                  }}
                />
              </div>
              <div>
                <Label>Próxima execução</Label>
                <Input type="date" {...recurringForm.register("nextExecutionDate")} />
              </div>
            </div>
            <div>
              <Label>Como dividir o valor mensal</Label>
              <SelectOptions
                value={recurringMode}
                onValueChange={(v) => setRecurringMode(v as AllocationMode)}
                options={[
                  { value: "amount", label: "Valores em reais (R$)" },
                  { value: "percent", label: "Percentuais (%)" },
                ]}
              />
            </div>
            <div className="space-y-3 rounded-md border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Destinos</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => setRecurringRows((r) => [...r, newSplitRow()])}
                >
                  <Plus className="h-4 w-4" />
                  Adicionar
                </Button>
              </div>
              {recurringRows.map((row) => (
                <div
                  key={row.uid}
                  className="grid grid-cols-1 gap-3 rounded-md bg-muted/30 p-3 sm:grid-cols-12 sm:items-end"
                >
                  <div className="sm:col-span-4">
                    <Label className="text-xs">Destino</Label>
                    <SelectOptions
                      value={row.targetType}
                      onValueChange={(v) => {
                        const t = v as "account" | "pocket";
                        setRecurringRows((rows) =>
                          rows.map((x) => (x.uid === row.uid ? { ...x, targetType: t, pocketId: t === "account" ? "" : x.pocketId } : x))
                        );
                      }}
                      options={[
                        { value: "account", label: TARGET_LABEL.account },
                        { value: "pocket", label: TARGET_LABEL.pocket },
                      ]}
                    />
                  </div>
                  {row.targetType === "pocket" && (
                    <div className="sm:col-span-4">
                      <Label className="text-xs">Caixinha</Label>
                      <SelectOptions
                        value={row.pocketId}
                        onValueChange={(v) =>
                          setRecurringRows((rows) => rows.map((x) => (x.uid === row.uid ? { ...x, pocketId: v } : x)))
                        }
                        options={pocketOptions}
                      />
                    </div>
                  )}
                  <div className={row.targetType === "pocket" ? "sm:col-span-3" : "sm:col-span-7"}>
                    {recurringMode === "amount" ? (
                      <>
                        <Label className="text-xs">Valor (R$)</Label>
                        <CurrencyInput
                          value={row.amount}
                          onChange={(v) =>
                            setRecurringRows((rows) => rows.map((x) => (x.uid === row.uid ? { ...x, amount: v } : x)))
                          }
                        />
                      </>
                    ) : (
                      <>
                        <Label className="text-xs">Percentual (%)</Label>
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={row.percent || ""}
                          onChange={(e) => {
                            const n = Number.parseFloat(e.target.value);
                            setRecurringRows((rows) =>
                              rows.map((x) => (x.uid === row.uid ? { ...x, percent: Number.isFinite(n) ? n : 0 } : x))
                            );
                          }}
                        />
                      </>
                    )}
                  </div>
                  <div className="flex justify-end sm:col-span-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      disabled={recurringRows.length <= 1}
                      onClick={() => setRecurringRows((rows) => rows.filter((x) => x.uid !== row.uid))}
                      aria-label="Remover linha"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                {recurringMode === "amount" ? (
                  <>
                    Soma: <strong>{formatCurrency(recurringSumAmount)}</strong> · Total:{" "}
                    <strong>{formatCurrency(totalRecurring)}</strong>
                    {Math.abs(recurringSumAmount - totalRecurring) > DEPOSIT_SUM_EPS && (
                      <span className="text-destructive"> — ajuste para coincidir</span>
                    )}
                  </>
                ) : (
                  <>
                    Soma dos %: <strong>{recurringSumPercent.toFixed(2)}%</strong>
                    {Math.abs(recurringSumPercent - 100) > PERCENT_SUM_EPS && (
                      <span className="text-destructive"> — deve somar 100%</span>
                    )}
                  </>
                )}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Os percentuais são salvos e aplicados todo mês sobre o valor total acima. Use &quot;Executar agora&quot; para
              processar vencimentos.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpenRecurringCreate(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createRecurring.isPending}>
                {createRecurring.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </form>
        </Modal>

        <Modal
          open={!!editingItem}
          onClose={() => setEditingItem(null)}
          title="Editar depósito recorrente"
          size="lg"
        >
          <form onSubmit={onEditSubmit} className="space-y-4">
            <div>
              <Label htmlFor="edit-rec-dep-title">Título</Label>
              <Input id="edit-rec-dep-title" {...recurringForm.register("title")} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label>Valor total (mensal)</Label>
                <CurrencyInput
                  value={recurringForm.watch("amount") ?? 0}
                  onChange={(v) => recurringForm.setValue("amount", v)}
                />
              </div>
              <div>
                <Label>Próxima execução</Label>
                <Input type="date" {...recurringForm.register("nextExecutionDate")} />
              </div>
            </div>
            <div>
              <Label>Como dividir o valor mensal</Label>
              <SelectOptions
                value={recurringMode}
                onValueChange={(v) => setRecurringMode(v as AllocationMode)}
                options={[
                  { value: "amount", label: "Valores em reais (R$)" },
                  { value: "percent", label: "Percentuais (%)" },
                ]}
              />
            </div>
            <div className="space-y-3 rounded-md border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Destinos</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => setRecurringRows((r) => [...r, newSplitRow()])}
                >
                  <Plus className="h-4 w-4" />
                  Adicionar
                </Button>
              </div>
              {recurringRows.map((row) => (
                <div
                  key={row.uid}
                  className="grid grid-cols-1 gap-3 rounded-md bg-muted/30 p-3 sm:grid-cols-12 sm:items-end"
                >
                  <div className="sm:col-span-4">
                    <Label className="text-xs">Destino</Label>
                    <SelectOptions
                      value={row.targetType}
                      onValueChange={(v) => {
                        const t = v as "account" | "pocket";
                        setRecurringRows((rows) =>
                          rows.map((x) => (x.uid === row.uid ? { ...x, targetType: t, pocketId: t === "account" ? "" : x.pocketId } : x))
                        );
                      }}
                      options={[
                        { value: "account", label: TARGET_LABEL.account },
                        { value: "pocket", label: TARGET_LABEL.pocket },
                      ]}
                    />
                  </div>
                  {row.targetType === "pocket" && (
                    <div className="sm:col-span-4">
                      <Label className="text-xs">Caixinha</Label>
                      <SelectOptions
                        value={row.pocketId}
                        onValueChange={(v) =>
                          setRecurringRows((rows) => rows.map((x) => (x.uid === row.uid ? { ...x, pocketId: v } : x)))
                        }
                        options={pocketOptions}
                      />
                    </div>
                  )}
                  <div className={row.targetType === "pocket" ? "sm:col-span-3" : "sm:col-span-7"}>
                    {recurringMode === "amount" ? (
                      <>
                        <Label className="text-xs">Valor (R$)</Label>
                        <CurrencyInput
                          value={row.amount}
                          onChange={(v) =>
                            setRecurringRows((rows) => rows.map((x) => (x.uid === row.uid ? { ...x, amount: v } : x)))
                          }
                        />
                      </>
                    ) : (
                      <>
                        <Label className="text-xs">Percentual (%)</Label>
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={row.percent || ""}
                          onChange={(e) => {
                            const n = Number.parseFloat(e.target.value);
                            setRecurringRows((rows) =>
                              rows.map((x) => (x.uid === row.uid ? { ...x, percent: Number.isFinite(n) ? n : 0 } : x))
                            );
                          }}
                        />
                      </>
                    )}
                  </div>
                  <div className="flex justify-end sm:col-span-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      disabled={recurringRows.length <= 1}
                      onClick={() => setRecurringRows((rows) => rows.filter((x) => x.uid !== row.uid))}
                      aria-label="Remover linha"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setEditingItem(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={updateRecurring.isPending}>
                {updateRecurring.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </form>
        </Modal>

        <Modal
          open={!!deletingItem}
          onClose={() => setDeletingItem(null)}
          title="Excluir depósito recorrente"
          size="sm"
        >
          <div className="space-y-4">
            {deletingItem && (
              <p className="text-sm text-muted-foreground">
                Tem certeza que deseja excluir <strong className="text-foreground">{deletingItem.title}</strong> (
                {formatCurrency(deletingItem.amount)})? Os depósitos já gerados permanecem no histórico.
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDeletingItem(null)}>
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={onConfirmDelete}
                disabled={deleteRecurring.isPending}
              >
                {deleteRecurring.isPending ? "Excluindo..." : "Excluir"}
              </Button>
            </div>
          </div>
        </Modal>

        {activeTab === "manual" ? (
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Histórico de depósitos</CardTitle>
            <p className="text-sm text-muted-foreground">Inclusões manuais e geradas por recorrência.</p>
          </CardHeader>
        ) : (
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Regras mensais</CardTitle>
            <p className="text-sm text-muted-foreground">
              Valores creditados automaticamente conforme a divisão configurada.
            </p>
          </CardHeader>
        )}

        <CardContent>
          {activeTab === "manual" ? (
            deposits.isLoading ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <p className="text-sm text-muted-foreground">Carregando...</p>
              </div>
            ) : depositList.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
                <div className="rounded-full bg-muted p-4">
                  <PiggyBank className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="font-medium text-foreground">Nenhum depósito ainda</p>
                <Button onClick={openManualModal}>Novo depósito</Button>
              </div>
            ) : (
              <ul className="space-y-3">
                {depositList.map((deposit) => {
                  const dest = formatSplitsSummary(
                    deposit.splits.map((s) => ({
                      targetType: s.targetType,
                      pocketName: s.pocketName,
                      amount: s.amount,
                    })),
                    "deposit"
                  );
                  return (
                    <li key={deposit.id}>
                      <Card className="overflow-hidden transition-colors hover:bg-muted/30">
                        <CardContent className="p-4">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-foreground">{deposit.title}</p>
                              <p className="text-sm text-muted-foreground">
                                {formatDisplayDate(deposit.depositDate)} · {dest}
                                {deposit.recurringDepositId && (
                                  <span className="ml-1 text-xs">(recorrente)</span>
                                )}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-3">
                              <p className="text-lg font-semibold tabular-nums text-foreground">
                                {formatCurrency(deposit.amount)}
                              </p>
                              <div className="flex items-center gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => openEditManualDeposit(deposit)}
                                  aria-label="Editar depósito"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                  onClick={() => setDeletingManualDeposit(deposit)}
                                  aria-label="Excluir depósito"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            )
          ) : recurring.isLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">Carregando...</p>
            </div>
          ) : list.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
              <div className="rounded-full bg-muted p-4">
                <Repeat className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="font-medium text-foreground">Nenhum depósito recorrente</p>
              <p className="text-sm text-muted-foreground">
                Cadastre entradas fixas mensais divididas entre conta e caixinhas.
              </p>
              <Button
                onClick={() => {
                  recurringForm.reset({
                    title: "",
                    amount: 0,
                    nextExecutionDate: toInputDate(new Date()),
                  });
                  setRecurringMode("percent");
                  setRecurringRows(defaultRecurringRows());
                  setOpenRecurringCreate(true);
                }}
              >
                Novo depósito recorrente
              </Button>
            </div>
          ) : (
            <ul className="space-y-3">
              {list.map((item) => (
                <li key={item.id}>
                  <Card className="overflow-hidden transition-colors hover:bg-muted/30">
                    <CardContent className="p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-foreground">{item.title}</p>
                          <p className="mt-0.5 text-sm text-muted-foreground">
                            Próxima execução: {formatDisplayDate(item.nextExecutionDate)}
                            <span className="mx-1.5">·</span>
                            <span>
                              {formatSplitsSummary(
                                item.splits.map((s) => ({
                                  targetType: s.targetType,
                                  pocketName: s.pocketName,
                                  amount: 0,
                                  percent: s.percent,
                                })),
                                "recurring"
                              )}
                            </span>
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <p className="text-lg font-semibold tabular-nums text-foreground">
                            {formatCurrency(item.amount)}
                          </p>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openEdit(item)}
                              aria-label="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => setDeletingItem(item)}
                              aria-label="Excluir"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
