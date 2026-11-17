"use client";

import { Plus, Play, X } from "lucide-react";
import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { AnswerFigure, DayTile, LedgerGroup, LedgerRow, LedgerSkeleton } from "@/features/month/ledger";
import {
  currentMonthParam,
  dayOfMonth,
  daysFromToday,
  formatAmount,
  monthLabel,
  monthName,
  todayYmd,
} from "@/features/month/month-model";
import { PlaneBar, PlaneLegend } from "@/features/month/plane-bar";
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
import { CurrencyInput } from "@/shared/ui/currency-input";
import { Input } from "@/shared/ui/input";
import { Modal } from "@/shared/ui/modal";
import { Field, FormActions, PageHeader } from "@/shared/ui/page-header";
import { SelectOptions } from "@/shared/ui/select-options";
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/toggle-group";

const ACCOUNT_LABEL = "conta";

function splitLabel(targetType: string, pocketName?: string | null) {
  return targetType === "account" ? ACCOUNT_LABEL : (pocketName ?? "caixinha");
}

const pct = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

function nextWord(ymd: string, todayStr: string): string {
  const diff = daysFromToday(ymd, todayStr);
  if (diff < 0) return `atrasado desde ${formatDisplayDate(ymd).slice(0, 5)}`;
  if (diff === 0) return "hoje";
  if (diff === 1) return "amanhã";
  if (diff <= 31) return `em ${diff} dias`;
  return formatDisplayDate(ymd);
}

const TOGGLE_ITEM = "h-8 px-3 data-[state=on]:bg-foreground data-[state=on]:text-background";

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

type TabId = "manual" | "recurring";

