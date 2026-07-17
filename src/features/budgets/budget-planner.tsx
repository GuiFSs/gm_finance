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
import { formatCurrency, formatYearMonthLabel } from "@/shared/utils/formatters";
import { Button } from "@/shared/ui/button";
import { Card, CardTitle } from "@/shared/ui/card";
import { CurrencyInput } from "@/shared/ui/currency-input";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

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
      const { error } = flattenAndResolveTree(incomeAmount, payloadNodes);
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

  return (
    <div className="space-y-4">
      <Card className="p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <CardTitle className="text-lg sm:text-xl">Orçamento mensal</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => {
              setHydratedKey("");
              setMonth((m) => shiftMonth(m, -1));
            }}>
              ←
            </Button>
            <Input
              type="month"
              className="w-[160px]"
              value={month}
              onChange={(e) => {
                const v = e.target.value;
                if (/^\d{4}-\d{2}$/.test(v)) {
                  setHydratedKey("");
                  setMonth(v);
                }
              }}
            />
            <Button type="button" variant="outline" size="sm" onClick={() => {
              setHydratedKey("");
              setMonth((m) => shiftMonth(m, 1));
            }}>
              →
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCopyPrevious}
              disabled={copyBudget.isPending}
            >
              Copiar mês anterior
            </Button>
          </div>
        </div>

        <p className="mt-2 text-sm text-muted-foreground">
          Defina a renda de {formatYearMonthLabel(month)} e divida por categorias (por valor ou %).
          Dentro de cada categoria, subdivida usando tags.
        </p>

        {budgetQuery.isLoading ? (
          <p className="mt-4 text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <div className="mt-6 space-y-6">
            {!hasSavedPlan && nodes.length === 0 && incomeAmount === 0 && (
              <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                Nenhum plano neste mês. Informe a renda, adicione divisões e salve — ou copie o mês anterior.
              </div>
            )}

            <div className="max-w-xs space-y-1">
              <Label>Renda / entrada mensal</Label>
              <CurrencyInput value={incomeAmount} onChange={setIncomeAmount} />
            </div>

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

            {incomeAmount > 0 && (
              <div className="flex flex-wrap gap-4 rounded-md bg-muted/40 px-3 py-2 text-sm">
                <span>Alocado na raiz: {formatCurrency(rootPreview)}</span>
                <span>Restante: {formatCurrency(Number((incomeAmount - rootPreview).toFixed(2)))}</span>
                {totals && hasSavedPlan && (
                  <>
                    <span>Salvo: {formatCurrency(totals.allocatedRoot)}</span>
                    <span>{totals.allocatedPercentOfIncome}% da renda</span>
                  </>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={onSave} disabled={upsert.isPending}>
                {upsert.isPending ? "Salvando..." : "Salvar orçamento"}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
