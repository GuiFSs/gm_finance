"use client";

import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";

import type { BudgetAllocationMode, BudgetStatus } from "@/entities/budget/model";
import {
  budgetStatus,
  fillRemainderAmount,
  fillRemainderPercent,
  resolveSiblingAmounts,
} from "@/shared/lib/budget-allocation";
import { formatCurrency } from "@/shared/utils/formatters";
import { Button } from "@/shared/ui/button";
import { CurrencyInput } from "@/shared/ui/currency-input";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { SelectOptions } from "@/shared/ui/select-options";
import { cn } from "@/shared/lib/cn";

import { CategoryPickerField } from "./category-picker-field";
import { TagPickerField } from "./tag-picker-field";

export type DraftAllocationNode = {
  uid: string;
  categoryId: string;
  tagId: string;
  allocationMode: BudgetAllocationMode;
  percent: number;
  amount: number;
  children: DraftAllocationNode[];
  expanded?: boolean;
  plannedAmount?: number;
  spentAmount?: number;
  status?: BudgetStatus;
};

type Named = { id: string; name: string };

type Props = {
  pool: number;
  nodes: DraftAllocationNode[];
  onChange: (nodes: DraftAllocationNode[]) => void;
  categories: Named[];
  tags: Named[];
  usedCategoryIds: string[];
  usedTagIds: string[];
  depth?: number;
  showActuals?: boolean;
};

function newNode(): DraftAllocationNode {
  return {
    uid: crypto.randomUUID(),
    categoryId: "",
    tagId: "",
    allocationMode: "percent",
    percent: 0,
    amount: 0,
    children: [],
    expanded: true,
  };
}

function statusLabel(status?: BudgetStatus): string {
  if (status === "over") return "Acima do plano";
  if (status === "on_track") return "No limite";
  if (status === "under") return "Dentro do plano";
  return "";
}

