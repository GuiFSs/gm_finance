"use client";

import { useEffect, useState } from "react";
import { addMonths, format, parse } from "date-fns";
import { toast } from "sonner";

import {
  useCategories,
  useCopyMonthlyBudget,
  useMonthlyBudget,
  useTags,
  useUpsertMonthlyBudget,
} from "@/shared/hooks/use-app-data";
import { flattenAndResolveTree, resolveSiblingAmounts } from "@/shared/lib/budget-allocation";
import { AnswerFigure, LedgerSkeleton, MonthSwitcher } from "@/features/month/ledger";
import { formatAmount, monthName } from "@/features/month/month-model";
import { PlaneBar, PlaneLegend } from "@/features/month/plane-bar";
import { formatYearMonthLabel } from "@/shared/utils/formatters";
import { Button } from "@/shared/ui/button";
import { CurrencyInput } from "@/shared/ui/currency-input";
import { Field, PageHeader } from "@/shared/ui/page-header";

import {
  BudgetAllocationRows,
  collectUsedCategoryIds,
  collectUsedTagIds,
  draftToPayload,
  treeToDraft,
  type DraftAllocationNode,
} from "./budget-allocation-rows";

function currentMonth(): string {
  return format(new Date(), "yyyy-MM");
}

function shiftMonth(month: string, delta: number): string {
  const d = parse(`${month}-01`, "yyyy-MM-dd", new Date());
  return format(addMonths(d, delta), "yyyy-MM");
}

