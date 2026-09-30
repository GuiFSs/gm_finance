"use client";

import { addMonths, format, parse } from "date-fns";
import { ChevronsUpDown } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { BudgetAllocationNode, BudgetStatus } from "@/entities/budget/model";
import { useCategories, useMonthlyBudget } from "@/shared/hooks/use-app-data";
import { budgetStatus } from "@/shared/lib/budget-allocation";
import { formatCurrency, formatYearMonthLabel } from "@/shared/utils/formatters";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Progress } from "@/shared/ui/progress";
import { cn } from "@/shared/lib/cn";

export type CategorySpendRow = {
  categoryId: string;
  name: string;
  planned: number;
  spent: number;
  status: BudgetStatus | "unbudgeted";
  inBudget: boolean;
};

function currentMonth(): string {
  return format(new Date(), "yyyy-MM");
}

function shiftMonth(month: string, delta: number): string {
  const d = parse(`${month}-01`, "yyyy-MM-dd", new Date());
  return format(addMonths(d, delta), "yyyy-MM");
}

function statusLabel(status: BudgetStatus | "unbudgeted"): string {
  if (status === "over") return "Acima do plano";
  if (status === "on_track") return "No limite";
  if (status === "under") return "Dentro do plano";
  return "Sem orçamento";
}

function statusBadgeVariant(
  status: BudgetStatus | "unbudgeted",
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "over") return "destructive";
  if (status === "on_track") return "default";
  if (status === "unbudgeted") return "outline";
  return "secondary";
}

export function buildCategorySpendRows(
  tree: BudgetAllocationNode[],
  actualsByCategoryId: Record<string, number>,
  categories: Array<{ id: string; name: string }>,
): CategorySpendRow[] {
  const nameById = new Map(categories.map((c) => [c.id, c.name]));
  const rowsById = new Map<string, CategorySpendRow>();

  for (const node of tree) {
    if (!node.categoryId) continue;
    const planned = node.plannedAmount ?? node.amount ?? 0;
    const spent = node.spentAmount ?? actualsByCategoryId[node.categoryId] ?? 0;
    rowsById.set(node.categoryId, {
      categoryId: node.categoryId,
      name: node.categoryName ?? nameById.get(node.categoryId) ?? "Categoria",
      planned,
      spent,
      status: node.status ?? budgetStatus(planned, spent),
      inBudget: true,
    });
  }

  for (const [categoryId, spent] of Object.entries(actualsByCategoryId)) {
    if (rowsById.has(categoryId)) continue;
    const amount = Number(spent) || 0;
    if (amount <= 0) continue;
    rowsById.set(categoryId, {
      categoryId,
      name: nameById.get(categoryId) ?? "Categoria",
      planned: 0,
      spent: amount,
      status: "unbudgeted",
      inBudget: false,
    });
  }

  return [...rowsById.values()].sort((a, b) => b.spent - a.spent || a.name.localeCompare(b.name, "pt-BR"));
}

