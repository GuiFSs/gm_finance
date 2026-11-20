"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

import {
  UNCATEGORIZED_LABEL,
  UNTAGGED_LABEL,
  categorySlicesFromMovements,
  monthlyGroups,
  sharePercents,
  tagSlicesForCategory,
  type CategorySlice,
  type MonthGroup,
} from "@/features/dashboard/category-spend";
import { FlatPie } from "@/features/dashboard/flat-pie";
import {
  monthAbbrev,
  periodDateRange,
  sumMonthTotals,
  yearColumns,
  yearMonthParams,
} from "@/features/dashboard/period-model";
import { PeriodColumns } from "@/features/dashboard/period-chart";
import { useYearMovements } from "@/features/dashboard/use-period-data";
import { MonthSwitcher, SectionHeading } from "@/features/month/ledger";
import {
  computeMonthTotals,
  currentMonthParam,
  formatAmount,
  monthName,
  type MonthTotals,
} from "@/features/month/month-model";
import { MonthPlane } from "@/features/month/month-plane";
import { EnablePushCard } from "@/features/notifications/enable-push";
import {
  useCategories,
  useCreateAdjustment,
  useCurrentUser,
  useDashboard,
  useMonthlyBudget,
  useMonthMovements,
  useTags,
  type MonthMovementRow,
} from "@/shared/hooks/use-app-data";
import { cn } from "@/shared/lib/cn";
import { formatCurrency, toInputDate } from "@/shared/utils/formatters";
import { Button } from "@/shared/ui/button";
import { CurrencyInput } from "@/shared/ui/currency-input";
import { Label } from "@/shared/ui/label";
import { Modal } from "@/shared/ui/modal";
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/toggle-group";

const THIS_YEAR = new Date().getFullYear();