/** Destinos do depósito: cada linha é conta ou uma caixinha, em R$ ou %; o plano mostra a divisão. */
function SplitEditor({
  mode,
  onModeChange,
  rows,
  onRowsChange,
  total,
  pocketOptions,
  pocketNames,
}: {
  mode: AllocationMode;
  onModeChange: (mode: AllocationMode) => void;
  rows: SplitRowDraft[];
  onRowsChange: (updater: (rows: SplitRowDraft[]) => SplitRowDraft[]) => void;
  total: number;
  pocketOptions: Array<{ value: string; label: string }>;
  pocketNames: Map<string, string>;
}) {
  const patch = (uid: string, next: Partial<SplitRowDraft>) =>
    onRowsChange((list) => list.map((x) => (x.uid === uid ? { ...x, ...next } : x)));
  const amounts = rows.map((r) => (mode === "amount" ? r.amount : (total * r.percent) / 100));
  const sumAmount = rows.reduce((a, r) => a + r.amount, 0);
  const sumPercent = rows.reduce((a, r) => a + r.percent, 0);
  const mismatch =
    mode === "amount" ? Math.abs(sumAmount - total) > DEPOSIT_SUM_EPS : Math.abs(sumPercent - 100) > PERCENT_SUM_EPS;
  const label = (r: SplitRowDraft) =>
    r.targetType === "account" ? ACCOUNT_LABEL : (pocketNames.get(r.pocketId) ?? "caixinha");

  return (
    <section>
      <div className="flex items-center justify-between gap-3 border-b-2 border-foreground pb-1.5">
        <h3 className="text-[15px] font-bold lowercase text-foreground">para onde vai</h3>
        <ToggleGroup
          type="single"
          value={mode}
          onValueChange={(v) => v && onModeChange(v as AllocationMode)}
          aria-label="Dividir em"
          className="gap-0 border border-input"
        >
          <ToggleGroupItem value="amount" className={TOGGLE_ITEM}>
            R$
          </ToggleGroupItem>
          <ToggleGroupItem value="percent" className={TOGGLE_ITEM}>
            %
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {total > 0 ? (
        <PlaneBar
          className="mt-3"
          label={`Divisão: ${rows.map((r, i) => `${label(r)} ${formatAmount(amounts[i] ?? 0)}`).join(", ")}`}
          segments={rows.map((r, i) => ({ key: r.uid, value: Math.max(0, amounts[i] ?? 0), tone: "in" as const }))}
        />
      ) : null}

      <ul className="mt-1">
        {rows.map((row, i) => (
          <li key={row.uid} className="flex items-end gap-2 border-t border-border py-3 first:border-t-0">
            <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 sm:grid-cols-3">
              <SelectOptions
                aria-label="Destino"
                value={row.targetType}
                onValueChange={(v) => {
                  const t = v as "account" | "pocket";
                  patch(row.uid, { targetType: t, pocketId: t === "account" ? "" : row.pocketId });
                }}
                options={[
                  { value: "account", label: "Conta corrente" },
                  { value: "pocket", label: "Caixinha" },
                ]}
              />
              {row.targetType === "pocket" ? (
                <SelectOptions
                  aria-label="Caixinha"
                  value={row.pocketId}
                  onValueChange={(v) => patch(row.uid, { pocketId: v })}
                  options={[{ value: "", label: "Qual caixinha?" }, ...pocketOptions]}
                />
              ) : null}
              <div className={row.targetType === "pocket" ? "col-span-2 sm:col-span-1" : undefined}>
                {mode === "amount" ? (
                  <CurrencyInput aria-label="Valor" value={row.amount} onChange={(v) => patch(row.uid, { amount: v })} />
                ) : (
                  <div className="flex items-center gap-2">
                    <Input
                      aria-label="Percentual"
                      className="min-w-16"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={0.01}
                      value={row.percent || ""}
                      onChange={(e) => {
                        const n = Number.parseFloat(e.target.value);
                        patch(row.uid, { percent: Number.isFinite(n) ? n : 0 });
                      }}
                    />
                    <span className="shrink-0 text-[15px] tabular-nums text-muted-foreground">
                      {formatAmount(amounts[i] ?? 0)}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 text-muted-foreground hover:text-ink-out"
              disabled={rows.length <= 1}
              onClick={() => onRowsChange((list) => list.filter((x) => x.uid !== row.uid))}
              aria-label="Remover destino"
            >
              <X />
            </Button>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="-ml-3 gap-1.5"
          onClick={() => onRowsChange((list) => [...list, newSplitRow()])}
        >
          <Plus aria-hidden />
          outro destino
        </Button>
        <p className={mismatch ? "text-[15px] text-ink-out tabular-nums" : "text-[15px] text-muted-foreground tabular-nums"}>
          {mode === "amount"
            ? mismatch
              ? `soma ${formatAmount(sumAmount)} de ${formatAmount(total)}`
              : `soma ${formatAmount(sumAmount)}`
            : mismatch
              ? `soma ${pct.format(sumPercent)}% de 100%`
              : "soma 100%"}
        </p>
      </div>
    </section>
  );
}

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
      setOpenCreate(false);
      setEditingManualDeposit(null);
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
    setEditingItem(null);
  };

  const onRunRecurring = async () => {
    await runRecurring.mutateAsync();
    toast.success("Recorrentes processados");
  };

  const totalManual = manualForm.watch("amount") ?? 0;
  const totalRecurring = recurringForm.watch("amount") ?? 0;

  const pocketNames = useMemo(() => new Map((pockets.data ?? []).map((p) => [p.id, p.name])), [pockets.data]);
  const todayStr = todayYmd();
  const thisMonth = currentMonthParam();

  const depositList = useMemo(
    () => [...(deposits.data ?? [])].sort((a, b) => b.depositDate.localeCompare(a.depositDate)),
    [deposits.data],
  );
  const recurringList = useMemo(
    () => [...(recurring.data ?? [])].sort((a, b) => a.nextExecutionDate.localeCompare(b.nextExecutionDate)),
    [recurring.data],
  );
  const byMonth = useMemo(() => {
    const out: Array<{ month: string; items: DepositRow[]; total: number }> = [];
    for (const d of depositList) {
      const month = d.depositDate.slice(0, 7);
      const last = out[out.length - 1];
      if (last && last.month === month) {
        last.items.push(d);
        last.total += d.amount;
      } else out.push({ month, items: [d], total: d.amount });
    }
    return out;
  }, [depositList]);

  const monthDeposits = depositList.filter((d) => d.depositDate.startsWith(thisMonth));
  const monthTotal = monthDeposits.reduce((s, d) => s + d.amount, 0);
  const monthSplit = useMemo(() => {
    const map = new Map<string, { label: string; amount: number }>();
    for (const d of monthDeposits) {
      for (const s of d.splits) {
        const key = s.targetType === "account" ? "account" : `pocket:${s.pocketId}`;
        const prev = map.get(key);
        map.set(key, { label: splitLabel(s.targetType, s.pocketName), amount: (prev?.amount ?? 0) + s.amount });
      }
    }
    return [...map.entries()].map(([key, v]) => ({ key, ...v })).sort((a, b) => b.amount - a.amount);
  }, [monthDeposits]);

  const openRecurringModal = () => {
    setEditingItem(null);
    recurringForm.reset({ title: "", amount: 0, nextExecutionDate: toInputDate(new Date()) });
    setRecurringMode("percent");
    setRecurringRows(defaultRecurringRows());
    setOpenRecurringCreate(true);
  };

  const closeManual = () => {
    setOpenCreate(false);
    setEditingManualDeposit(null);
  };
  const closeRecurring = () => {
    setOpenRecurringCreate(false);
    setEditingItem(null);
  };

  const pocketOptions_ = pocketOptions;
  const loading = activeTab === "manual" ? deposits.isLoading : recurring.isLoading;
  const isError = activeTab === "manual" ? deposits.isError : recurring.isError;

  return (
    <div className="pb-4">
      <PageHeader
        title="depósitos"
        actions={
          <Button size="sm" className="gap-1.5" onClick={activeTab === "manual" ? openManualModal : openRecurringModal}>
            <Plus aria-hidden />
            novo
          </Button>
        }
      />

      <section aria-label="Resumo do mês" className="pt-6 md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:items-end md:gap-10">
        <AnswerFigure
          label={`entrou em ${monthName(thisMonth)}`}
          value={formatAmount(monthTotal)}
          loading={deposits.isLoading}
          meta={`${monthDeposits.length} ${monthDeposits.length === 1 ? "depósito" : "depósitos"}`}
        />
        {deposits.isLoading ? (
          <div className="mt-5 h-12 animate-pulse bg-muted md:mt-0" />
        ) : (
          <div className="mt-5 md:mt-0">
            <PlaneBar
              label={`Destino em ${monthName(thisMonth)}: ${monthSplit.map((s) => `${s.label} ${formatAmount(s.amount)}`).join(", ") || "nada ainda"}`}
              segments={monthSplit.map((s) => ({ key: s.key, value: s.amount, tone: "in" as const }))}
            />
            {monthSplit.length > 0 ? (
              <PlaneLegend
                className="mt-3"
                items={monthSplit.map((s) => ({ key: s.key, label: s.label, tone: "in" as const, amount: formatAmount(s.amount) }))}
              />
            ) : null}
          </div>
        )}
      </section>

      <div className="sticky top-0 z-20 -mx-4 mt-6 flex items-center justify-between gap-3 border-b border-border bg-background px-4 py-2 pt-[calc(0.5rem+env(safe-area-inset-top))] sm:-mx-6 sm:px-6 md:static md:mx-0 md:px-0 md:pt-2">
        <ToggleGroup
          type="single"
          value={activeTab}
          onValueChange={(v) => v && setActiveTab(v as TabId)}
          aria-label="Tipo de depósito"
          className="gap-0 border border-input"
        >
          <ToggleGroupItem value="manual" className={TOGGLE_ITEM}>
            avulsos
          </ToggleGroupItem>
          <ToggleGroupItem value="recurring" className={TOGGLE_ITEM}>
            recorrentes
          </ToggleGroupItem>
        </ToggleGroup>
        {activeTab === "recurring" ? (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={onRunRecurring} disabled={runRecurring.isPending}>
            <Play aria-hidden />
            {runRecurring.isPending ? "lançando…" : "lançar vencidos"}
          </Button>
        ) : null}
      </div>

      {loading ? (
        <LedgerSkeleton />
      ) : isError ? (
        <p className="py-10 text-[15px] text-ink-out">Não foi possível carregar os depósitos. Recarregue a página.</p>
      ) : activeTab === "manual" ? (
        depositList.length === 0 ? (
          <div className="space-y-4 py-10">
            <p className="text-[15px] text-muted-foreground">Nenhum depósito ainda.</p>
            <Button onClick={openManualModal} className="gap-2">
              <Plus aria-hidden />
              registrar o primeiro depósito
            </Button>
          </div>
        ) : (
          byMonth.map((m) => (
            <LedgerGroup key={m.month} title={<span className="lowercase">{monthLabel(m.month)}</span>} aside={formatAmount(m.total, "+")}>
              {m.items.map((deposit) => (
                <LedgerRow
                  key={deposit.id}
                  tile={<DayTile day={dayOfMonth(deposit.depositDate)} tone="in" />}
                  title={deposit.title}
                  meta={[
                    ...deposit.splits.map((s) =>
                      deposit.splits.length > 1
                        ? `${splitLabel(s.targetType, s.pocketName)} ${formatAmount(s.amount)}`
                        : splitLabel(s.targetType, s.pocketName),
                    ),
                    deposit.recurringDepositId ? "recorrente" : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  amount={formatAmount(deposit.amount, "+")}
                  onOpen={() => openEditManualDeposit(deposit)}
                  openLabel={`Editar ${deposit.title}`}
                />
              ))}
            </LedgerGroup>
          ))
        )
      ) : recurringList.length === 0 ? (
        <div className="space-y-4 py-10">
          <p className="text-[15px] text-muted-foreground">
            Nenhum depósito recorrente. Salário e entradas fixas entram aqui, divididos entre conta e caixinhas.
          </p>
          <Button onClick={openRecurringModal} className="gap-2">
            <Plus aria-hidden />
            criar o primeiro
          </Button>
        </div>
      ) : (
        <div className="pt-2">
          {recurringList.map((item) => (
            <LedgerRow
              key={item.id}
              tile={<DayTile day={dayOfMonth(item.nextExecutionDate)} tone="forecast-in" />}
              title={item.title}
              meta={[
                nextWord(item.nextExecutionDate, todayStr),
                ...item.splits.map((s) => `${splitLabel(s.targetType, s.pocketName)} ${pct.format(s.percent)}%`),
              ].join(" · ")}
              amount={formatAmount(item.amount, "+")}
              onOpen={() => openEdit(item)}
              openLabel={`Editar ${item.title}`}
            />
          ))}
        </div>
      )}

      <Modal open={openCreate} onClose={closeManual} title={editingManualDeposit ? "editar depósito" : "novo depósito"} size="lg">
        <form onSubmit={onManualSubmit} className="space-y-5">
          <Field label="Título" htmlFor="dep-title">
            <Input id="dep-title" placeholder="Ex: Salário, bônus" {...manualForm.register("title")} />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Valor" htmlFor="dep-amount">
              <CurrencyInput
                id="dep-amount"
                value={totalManual}
                onChange={(v) => {
                  manualForm.setValue("amount", v);
                  if (manualMode === "amount" && manualRows.length === 1) {
                    setManualRows((rows) => rows.map((r) => ({ ...r, amount: v, percent: 100 })));
                  }
                }}
              />
            </Field>
            <Field label="Data" htmlFor="dep-date">
              <Input id="dep-date" type="date" {...manualForm.register("depositDate")} />
            </Field>
          </div>
          <SplitEditor
            mode={manualMode}
            onModeChange={setManualMode}
            rows={manualRows}
            onRowsChange={setManualRows}
            total={totalManual}
            pocketOptions={pocketOptions_}
            pocketNames={pocketNames}
          />
          <FormActions
            aside={
              editingManualDeposit ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-ink-out hover:text-ink-out sm:w-auto"
                  onClick={() => setDeletingManualDeposit(editingManualDeposit)}
                >
                  excluir
                </Button>
              ) : null
            }
          >
            <Button type="button" variant="outline" onClick={closeManual}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createDeposit.isPending || updateDeposit.isPending}>
              {createDeposit.isPending || updateDeposit.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </FormActions>
        </form>
      </Modal>

      <Modal open={!!deletingManualDeposit} onClose={() => setDeletingManualDeposit(null)} title="excluir depósito?" size="sm">
        <div className="space-y-4">
          {deletingManualDeposit ? (
            <p className="text-[15px] text-muted-foreground">
              <span className="font-medium text-foreground">{deletingManualDeposit.title}</span> (
              {formatCurrency(deletingManualDeposit.amount)}) sai da conta e das caixinhas que recebeu.
            </p>
          ) : null}
          <FormActions>
            <Button type="button" variant="outline" onClick={() => setDeletingManualDeposit(null)}>
              Cancelar
            </Button>
            <Button type="button" variant="destructive" onClick={onConfirmDeleteManual} disabled={deleteDeposit.isPending}>
              {deleteDeposit.isPending ? "Excluindo…" : "Excluir"}
            </Button>
          </FormActions>
        </div>
      </Modal>

      <Modal
        open={openRecurringCreate || !!editingItem}
        onClose={closeRecurring}
        title={editingItem ? "editar depósito recorrente" : "novo depósito recorrente"}
        size="lg"
      >
        <form onSubmit={editingItem ? onEditSubmit : onRecurringSubmit} className="space-y-5">
          <Field label="Título" htmlFor="rec-dep-title">
            <Input id="rec-dep-title" placeholder="Ex: Salário" {...recurringForm.register("title")} />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Valor por mês" htmlFor="rec-dep-amount">
              <CurrencyInput
                id="rec-dep-amount"
                value={totalRecurring}
                onChange={(v) => {
                  recurringForm.setValue("amount", v);
                  if (recurringMode === "amount" && recurringRows.length === 1) {
                    setRecurringRows((rows) => rows.map((r) => ({ ...r, amount: v, percent: 100 })));
                  }
                }}
              />
            </Field>
            <Field label="Próxima vez" htmlFor="rec-dep-next">
              <Input id="rec-dep-next" type="date" {...recurringForm.register("nextExecutionDate")} />
            </Field>
          </div>
          <SplitEditor
            mode={recurringMode}
            onModeChange={setRecurringMode}
            rows={recurringRows}
            onRowsChange={setRecurringRows}
            total={totalRecurring}
            pocketOptions={pocketOptions_}
            pocketNames={pocketNames}
          />
          <p className="text-[15px] text-muted-foreground">A divisão é salva em % e vale para todo mês.</p>
          <FormActions
            aside={
              editingItem ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-ink-out hover:text-ink-out sm:w-auto"
                  onClick={() => setDeletingItem(editingItem)}
                >
                  excluir
                </Button>
              ) : null
            }
          >
            <Button type="button" variant="outline" onClick={closeRecurring}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createRecurring.isPending || updateRecurring.isPending}>
              {createRecurring.isPending || updateRecurring.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </FormActions>
        </form>
      </Modal>

      <Modal open={!!deletingItem} onClose={() => setDeletingItem(null)} title="excluir depósito recorrente?" size="sm">
        <div className="space-y-4">
          {deletingItem ? (
            <p className="text-[15px] text-muted-foreground">
              <span className="font-medium text-foreground">{deletingItem.title}</span> (
              {formatCurrency(deletingItem.amount)}) para de entrar. Os depósitos já lançados continuam.
            </p>
          ) : null}
          <FormActions>
            <Button type="button" variant="outline" onClick={() => setDeletingItem(null)}>
              Cancelar
            </Button>
            <Button type="button" variant="destructive" onClick={onConfirmDelete} disabled={deleteRecurring.isPending}>
              {deleteRecurring.isPending ? "Excluindo…" : "Excluir"}
            </Button>
          </FormActions>
        </div>
      </Modal>
    </div>
  );
}