export function MonthBudgetSummary() {
  const [month, setMonth] = useState(currentMonth);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const budgetQuery = useMonthlyBudget(month);
  const categories = useCategories();

  const allRows = useMemo(() => {
    if (!budgetQuery.data) return [];
    return buildCategorySpendRows(
      budgetQuery.data.tree,
      budgetQuery.data.actualsByCategoryId,
      categories.data ?? [],
    );
  }, [budgetQuery.data, categories.data]);

  const filterOptions = useMemo(() => {
    const fromRows = allRows.map((r) => ({ id: r.categoryId, name: r.name }));
    if (fromRows.length > 0) return fromRows;
    return (categories.data ?? []).map((c) => ({ id: c.id, name: c.name }));
  }, [allRows, categories.data]);

  const filteredRows = useMemo(() => {
    if (selectedCategoryIds.length === 0) return allRows;
    const selected = new Set(selectedCategoryIds);
    return allRows.filter((r) => selected.has(r.categoryId));
  }, [allRows, selectedCategoryIds]);

  const hasBudget = Boolean(budgetQuery.data?.budget);
  const totalSpent = filteredRows.reduce((a, r) => a + r.spent, 0);
  const totalPlanned = filteredRows.reduce((a, r) => a + r.planned, 0);
  const variance = Number((totalPlanned - totalSpent).toFixed(2));

  const chartData = filteredRows.map((r) => ({
    name: r.name,
    gasto: r.spent,
    planejado: r.planned,
  }));

  const toggleCategory = (id: string) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const clearFilter = () => setSelectedCategoryIds([]);

  const filterLabel =
    selectedCategoryIds.length === 0
      ? "Todas as categorias"
      : selectedCategoryIds.length === 1
        ? (filterOptions.find((c) => c.id === selectedCategoryIds[0])?.name ?? "1 categoria")
        : `${selectedCategoryIds.length} categorias`;

  return (
    <div className="space-y-4">
      <Card className="p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg sm:text-xl">Resumo do mês</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Gastos por categoria em {formatYearMonthLabel(month)}
              {hasBudget ? " comparado ao orçamento" : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedCategoryIds([]);
                setMonth((m) => shiftMonth(m, -1));
              }}
            >
              ←
            </Button>
            <Input
              type="month"
              className="w-[160px]"
              value={month}
              onChange={(e) => {
                const v = e.target.value;
                if (/^\d{4}-\d{2}$/.test(v)) {
                  setSelectedCategoryIds([]);
                  setMonth(v);
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedCategoryIds([]);
                setMonth((m) => shiftMonth(m, 1));
              }}
            >
              →
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="min-w-[10rem] justify-between gap-2">
                  <span className="truncate">{filterLabel}</span>
                  <ChevronsUpDown className="size-3.5 shrink-0 opacity-60" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">Categorias</p>
                  {selectedCategoryIds.length > 0 && (
                    <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={clearFilter}>
                      Limpar
                    </Button>
                  )}
                </div>
                {filterOptions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma categoria.</p>
                ) : (
                  <ul className="max-h-56 space-y-2 overflow-y-auto">
                    {filterOptions.map((cat) => {
                      const checked = selectedCategoryIds.includes(cat.id);
                      return (
                        <li key={cat.id} className="flex items-center gap-2">
                          <Checkbox
                            id={`dash-cat-${cat.id}`}
                            checked={checked}
                            onCheckedChange={() => toggleCategory(cat.id)}
                          />
                          <Label htmlFor={`dash-cat-${cat.id}`} className="cursor-pointer font-normal">
                            {cat.name}
                          </Label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {budgetQuery.isLoading || categories.isLoading ? (
          <p className="mt-4 text-sm text-muted-foreground">Carregando resumo do mês...</p>
        ) : (
          <div className="mt-6 space-y-6">
            {!hasBudget && (
              <div className="flex flex-col gap-3 rounded-md border border-dashed border-border p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  Nenhum orçamento definido para {formatYearMonthLabel(month)}. Os gastos abaixo ainda
                  aparecem; defina o plano para comparar planejado × realizado.
                </p>
                <Button asChild size="sm" className="shrink-0">
                  <Link href="/budgets">Definir orçamento</Link>
                </Button>
              </div>
            )}

            <div className={cn("grid gap-3", hasBudget ? "sm:grid-cols-3" : "sm:grid-cols-1")}>
              <MetricTile label="Gasto do mês" value={formatCurrency(totalSpent)} />
              {hasBudget && (
                <>
                  <MetricTile label="Planejado" value={formatCurrency(totalPlanned)} />
                  <MetricTile
                    label={variance >= 0 ? "Sobrou" : "Passou"}
                    value={formatCurrency(Math.abs(variance))}
                    tone={variance >= 0 ? "positive" : "negative"}
                  />
                </>
              )}
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Despesas por categoria</CardTitle>
                </CardHeader>
                <CardContent>
                  {chartData.length === 0 ? (
                    <p className="py-10 text-center text-sm text-muted-foreground">
                      Nenhum gasto neste mês{selectedCategoryIds.length > 0 ? " com o filtro atual" : ""}.
                    </p>
                  ) : (
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={56} />
                          <YAxis tick={{ fontSize: 11 }} width={56} tickFormatter={(v) => `${Math.round(Number(v))}`} />
                          <Tooltip
                            formatter={(value, name) => [
                              formatCurrency(Number(value) || 0),
                              name === "gasto" ? "Gasto" : "Planejado",
                            ]}
                            contentStyle={{
                              backgroundColor: "hsl(var(--popover))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: 8,
                            }}
                          />
                          {hasBudget && <Legend formatter={(v) => (v === "gasto" ? "Gasto" : "Planejado")} />}
                          <Bar dataKey="gasto" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                          {hasBudget && <Bar dataKey="planejado" fill="#94a3b8" radius={[4, 4, 0, 0]} />}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Detalhe por categoria</CardTitle>
                </CardHeader>
                <CardContent>
                  {filteredRows.length === 0 ? (
                    <p className="py-10 text-center text-sm text-muted-foreground">
                      Nenhuma categoria para exibir.
                    </p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {filteredRows.map((row) => {
                        const pct =
                          row.planned > 0
                            ? Math.min(100, Math.round((row.spent / row.planned) * 100))
                            : row.spent > 0
                              ? 100
                              : 0;
                        const over = row.status === "over" || row.status === "unbudgeted";
                        return (
                          <li key={row.categoryId} className="space-y-2 py-3 first:pt-0 last:pb-0">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-foreground">{row.name}</p>
                                <p className="text-xs text-muted-foreground tabular-nums">
                                  {formatCurrency(row.spent)}
                                  {row.inBudget ? ` de ${formatCurrency(row.planned)}` : ""}
                                  {row.planned > 0 ? ` · ${pct}%` : ""}
                                </p>
                              </div>
                              <Badge variant={statusBadgeVariant(row.status)} className="shrink-0 text-xs">
                                {statusLabel(row.status)}
                              </Badge>
                            </div>
                            <Progress
                              value={pct}
                              className={cn("h-2", over && "[&>div]:bg-destructive")}
                            />
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function MetricTile({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "positive" | "negative";
}) {
  return (
    <div className="rounded-md border border-border bg-card px-4 py-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 text-lg font-bold tabular-nums tracking-tight sm:text-xl",
          tone === "negative" && "text-destructive",
          tone === "positive" && "text-emerald-700 dark:text-emerald-400",
          tone === "neutral" && "text-foreground",
        )}
      >
        {value}
      </p>
    </div>
  );
}