export function BudgetAllocationRows({
  pool,
  nodes,
  onChange,
  categories,
  tags,
  usedCategoryIds,
  usedTagIds,
  depth = 0,
  showActuals = false,
}: Props) {
  const isRootLevel = depth === 0;

  const groupMode: BudgetAllocationMode =
    nodes.length > 0 && nodes.every((n) => n.allocationMode === nodes[0]!.allocationMode)
      ? nodes[0]!.allocationMode
      : "percent";

  const previewAmounts = resolveSiblingAmounts(
    pool,
    nodes.map((n) => ({
      allocationMode: n.allocationMode,
      percent: n.percent,
      amount: n.amount,
    })),
  );

  const sumAllocated = previewAmounts.reduce((a, v) => a + v, 0);
  const remaining = Number((pool - sumAllocated).toFixed(2));

  const setGroupMode = (mode: BudgetAllocationMode) => {
    onChange(
      nodes.map((n, i) => {
        const amount = previewAmounts[i] ?? n.amount;
        const percent = pool > 0 ? Number(((amount / pool) * 100).toFixed(2)) : 0;
        return { ...n, allocationMode: mode, amount, percent };
      }),
    );
  };

  const updateNode = (uid: string, patch: Partial<DraftAllocationNode>) => {
    onChange(nodes.map((n) => (n.uid === uid ? { ...n, ...patch } : n)));
  };

  const removeNode = (uid: string) => {
    onChange(nodes.filter((n) => n.uid !== uid));
  };

  const fillRemainder = (uid: string) => {
    const idx = nodes.findIndex((n) => n.uid === uid);
    if (idx < 0) return;
    if (groupMode === "percent") {
      const next = fillRemainderPercent(
        nodes.map((n) => n.percent),
        idx,
      );
      onChange(nodes.map((n, i) => ({ ...n, percent: next[i] ?? 0, allocationMode: "percent" })));
    } else {
      const next = fillRemainderAmount(
        pool,
        nodes.map((n) => n.amount),
        idx,
      );
      onChange(nodes.map((n, i) => ({ ...n, amount: next[i] ?? 0, allocationMode: "amount" })));
    }
  };

  return (
    <div className={cn("space-y-3", depth > 0 && "ml-3 border-l border-border pl-3 sm:ml-4 sm:pl-4")}>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-[180px] flex-1 space-y-1">
          <Label>Como dividir</Label>
          <SelectOptions
            value={groupMode}
            onValueChange={(v) => setGroupMode(v as BudgetAllocationMode)}
            options={[
              { value: "amount", label: "Valores em reais (R$)" },
              { value: "percent", label: "Percentuais (%)" },
            ]}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>Disponível: {formatCurrency(pool)}</span>
          <span>·</span>
          <span>Alocado: {formatCurrency(sumAllocated)}</span>
          <span>·</span>
          <span className={remaining < -0.02 ? "text-destructive" : ""}>
            Restante: {formatCurrency(remaining)}
          </span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1"
          onClick={() => onChange([...nodes, newNode()])}
        >
          <Plus className="h-4 w-4" />
          Adicionar
        </Button>
      </div>

      {nodes.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma divisão neste nível.</p>
      ) : (
        <ul className="space-y-3">
          {nodes.map((node, index) => {
            const preview = previewAmounts[index] ?? 0;
            const excludeCategories = usedCategoryIds.filter((id) => id !== node.categoryId);
            const excludeTags = usedTagIds.filter((id) => id !== node.tagId);
            const hasChildren = node.children.length > 0;
            const expanded = node.expanded !== false;
            const showNodeActuals =
              showActuals &&
              ((isRootLevel && Boolean(node.categoryId)) || (!isRootLevel && Boolean(node.tagId)));

            return (
              <li key={node.uid} className="rounded-md border border-border p-3">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-start gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="mt-6 h-8 w-8 shrink-0"
                      onClick={() => updateNode(node.uid, { expanded: !expanded })}
                      aria-label={expanded ? "Recolher" : "Expandir"}
                    >
                      {expanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                    <div className="min-w-[160px] flex-1">
                      {isRootLevel ? (
                        <CategoryPickerField
                          categories={categories}
                          value={node.categoryId}
                          onChange={(categoryId) => updateNode(node.uid, { categoryId })}
                          excludeIds={excludeCategories}
                        />
                      ) : (
                        <TagPickerField
                          tags={tags}
                          value={node.tagId}
                          onChange={(tagId) => updateNode(node.uid, { tagId })}
                          excludeIds={excludeTags}
                        />
                      )}
                    </div>
                    {groupMode === "percent" ? (
                      <div className="w-28 space-y-1">
                        <Label>% </Label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step={0.01}
                          value={node.percent || ""}
                          onChange={(e) => {
                            const n = Number(e.target.value);
                            updateNode(node.uid, {
                              percent: Number.isFinite(n) ? n : 0,
                              allocationMode: "percent",
                            });
                          }}
                        />
                        <p className="text-xs text-muted-foreground">{formatCurrency(preview)}</p>
                      </div>
                    ) : (
                      <div className="w-36 space-y-1">
                        <Label>Valor</Label>
                        <CurrencyInput
                          value={node.amount}
                          onChange={(amount) =>
                            updateNode(node.uid, { amount, allocationMode: "amount" })
                          }
                        />
                        {pool > 0 && (
                          <p className="text-xs text-muted-foreground">
                            {((preview / pool) * 100).toFixed(1)}%
                          </p>
                        )}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1 pt-6">
                      <Button type="button" variant="outline" size="sm" onClick={() => fillRemainder(node.uid)}>
                        Restante
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          updateNode(node.uid, {
                            children: [...node.children, newNode()],
                            expanded: true,
                          })
                        }
                      >
                        Dividir
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => removeNode(node.uid)}
                        aria-label="Remover"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {showNodeActuals && (
                    <div
                      className={cn(
                        "rounded-md px-3 py-2 text-sm",
                        budgetStatus(preview, node.spentAmount ?? 0) === "over"
                          ? "bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300"
                          : "bg-muted/50 text-muted-foreground",
                      )}
                    >
                      Planejado {formatCurrency(preview)} · Gasto{" "}
                      {formatCurrency(node.spentAmount ?? 0)}
                      {` · ${statusLabel(budgetStatus(preview, node.spentAmount ?? 0))}`}
                    </div>
                  )}

                  {expanded && hasChildren && (
                    <BudgetAllocationRows
                      pool={preview}
                      nodes={node.children}
                      onChange={(children) => updateNode(node.uid, { children })}
                      categories={categories}
                      tags={tags}
                      usedCategoryIds={usedCategoryIds}
                      usedTagIds={usedTagIds}
                      depth={depth + 1}
                      showActuals={showActuals}
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function draftToPayload(nodes: DraftAllocationNode[]): Array<{
  categoryId: string | null;
  tagId: string | null;
  allocationMode: BudgetAllocationMode;
  percent: number;
  amount: number;
  children: ReturnType<typeof draftToPayload>;
}> {
  return nodes.map((n) => ({
    categoryId: n.categoryId || null,
    tagId: n.tagId || null,
    allocationMode: n.allocationMode,
    percent: n.percent,
    amount: n.amount,
    children: draftToPayload(n.children),
  }));
}

export function treeToDraft(
  nodes: Array<{
    id: string;
    categoryId: string | null;
    tagId: string | null;
    allocationMode: BudgetAllocationMode;
    percent: number | null;
    amount: number;
    children: unknown[];
    plannedAmount?: number;
    spentAmount?: number;
    status?: BudgetStatus;
  }>,
): DraftAllocationNode[] {
  return nodes.map((n) => ({
    uid: n.id || crypto.randomUUID(),
    categoryId: n.categoryId ?? "",
    tagId: n.tagId ?? "",
    allocationMode: n.allocationMode,
    percent: n.percent ?? 0,
    amount: n.amount,
    children: treeToDraft((n.children ?? []) as typeof nodes),
    expanded: true,
    plannedAmount: n.plannedAmount,
    spentAmount: n.spentAmount,
    status: n.status,
  }));
}

export function collectUsedCategoryIds(nodes: DraftAllocationNode[]): string[] {
  return nodes.map((n) => n.categoryId).filter(Boolean);
}

export function collectUsedTagIds(nodes: DraftAllocationNode[]): string[] {
  const ids: string[] = [];
  const walk = (list: DraftAllocationNode[]) => {
    for (const n of list) {
      if (n.tagId) ids.push(n.tagId);
      if (n.children.length) walk(n.children);
    }
  };
  walk(nodes);
  return ids;
}