export function DashboardOverview() {
  const router = useRouter();
  const [month, setMonth] = useState(currentMonthParam);
  const [period, setPeriod] = useState<"month" | "year">("month");
  const year = Number(month.slice(0, 4));
  const yearMode = period === "year";

  const movements = useMonthMovements(month);
  const yearMovements = useYearMovements(year, yearMode);
  const dashboard = useDashboard();

  const monthTotals = useMemo(() => computeMonthTotals(movements.data?.data), [movements.data]);
  const columns = useMemo(
    () => (yearMode ? yearColumns(year, yearMovements.map((query) => query.data?.data)) : []),
    [yearMode, year, yearMovements],
  );

  const yearLoading = yearMode && yearMovements.some((query) => !query.data && !query.isError);
  const yearError = yearMode && yearMovements.some((query) => query.isError);
  const pictureLoading = yearMode ? yearLoading : movements.isLoading;
  const pictureError = yearMode ? yearError : movements.isError;

  const totals = yearMode
    ? sumMonthTotals(yearMovements.map((query) => computeMonthTotals(query.data?.data)))
    : monthTotals;
  const deficit = totals.sobra < 0;
  const periodName = yearMode ? String(year) : monthName(month);

  return (
    <div className="pb-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center justify-between gap-3 sm:justify-start">
          <p className="text-2xl font-bold lowercase leading-none tracking-tight text-foreground md:hidden">g&amp;m</p>
          <ToggleGroup
            type="single"
            value={period}
            onValueChange={(value) => {
              if (value === "month" || value === "year") setPeriod(value);
            }}
            aria-label="Período"
            className="gap-0 border border-input"
          >
            <ToggleGroupItem
              value="month"
              className="h-8 px-3 text-[15px] data-[state=on]:bg-foreground data-[state=on]:text-background"
            >
              mês
            </ToggleGroupItem>
            <ToggleGroupItem
              value="year"
              className="h-8 px-3 text-[15px] data-[state=on]:bg-foreground data-[state=on]:text-background"
            >
              ano
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        {yearMode ? (
          <YearSwitcher
            year={year}
            onChange={(next) => setMonth(`${next}-${month.slice(5, 7)}`)}
          />
        ) : (
          <MonthSwitcher month={month} onChange={setMonth} />
        )}
      </div>

      <section aria-labelledby="sobra-heading" className="pt-6">
        <h1 id="sobra-heading" className="text-[15px] font-medium lowercase text-muted-foreground">
          {deficit && !pictureLoading ? "falta" : "sobra"} em {periodName}
        </h1>
        {pictureLoading ? (
          <p className="mt-2 h-12 w-48 animate-pulse bg-muted" aria-label="Carregando" />
        ) : pictureError ? (
          <p className="mt-2 text-[15px] text-ink-out">
            Não foi possível carregar {yearMode ? "o ano" : "o mês"}. Recarregue a página.
          </p>
        ) : (
          <p
            className={cn(
              "mt-1 text-[48px] font-bold leading-none tracking-[-0.03em] tabular-nums",
              deficit ? "text-ink-out" : "text-foreground",
            )}
          >
            <span className="mr-1.5 text-2xl font-medium tracking-normal">{deficit ? "−R$" : "R$"}</span>
            {formatAmount(totals.sobra)}
          </p>
        )}
        {pictureLoading ? (
          <div className="mt-8 h-40 animate-pulse bg-muted md:h-56" />
        ) : pictureError ? null : (
          <>
            <p className="mt-2 text-[15px] text-muted-foreground tabular-nums">
              entra {formatAmount(totals.entradas)} · sai {formatAmount(totals.saidas)}
            </p>
            {yearMode ? (
              <>
                <SectionHeading>
                  <span id="columns-heading">por mês</span>
                </SectionHeading>
                <PeriodColumns
                  label="Meses do ano"
                  columns={columns}
                  emptyText={`Nenhum movimento em ${periodName}.`}
                  onSelectMonth={(next) => {
                    setMonth(next);
                    setPeriod("month");
                  }}
                />
              </>
            ) : (
              <>
                <MonthPlane
                  className="mt-6"
                  totals={monthTotals}
                  onSelect={(status) => router.push(`/movements?month=${month}${status ? `&status=${status}` : ""}`)}
                />
                <MonthFlow totals={monthTotals} />
              </>
            )}
          </>
        )}
      </section>

      <div className="md:grid md:grid-cols-2 md:gap-x-14">
        <BalancesSection data={dashboard.data} loading={dashboard.isLoading} />
        <CategorySection
          yearMode={yearMode}
          month={month}
          lists={yearMode ? yearMovements.map((query) => query.data?.data) : [movements.data?.data]}
          months={yearMode ? yearMonthParams(year) : undefined}
          loading={pictureLoading}
          error={pictureError}
        />
      </div>

      <div className="pt-10">
        <EnablePushCard />
      </div>
    </div>
  );
}

function YearSwitcher({ year, onChange }: { year: number; onChange: (next: number) => void }) {
  return (
    <div className="flex items-center self-end sm:self-auto">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-10"
        onClick={() => onChange(year - 1)}
        aria-label="Ano anterior"
      >
        <ChevronLeft />
      </Button>
      <span className="min-w-[7.5rem] text-center text-[15px] font-medium tabular-nums text-foreground">{year}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-10"
        onClick={() => onChange(year + 1)}
        disabled={year >= THIS_YEAR + 1}
        aria-label="Próximo ano"
      >
        <ChevronRight />
      </Button>
    </div>
  );
}

type DashboardData = NonNullable<ReturnType<typeof useDashboard>["data"]>;