export function BudgetPlanner() {
  const [month, setMonth] = useState(currentMonth);
  const budgetQuery = useMonthlyBudget(month);
  const categories = useCategories();
  const tags = useTags();
  const upsert = useUpsertMonthlyBudget();
  const copyBudget = useCopyMonthlyBudget();

  const [incomeAmount, setIncomeAmount] = useState(0);
  const [nodes, setNodes] = useState<DraftAllocationNode[]>([]);
  const [hydratedKey, setHydratedKey] = useState("");

  useEffect(() => {
    const data = budgetQuery.data;
    if (!data || budgetQuery.isFetching) return;
    const hydrateKey = `${month}|${data.budget?.id ?? "null"}|${data.budget?.incomeAmount ?? 0}|${data.tree
      .map((t) => t.id)
      .join(",")}`;
    if (hydrateKey === hydratedKey) return;
    setIncomeAmount(data.budget?.incomeAmount ?? 0);
    setNodes(treeToDraft(data.tree));
    setHydratedKey(hydrateKey);
  }, [budgetQuery.data, budgetQuery.isFetching, month, hydratedKey]);

  const usedCategoryIds = collectUsedCategoryIds(nodes);
  const usedTagIds = collectUsedTagIds(nodes);
  const hasSavedPlan = Boolean(budgetQuery.data?.budget);
  const totals = budgetQuery.data?.totals;

  const rootPreview = resolveSiblingAmounts(
    incomeAmount,
    nodes.map((n) => ({
      allocationMode: n.allocationMode,
      percent: n.percent,
      amount: n.amount,
    })),
  ).reduce((a, v) => a + v, 0);

  const onSave = async () => {
    try {
      const payloadNodes = draftToPayload(nodes);
      const categoryById = Object.fromEntries((categories.data ?? []).map((c) => [c.id, c.name]));
      const tagById = Object.fromEntries((tags.data ?? []).map((t) => [t.id, t.name]));
      const { error } = flattenAndResolveTree(incomeAmount, payloadNodes, undefined, {
        categoryById,
        tagById,
      });
      if (error) {
        toast.error(error);
        return;
      }
      await upsert.mutateAsync({
        month,
        incomeAmount,
        allocations: payloadNodes,
      });
      setHydratedKey("");
      toast.success("Orçamento salvo");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar orçamento");
    }
  };

  const onCopyPrevious = async () => {
    const fromMonth = shiftMonth(month, -1);
    try {
      await copyBudget.mutateAsync({ fromMonth, toMonth: month });
      setHydratedKey("");
      toast.success(`Orçamento copiado de ${formatYearMonthLabel(fromMonth)}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível copiar o mês anterior");
    }
  };

  const rootAmounts = resolveSiblingAmounts(
    incomeAmount,
    nodes.map((n) => ({ allocationMode: n.allocationMode, percent: n.percent, amount: n.amount })),
  );
  const free = Number((incomeAmount - rootPreview).toFixed(2));
  const spentTotal = hasSavedPlan ? nodes.reduce((s, n) => s + (n.categoryId ? (n.spentAmount ?? 0) : 0), 0) : 0;
  const categoryName = new Map((categories.data ?? []).map((c) => [c.id, c.name]));
  const empty = !hasSavedPlan && nodes.length === 0 && incomeAmount === 0;

  const changeMonth = (next: string) => {
    setHydratedKey("");
    setMonth(next);
  };

  return (
    <div className="pb-4">
      <PageHeader title="orçamento" actions={<MonthSwitcher month={month} onChange={changeMonth} />} />

      {budgetQuery.isLoading ? (
        <>
          <div className="pt-6">
            <AnswerFigure label="livre no plano" value="" loading meta="" />
          </div>
          <LedgerSkeleton rows={3} />
        </>
      ) : budgetQuery.isError ? (
        <p className="py-10 text-[15px] text-ink-out">Não foi possível carregar o orçamento. Recarregue a página.</p>
      ) : (
        <>
          <section aria-label="Resumo do plano" className="pt-6 md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:items-end md:gap-10">
            <AnswerFigure
              label={free < -0.004 ? `passou da renda de ${monthName(month)}` : `livre no plano de ${monthName(month)}`}
              value={formatAmount(free)}
              negative={free < -0.004}
              meta={`renda ${formatAmount(incomeAmount)} · planejado ${formatAmount(rootPreview)}`}
            />
            {empty ? null : (
              <div className="mt-5 md:mt-0">
                <PlaneBar
                  size="lg"
                  label={`Plano: ${nodes
                    .map((n, i) => `${categoryName.get(n.categoryId) ?? "sem categoria"} ${formatAmount(rootAmounts[i] ?? 0)}`)
                    .join(", ")}, livre ${formatAmount(Math.max(0, free))}`}
                  segments={[
                    ...nodes.map((n, i) => {
                      const planned = rootAmounts[i] ?? 0;
                      return {
                        key: n.uid,
                        value: planned,
                        tone: "forecast" as const,
                        fill: hasSavedPlan && planned > 0 ? (n.spentAmount ?? 0) / planned : undefined,
                        onSelect: () =>
                          document.getElementById(`budget-row-${n.uid}`)?.scrollIntoView({ behavior: "smooth", block: "center" }),
                      };
                    }),
                    { key: "free", value: Math.max(0, free), tone: "in" as const },
                  ]}
                />
                <PlaneLegend
                  className="mt-3"
                  items={[
                    { key: "planned", label: "planejado", tone: "forecast", amount: formatAmount(rootPreview) },
                    ...(hasSavedPlan
                      ? [{ key: "spent", label: "gasto", tone: "out" as const, amount: formatAmount(spentTotal) }]
                      : []),
                    { key: "free", label: "livre", tone: "in", amount: formatAmount(Math.max(0, free)), value: Math.max(0, free) },
                  ]}
                />
              </div>
            )}
          </section>

          {empty ? (
            <div className="space-y-3 pt-8">
              <p className="text-[15px] text-muted-foreground">Nenhum plano em {monthName(month)}.</p>
              <Button type="button" variant="outline" onClick={onCopyPrevious} disabled={copyBudget.isPending}>
                {copyBudget.isPending ? "Copiando…" : `copiar de ${monthName(shiftMonth(month, -1))}`}
              </Button>
            </div>
          ) : null}

          <section aria-labelledby="income-heading" className="pt-8">
            <h2 id="income-heading" className="pb-1 text-2xl font-bold lowercase leading-tight tracking-tight">
              renda
            </h2>
            <div className="border-t-2 border-foreground pt-3">
              <Field label={`Entra em ${monthName(month)}`} htmlFor="budget-income" className="max-w-xs">
                <CurrencyInput
                  id="budget-income"
                  className="h-14 text-2xl font-bold"
                  value={incomeAmount}
                  onChange={setIncomeAmount}
                />
              </Field>
            </div>
          </section>

          <section aria-labelledby="split-heading" className="pt-8">
            <div className="flex items-baseline justify-between gap-3 pb-1">
              <h2 id="split-heading" className="text-2xl font-bold lowercase leading-tight tracking-tight">
                divisão
              </h2>
              <span className="text-[15px] tabular-nums text-muted-foreground">
                {incomeAmount > 0 ? `${((rootPreview / incomeAmount) * 100).toFixed(0)}% da renda` : null}
              </span>
            </div>
            <div className="border-t-2 border-foreground pt-1">
              <BudgetAllocationRows
                pool={incomeAmount}
                nodes={nodes}
                onChange={setNodes}
                categories={categories.data ?? []}
                tags={tags.data ?? []}
                usedCategoryIds={usedCategoryIds}
                usedTagIds={usedTagIds}
                showActuals={hasSavedPlan}
              />
            </div>
          </section>

          <div className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 -mx-4 mt-8 flex flex-col gap-2 border-t border-border bg-background px-4 py-3 sm:-mx-6 sm:flex-row sm:items-center sm:justify-end sm:px-6 md:static md:mx-0 md:px-0">
            <Button type="button" onClick={onSave} disabled={upsert.isPending} className="sm:min-w-[160px]">
              {upsert.isPending ? "Salvando…" : "Salvar orçamento"}
            </Button>
          </div>
          {totals && hasSavedPlan ? (
            <p className="pt-2 text-[15px] text-muted-foreground tabular-nums">
              salvo: {formatAmount(totals.allocatedRoot)} · {totals.allocatedPercentOfIncome}% da renda
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
