"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

import { buildCategorySpendRows } from "@/features/dashboard/category-spend";
import { DayTile, LedgerRow, MonthSwitcher, SectionHeading } from "@/features/month/ledger";
import {
  computeMonthTotals,
  currentMonthParam,
  dayOfMonth,
  formatAmount,
  monthName,
  todayYmd,
} from "@/features/month/month-model";
import { MonthPlane } from "@/features/month/month-plane";
import { OpenItemsList, openItemsCount } from "@/features/month/open-items-list";
import { EnablePushCard } from "@/features/notifications/enable-push";
import { PurchaseDetailDialog } from "@/features/purchases/purchase-detail-dialog";
import {
  useCategories,
  useCreateAdjustment,
  useCurrentUser,
  useDashboard,
  useMonthlyBudget,
  useMonthMovements,
} from "@/shared/hooks/use-app-data";
import { cn } from "@/shared/lib/cn";
import { formatCurrency, toInputDate } from "@/shared/utils/formatters";
import { Button } from "@/shared/ui/button";
import { CurrencyInput } from "@/shared/ui/currency-input";
import { Label } from "@/shared/ui/label";
import { Modal } from "@/shared/ui/modal";

const OPEN_LIMIT = 6;

export function DashboardOverview() {
  const router = useRouter();
  const [month, setMonth] = useState(currentMonthParam);
  const todayStr = todayYmd();
  const isCurrentMonth = month === currentMonthParam();
  const movements = useMonthMovements(month);
  const dashboard = useDashboard();
  const [detailPurchaseId, setDetailPurchaseId] = useState<string | null>(null);

  const list = movements.data?.data;
  const totals = useMemo(() => computeMonthTotals(list), [list]);
  const open = useMemo(() => openItemsCount(list, month), [list, month]);
  const deficit = totals.sobra < 0;
  const name = monthName(month);

  return (
    <div className="pb-4">
      <PurchaseDetailDialog
        purchaseId={detailPurchaseId}
        open={detailPurchaseId !== null}
        onOpenChange={(o) => !o && setDetailPurchaseId(null)}
      />

      <div className="flex items-center justify-between gap-3">
        <p className="text-2xl font-bold lowercase leading-none tracking-tight text-foreground md:invisible">g&amp;m</p>
        <MonthSwitcher month={month} onChange={setMonth} />
      </div>

      <div className="lg:grid lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-x-14">
        <div>
          <section aria-labelledby="sobra-heading" className="pt-6">
            <h1 id="sobra-heading" className="text-[15px] font-medium lowercase text-muted-foreground">
              {deficit ? "falta" : "sobra"} em {name}
            </h1>
            {movements.isLoading ? (
              <p className="mt-2 h-12 w-48 animate-pulse bg-muted" aria-label="Carregando" />
            ) : movements.isError ? (
              <p className="mt-2 text-[15px] text-ink-out">Não foi possível carregar o mês. Recarregue a página.</p>
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
            {movements.isLoading ? (
              <div className="mt-6 h-16 animate-pulse bg-muted" />
            ) : (
              <>
                <p className="mt-2 text-[15px] text-muted-foreground tabular-nums">
                  entra {formatAmount(totals.entradas)} · sai {formatAmount(totals.saidas)}
                </p>
                <MonthPlane
                  className="mt-6"
                  totals={totals}
                  onSelect={(status) => router.push(`/movements?month=${month}${status ? `&status=${status}` : ""}`)}
                />
              </>
            )}
          </section>

          <section aria-labelledby="open-heading">
            <SectionHeading
              aside={open.count > 0 ? <span className="tabular-nums">{open.count} em aberto</span> : null}
            >
              <span id="open-heading">{isCurrentMonth ? "vence agora" : `em aberto em ${name}`}</span>
            </SectionHeading>
            {movements.isLoading ? null : (
              <OpenItemsList
                list={list}
                month={month}
                todayStr={todayStr}
                limit={OPEN_LIMIT}
                onOpenPurchase={setDetailPurchaseId}
                emptyText={`Nada em aberto em ${name}.`}
              />
            )}
            {open.count > OPEN_LIMIT ? (
              <Link
                href={`/movements?month=${month}&status=aberto`}
                className="mt-1 inline-block py-2 text-[15px] font-medium text-foreground underline decoration-input underline-offset-4 hover:decoration-foreground"
              >
                ver os {open.count} em movimentos
              </Link>
            ) : null}
          </section>
          <UpcomingSection data={dashboard.data} todayStr={todayStr} />
        </div>

        <div>
          <BalancesSection data={dashboard.data} loading={dashboard.isLoading} />
          <CategorySection month={month} />
        </div>
      </div>

      <BalanceChart data={dashboard.data?.balanceEvolution} />

      <div className="pt-10">
        <EnablePushCard />
      </div>
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
        <span id="balances-heading">saldos</span>
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
          {data.pocketBalances.map((p) => (
            <BalanceRow key={p.id} name={p.name} value={p.balance} />
          ))}
        </ul>
      )}

      {data ? (
        <Modal open={editing} onClose={() => setEditing(false)} title="Saldo da conta corrente" size="sm">
          <div className="space-y-4">
            <p className="text-[15px] text-muted-foreground">
              Hoje: <span className="font-medium text-foreground tabular-nums">{formatCurrency(data.checkingBalance)}</span>
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

function CategorySection({ month }: { month: string }) {
  const budget = useMonthlyBudget(month);
  const categories = useCategories();
  const rows = useMemo(() => {
    if (!budget.data) return [];
    return buildCategorySpendRows(budget.data.tree, budget.data.actualsByCategoryId, categories.data ?? []);
  }, [budget.data, categories.data]);
  const hasBudget = Boolean(budget.data?.budget);
  const top = rows.slice(0, 6);
  const max = Math.max(1, ...top.map((r) => Math.max(r.spent, r.planned)));
  const spent = rows.reduce((s, r) => s + r.spent, 0);
  const planned = rows.reduce((s, r) => s + r.planned, 0);

  return (
    <section aria-labelledby="categories-heading">
      <SectionHeading
        aside={
          hasBudget ? (
            <span className="tabular-nums">
              {formatAmount(spent)} de {formatAmount(planned)}
            </span>
          ) : (
            <Link href="/budgets" className="underline decoration-input underline-offset-4 hover:text-foreground">
              definir orçamento
            </Link>
          )
        }
      >
        <span id="categories-heading">por categoria</span>
      </SectionHeading>
      {budget.isLoading || categories.isLoading ? (
        <p className="border-t border-border py-6 text-[15px] text-muted-foreground">Carregando…</p>
      ) : top.length === 0 ? (
        <p className="border-t border-border py-6 text-[15px] text-muted-foreground">Nenhum gasto neste mês.</p>
      ) : (
        <ul>
          {top.map((r) => {
            const over = r.planned > 0 && r.spent > r.planned;
            return (
              <li key={r.categoryId} className="border-t border-border py-3 first:border-t-0">
                <div className="flex items-baseline gap-3">
                  <span className="min-w-0 flex-1 truncate text-[15px] text-foreground">{r.name}</span>
                  {over ? <span className="text-[15px] font-medium text-ink-out">acima</span> : null}
                  <span className="text-[15px] font-medium tabular-nums text-foreground">{formatAmount(r.spent)}</span>
                </div>
                <div className="relative mt-2 h-3" aria-hidden>
                  <div className="absolute inset-y-0 left-0 bg-plane-out" style={{ width: `${(r.spent / max) * 100}%` }} />
                  {r.planned > 0 ? (
                    <div
                      className="absolute inset-y-0 left-0 border-2 border-foreground"
                      style={{ width: `${(r.planned / max) * 100}%` }}
                    />
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

type UpcomingEntry = { key: string; date: string; title: string; meta: string; amount: number; direction: "in" | "out" };

function UpcomingSection({ data, todayStr }: { data?: DashboardData; todayStr: string }) {
  const entries = useMemo<UpcomingEntry[]>(() => {
    if (!data) return [];
    const all: UpcomingEntry[] = [
      ...data.upcomingRecurring.map((r) => ({
        key: `rec-${r.title}-${r.nextExecutionDate}`,
        date: r.nextExecutionDate,
        title: r.title,
        meta: "recorrente",
        amount: r.amount,
        direction: "out" as const,
      })),
      ...data.upcomingInstallments.map((i) => ({
        key: `inst-${i.title}-${i.purchaseDate}-${i.installmentNumber}`,
        date: i.purchaseDate,
        title: i.title,
        meta: [`parcela ${i.installmentNumber}/${i.installmentCount}`, i.cardName].filter(Boolean).join(" · "),
        amount: i.amount,
        direction: "out" as const,
      })),
      ...data.upcomingRecurringDeposits.map((d, idx) => ({
        key: `dep-${d.nextExecutionDate}-${idx}`,
        date: d.nextExecutionDate,
        title: d.title,
        meta: d.destinationSummary,
        amount: d.amount,
        direction: "in" as const,
      })),
    ];
    return all.filter((e) => e.date >= todayStr).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6);
  }, [data, todayStr]);

  return (
    <section aria-labelledby="upcoming-heading">
      <SectionHeading>
        <span id="upcoming-heading">próximos</span>
      </SectionHeading>
      {!data ? null : entries.length === 0 ? (
        <p className="border-t border-border py-6 text-[15px] text-muted-foreground">Nada agendado.</p>
      ) : (
        <div>
          {entries.map((e) => (
            <LedgerRow
              key={e.key}
              tile={<DayTile day={dayOfMonth(e.date)} tone={e.direction === "in" ? "forecast-in" : "forecast"} />}
              title={e.title}
              meta={`${e.date.slice(8, 10)}/${e.date.slice(5, 7)} · ${e.meta}`}
              amount={
                <span className={e.direction === "in" ? "text-ink-in" : undefined}>
                  {formatAmount(e.amount, e.direction === "in" ? "+" : "−")}
                </span>
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}

const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

function BalanceChart({ data }: { data?: DashboardData["balanceEvolution"] }) {
  if (!data || data.length < 2) return null;
  return (
    <section aria-labelledby="chart-heading">
      <SectionHeading>
        <span id="chart-heading">saldo ao longo do tempo</span>
      </SectionHeading>
      <div className="h-56 border-t border-border pt-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="date"
              stroke="var(--muted-foreground)"
              tickLine={false}
              axisLine={false}
              fontSize={15}
              minTickGap={24}
            />
            <YAxis
              stroke="var(--muted-foreground)"
              tickLine={false}
              axisLine={false}
              fontSize={15}
              width={44}
              tickFormatter={(v) => compact.format(Number(v))}
            />
            <Tooltip
              formatter={(v) => [formatCurrency(Number(v) || 0), "Saldo"]}
              cursor={{ stroke: "var(--input)" }}
              contentStyle={{
                backgroundColor: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 0,
                color: "var(--foreground)",
              }}
            />
            <Line
              type="linear"
              dataKey="balance"
              stroke="var(--plane-in)"
              strokeWidth={2.5}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