function BalancesSection({ data, loading }: { data?: DashboardData; loading: boolean }) {
  const currentUser = useCurrentUser();
  const createAdjustment = useCreateAdjustment();
  const [editing, setEditing] = useState(false);
  const [newBalance, setNewBalance] = useState(0);

  const save = async () => {
    if (!currentUser.data?.id || !data) return;
    const amount = newBalance - data.checkingBalance;
    if (Math.abs(amount) < 1e-6) {
      setEditing(false);
      return;
    }
    await createAdjustment.mutateAsync({
      targetType: "account",
      amount,
      reason: "Ajuste de saldo da conta corrente",
      adjustmentDate: toInputDate(new Date()),
      createdByUserId: currentUser.data.id,
    });
    toast.success("Saldo da conta atualizado");
    setEditing(false);
  };

  return (
    <section aria-labelledby="balances-heading">
      <SectionHeading aside={data ? <span className="tabular-nums">{formatCurrency(data.totalBalance)}</span> : null}>
        <span id="balances-heading">saldos agora</span>
      </SectionHeading>
      {loading || !data ? (
        <p className="border-t border-border py-6 text-[15px] text-muted-foreground">Carregando saldos…</p>
      ) : (
        <ul>
          <BalanceRow
            name="Conta corrente"
            value={data.checkingBalance}
            action={
              <Button
                variant="ghost"
                size="sm"
                className="-mr-2 text-muted-foreground"
                onClick={() => {
                  setNewBalance(data.checkingBalance);
                  setEditing(true);
                }}
              >
                editar
              </Button>
            }
          />
          {data.pocketBalances.map((pocket) => (
            <BalanceRow key={pocket.id} name={pocket.name} value={pocket.balance} />
          ))}
        </ul>
      )}

      {data ? (
        <Modal open={editing} onClose={() => setEditing(false)} title="Saldo da conta corrente" size="sm">
          <div className="space-y-4">
            <p className="text-[15px] text-muted-foreground">
              Hoje:{" "}
              <span className="font-medium text-foreground tabular-nums">{formatCurrency(data.checkingBalance)}</span>
              . Só muda o saldo. Não conta como entrada nem como saída do mês.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="account-new-balance">Novo saldo</Label>
              <CurrencyInput id="account-new-balance" value={newBalance} onChange={setNewBalance} allowNegative />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditing(false)}>
                Cancelar
              </Button>
              <Button onClick={save} disabled={createAdjustment.isPending}>
                {createAdjustment.isPending ? "Salvando…" : "Salvar saldo"}
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}

function BalanceRow({ name, value, action }: { name: string; value: number; action?: ReactNode }) {
  const negative = value < 0;
  return (
    <li className="flex min-h-12 items-center gap-3 border-t border-border py-2 first:border-t-0">
      <span className="min-w-0 flex-1 truncate text-[15px] text-foreground">{name}</span>
      {negative ? <span className="text-[15px] font-medium text-ink-out">negativo</span> : null}
      <span className={cn("text-[15px] font-medium tabular-nums", negative ? "text-ink-out" : "text-foreground")}>
        {formatAmount(value, negative ? "−" : undefined)}
      </span>
      {action}
    </li>
  );
}

function MonthFlow({ totals }: { totals: MonthTotals }) {
  const entra = totals.entradas;
  const sai = totals.saidas;
  const sobra = Math.max(0, totals.sobra);
  if (entra <= 0.004 && sai <= 0.004) {
    return (
      <p className="mt-8 border-t border-border py-6 text-[15px] text-muted-foreground">Nenhum movimento neste mês.</p>
    );
  }

  const slices = [
    ...(sai > 0.004 ? [{ key: "sai", value: sai, className: "fill-plane-out" }] : []),
    ...(sobra > 0.004 ? [{ key: "sobra", value: sobra, className: "fill-plane-in" }] : []),
  ];
  if (slices.length === 0 && entra > 0.004) {
    slices.push({ key: "sobra", value: entra, className: "fill-plane-in" });
  }
  const percents = sharePercents(slices.map((slice) => slice.value));
  const percentOf = (key: string) => {
    const index = slices.findIndex((slice) => slice.key === key);
    return index >= 0 ? percents[index] : undefined;
  };
  const label = [
    `entra ${formatAmount(entra)}`,
    sai > 0.004 ? `sai ${percentOf("sai") ?? 0}% ${formatAmount(sai)}` : null,
    sobra > 0.004 || slices.some((slice) => slice.key === "sobra")
      ? `sobra ${percentOf("sobra") ?? 0}% ${formatAmount(sobra || entra)}`
      : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="mt-8 flex flex-col gap-6 border-t border-border pt-6 sm:flex-row sm:items-center">
      <FlatPie slices={slices} label={label} />
      <ul className="min-w-0 flex-1">
        <FlowRow label="entra" amount={entra} />
        {sai > 0.004 ? (
          <FlowRow label="sai" amount={sai} percent={percentOf("sai")} marker="bg-plane-out" />
        ) : null}
        {sobra > 0.004 || (sai <= 0.004 && entra > 0.004) ? (
          <FlowRow label="sobra" amount={sobra || entra} percent={percentOf("sobra")} marker="bg-plane-in" />
        ) : null}
      </ul>
    </div>
  );
}

function FlowRow({
  label,
  amount,
  percent,
  marker,
}: {
  label: string;
  amount: number;
  percent?: number;
  marker?: string;
}) {
  return (
    <li className="flex min-h-12 items-center gap-3 border-t border-border py-2 first:border-t-0">
      {marker ? <span className={cn("size-2.5 shrink-0", marker)} aria-hidden /> : <span className="size-2.5 shrink-0" />}
      <span className="min-w-0 flex-1 truncate text-[15px] text-foreground">{label}</span>
      {percent != null ? (
        <span className="text-[15px] font-medium tabular-nums text-foreground">{percent}%</span>
      ) : null}
      <span className="text-[15px] font-medium tabular-nums text-foreground">{formatAmount(amount)}</span>
    </li>
  );
}

function CategorySection({
  yearMode,
  month,
  lists,
  months,
  loading,
  error,
}: {
  yearMode: boolean;
  month: string;
  lists: Array<MonthMovementRow[] | undefined>;
  months?: string[];
  loading: boolean;
  error: boolean;
}) {
  const router = useRouter();
  const budget = useMonthlyBudget(yearMode ? null : month);
  const categoryOptions = useCategories();
  const tagOptions = useTags();
  const [picked, setPicked] = useState<string | null>(null);
  const [chart, setChart] = useState<"pizza" | "meses">("pizza");
  const [focus, setFocus] = useState<string | null>(null);
  const categories = useMemo(() => categorySlicesFromMovements(lists), [lists]);
  const selected = categories.some((row) => row.name === picked) ? picked : null;
  const rows = useMemo(
    () => (selected ? tagSlicesForCategory(lists, selected) : categories),
    [selected, lists, categories],
  );
  const byMonth = useMemo(() => {
    if (!yearMode || !months) return [];
    return monthlyGroups(months, lists, rows, selected);
  }, [yearMode, months, lists, rows, selected]);
  const summary = rows.map((row) => `${row.name} ${row.percent}%`).join(", ");
  const showMonths = yearMode && chart === "meses";

  const year = month.slice(0, 4);
  /** Mês aberto na lista "por mês" (o tocado no gráfico, ou o da tela). */
  const columnMonth = [focus, month].find((value) => value && byMonth.some((group) => group.month === value)) ?? byMonth.at(-1)?.month;
  /** Mês tocado no gráfico do ano. Sem toque, o período é o ano inteiro. */
  const focusMonth = focus?.startsWith(year) ? focus : null;
  /** Período que o filtro de compras recebe: o mês da tela (ou o mês tocado no ano) ou o ano. */
  const rowPeriod = yearMode ? ((showMonths ? columnMonth : focusMonth) ?? year) : month;

  const openPurchases = (target: {
    category?: string;
    tag?: string;
    uncategorized?: boolean;
    untagged?: boolean;
    period: string;
  }) => {
    const params = new URLSearchParams(periodDateRange(target.period));
    if (target.uncategorized) params.set("uncategorized", "1");
    if (target.untagged) params.set("untagged", "1");
    if (target.category) {
      const categoryId = categoryOptions.data?.find((item) => item.name === target.category)?.id;
      if (!categoryId) return;
      params.set("categoryId", categoryId);
    }
    if (target.tag) {
      const tagId = tagOptions.data?.find((item) => item.name === target.tag)?.id;
      if (!tagId) return;
      params.set("tagId", tagId);
    }
    router.push(`/purchases?${params.toString()}`);
  };

  /** Categoria abre as compras; a tag também, já dentro da categoria. */
  const rowLinks = (row: CategorySlice): RowLinks => {
    if (row.name === UNCATEGORIZED_LABEL) {
      return { onOpen: () => openPurchases({ uncategorized: true, period: rowPeriod }) };
    }
    if (row.name === UNTAGGED_LABEL) {
      return {
        onOpen: () =>
          openPurchases({
            category: selected && selected !== UNCATEGORIZED_LABEL ? selected : undefined,
            untagged: true,
            period: rowPeriod,
          }),
      };
    }
    if (selected) return { onOpen: () => openPurchases({ category: selected, tag: row.name, period: rowPeriod }) };
    return {
      onOpen: () => openPurchases({ category: row.name, period: rowPeriod }),
      onDrill: () => setPicked(row.name),
    };
  };
  const openSlice = (name: string) => {
    const row = rows.find((item) => item.name === name);
    if (row) rowLinks(row).onOpen?.();
  };

  return (
    <section aria-labelledby="categories-heading" className="md:pr-20">
      <SectionHeading
        aside={
          selected ? (
            <button
              type="button"
              onClick={() => setPicked(null)}
              className="underline decoration-input underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              categorias
            </button>
          ) : !yearMode && budget.data && !budget.data.budget ? (
            <Link href="/budgets" className="underline decoration-input underline-offset-4 hover:text-foreground">
              definir orçamento
            </Link>
          ) : null
        }
      >
        <span id="categories-heading">{selected ?? "por categoria"}</span>
      </SectionHeading>
      {yearMode && !loading && !error && rows.length > 0 ? (
        <ToggleGroup
          type="single"
          value={chart}
          onValueChange={(value) => {
            if (value === "pizza" || value === "meses") setChart(value);
          }}
          aria-label={selected ? "Gráfico das tags" : "Gráfico das categorias"}
          className="mb-1 gap-0 border border-input"
        >
          <ToggleGroupItem value="pizza" className="h-8 px-3 text-[15px] data-[state=on]:bg-foreground data-[state=on]:text-background">
            pizza
          </ToggleGroupItem>
          <ToggleGroupItem value="meses" className="h-8 px-3 text-[15px] data-[state=on]:bg-foreground data-[state=on]:text-background">
            por mês
          </ToggleGroupItem>
        </ToggleGroup>
      ) : null}
      {loading ? (
        <p className="border-t border-border py-6 text-[15px] text-muted-foreground">Carregando…</p>
      ) : error ? (
        <p className="border-t border-border py-6 text-[15px] text-ink-out">
          Não foi possível carregar as categorias. Recarregue a página.
        </p>
      ) : rows.length === 0 ? (
        <p className="border-t border-border py-6 text-[15px] text-muted-foreground">
          Nenhum gasto {yearMode ? "neste ano" : "neste mês"}.
        </p>
      ) : showMonths ? (
        <CategoryColumns groups={byMonth} active={columnMonth} onSelect={setFocus} rowLinks={rowLinks} />
      ) : (
        <div className="flex flex-col gap-6 border-t border-border pt-6 sm:flex-row sm:items-start">
          <FlatPie
            slices={rows.map((row) => ({ key: row.name, value: row.spent, fill: row.color }))}
            label={summary}
            onSelect={openSlice}
          />
          <ul className="min-w-0 flex-1">
            {rows.map((row) => (
              <li key={row.name}>
                <SpendRow row={row} {...rowLinks(row)} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function SliceLabel({ row }: { row: CategorySlice }) {
  return (
    <>
      <span className="size-2.5 shrink-0" style={{ backgroundColor: row.color }} aria-hidden />
      <span className="min-w-0 flex-1 truncate text-[15px] text-foreground">{row.name}</span>
      <span className="text-[15px] font-medium tabular-nums text-foreground">
        {row.percent === 0 && row.spent > 0.004 ? "<1%" : `${row.percent}%`}
      </span>
      <span className="text-[15px] font-medium tabular-nums text-foreground">{formatAmount(row.spent)}</span>
    </>
  );
}

type RowLinks = { onOpen?: () => void; onDrill?: () => void };

function SpendRow({ row, onOpen, onDrill }: { row: CategorySlice } & RowLinks) {
  if (!onOpen) {
    return (
      <div className="flex min-h-12 items-center gap-3 border-t border-border py-2">
        <SliceLabel row={row} />
      </div>
    );
  }
  return (
    <div className="flex min-h-12 items-center gap-1 border-t border-border">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-h-12 min-w-0 flex-1 items-center gap-3 py-2 text-left hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <SliceLabel row={row} />
      </button>
      {onDrill ? (
        <Button type="button" variant="ghost" size="sm" className="shrink-0 text-muted-foreground" onClick={onDrill}>
          tags
        </Button>
      ) : null}
    </div>
  );
}

function CategoryColumns({
  groups,
  active,
  onSelect,
  rowLinks,
}: {
  groups: MonthGroup[];
  active?: string;
  onSelect: (month: string) => void;
  rowLinks: (row: CategorySlice) => RowLinks;
}) {
  const totals = groups.map((group) => group.slices.reduce((sum, slice) => sum + slice.spent, 0));
  const max = Math.max(0, ...totals);
  const open = groups.find((group) => group.month === active);

  return (
    <div className="border-t border-border pt-6">
      <ul className="flex h-40 items-end gap-[3px] border-b border-border md:h-56" aria-label="Gasto por mês">
        {groups.map((group, index) => {
          const total = totals[index] ?? 0;
          const summary = total > 0.004 ? `${group.label}, ${formatAmount(total)}` : `${group.label}, nenhum gasto`;
          return (
            <li key={group.month} className="flex h-full min-w-0 flex-1 items-end">
              <button
                type="button"
                aria-pressed={group.month === active}
                aria-label={summary}
                onClick={() => onSelect(group.month)}
                className="group flex h-full w-full items-end focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <ColumnStack slices={group.slices} total={total} max={max} />
              </button>
            </li>
          );
        })}
      </ul>
      <ul className="mt-2 flex gap-[3px]" aria-hidden>
        {groups.map((group) => (
          <li
            key={group.month}
            className={cn(
              "min-w-0 flex-1 truncate border-b-2 pb-1 text-center text-[12px] leading-none",
              group.month === active ? "border-foreground text-foreground" : "border-transparent text-muted-foreground",
            )}
          >
            {monthAbbrev(group.month)}
          </li>
        ))}
      </ul>
      {open ? (
        <div className="pt-4">
          <p className="text-[15px] font-medium lowercase text-muted-foreground">{open.label}</p>
          {open.slices.length === 0 ? (
            <p className="border-t border-border py-3 text-[15px] text-foreground">—</p>
          ) : (
            <ul>
              {open.slices.map((row) => (
                <li key={row.name}>
                  <SpendRow row={row} {...rowLinks(row)} />
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

function ColumnStack({ slices, total, max }: { slices: CategorySlice[]; total: number; max: number }) {
  if (total <= 0.004 || max <= 0.004) {
    return <span className="mb-px block h-3 w-full border border-dashed border-input" aria-hidden />;
  }
  return (
    <span className="plane-column flex w-full flex-col justify-end" style={{ height: `${(total / max) * 100}%` }} aria-hidden>
      {[...slices].reverse().map((slice) => (
        <span
          key={slice.name}
          className="w-full group-hover:brightness-110"
          style={{ flexGrow: slice.spent, flexBasis: 0, backgroundColor: slice.color }}
        />
      ))}
    </span>
  );
}
