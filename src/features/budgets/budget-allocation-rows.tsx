"use client";

import { useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronRight, GripVertical, MoreHorizontal, Plus, X } from "lucide-react";

import type { BudgetAllocationMode, BudgetStatus } from "@/entities/budget/model";
import { budgetStatus, resolveSiblingAmounts } from "@/shared/lib/budget-allocation";
import { formatAmount } from "@/features/month/month-model";
import { PlaneBar } from "@/features/month/plane-bar";
import { Button } from "@/shared/ui/button";
import { CurrencyInput } from "@/shared/ui/currency-input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Input } from "@/shared/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/toggle-group";
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

type SortableRowProps = {
  node: DraftAllocationNode;
  preview: number;
  pool: number;
  isRootLevel: boolean;
  showActuals: boolean;
  categories: Named[];
  tags: Named[];
  excludeCategories: string[];
  excludeTags: string[];
  usedCategoryIds: string[];
  usedTagIds: string[];
  depth: number;
  onUpdate: (uid: string, patch: Partial<DraftAllocationNode>) => void;
  onRemove: (uid: string) => void;
  onSetMode: (uid: string, mode: BudgetAllocationMode) => void;
  onFillRemainder: (uid: string) => void;
};

function SortableAllocationRow({
  node,
  preview,
  pool,
  isRootLevel,
  showActuals,
  categories,
  tags,
  excludeCategories,
  excludeTags,
  usedCategoryIds,
  usedTagIds,
  depth,
  onUpdate,
  onRemove,
  onSetMode,
  onFillRemainder,
}: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: node.uid,
  });

  const hasChildren = node.children.length > 0;
  const expanded = node.expanded !== false;
  const showNodeActuals =
    showActuals &&
    ((isRootLevel && Boolean(node.categoryId)) || (!isRootLevel && Boolean(node.tagId)));

  const spent = node.spentAmount ?? 0;
  const status = budgetStatus(preview, spent);

  return (
    <li
      ref={setNodeRef}
      id={`budget-row-${node.uid}`}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn("border-t border-border py-3 first:border-t-0", isDragging && "relative z-10 bg-card opacity-90")}
    >
      <div className="flex items-start gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="-ml-2 shrink-0 cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
          aria-label="Arrastar para reordenar"
          {...attributes}
          {...listeners}
        >
          <GripVertical />
        </Button>
        <div className="min-w-0 flex-1">
          {isRootLevel ? (
            <CategoryPickerField
              categories={categories}
              value={node.categoryId}
              onChange={(categoryId) => onUpdate(node.uid, { categoryId })}
              excludeIds={excludeCategories}
            />
          ) : (
            <TagPickerField
              tags={tags}
              value={node.tagId}
              onChange={(tagId) => onUpdate(node.uid, { tagId })}
              excludeIds={excludeTags}
            />
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="-mr-2 shrink-0 text-muted-foreground hover:text-ink-out"
          onClick={() => onRemove(node.uid)}
          aria-label="Remover divisão"
        >
          <X />
        </Button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 pl-8">
        <ToggleGroup
          type="single"
          value={node.allocationMode}
          onValueChange={(v) => v && onSetMode(node.uid, v as BudgetAllocationMode)}
          aria-label="Dividir em"
          className="gap-0 border border-input"
        >
          <ToggleGroupItem value="amount" className="h-10 px-3 data-[state=on]:bg-foreground data-[state=on]:text-background">
            R$
          </ToggleGroupItem>
          <ToggleGroupItem value="percent" className="h-10 px-3 data-[state=on]:bg-foreground data-[state=on]:text-background">
            %
          </ToggleGroupItem>
        </ToggleGroup>
        {node.allocationMode === "percent" ? (
          <Input
            aria-label="Percentual"
            type="number"
            inputMode="decimal"
            min={0}
            max={100}
            step={0.01}
            className="w-24"
            value={node.percent || ""}
            onChange={(e) => {
              const n = Number(e.target.value);
              onUpdate(node.uid, {
                percent: Number.isFinite(n) ? n : 0,
                allocationMode: "percent",
              });
            }}
          />
        ) : (
          <CurrencyInput
            aria-label="Valor"
            className="w-36"
            value={node.amount}
            onChange={(amount) => onUpdate(node.uid, { amount, allocationMode: "amount" })}
          />
        )}
        <span className="text-[15px] tabular-nums text-muted-foreground">
          {node.allocationMode === "percent"
            ? formatAmount(preview)
            : pool > 0
              ? `${((preview / pool) * 100).toFixed(1).replace(".", ",")}%`
              : null}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="-mr-2 ml-auto text-muted-foreground" aria-label="Mais ações">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onFillRemainder(node.uid)}>usar o restante</DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() =>
                onUpdate(node.uid, {
                  children: [...node.children, newNode()],
                  expanded: true,
                })
              }
            >
              <Plus aria-hidden />
              dividir em tags
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {showNodeActuals ? (
        <div className="mt-3 pl-8">
          <PlaneBar
            size="sm"
            label={`Gasto ${formatAmount(spent)} de ${formatAmount(preview)}`}
            segments={[{ key: "planned", value: Math.max(preview, spent), tone: "forecast", fill: preview > 0 ? spent / preview : spent > 0 ? 2 : 0 }]}
          />
          <p className={cn("mt-1.5 text-[15px] tabular-nums", status === "over" ? "text-ink-out" : "text-muted-foreground")}>
            gasto {formatAmount(spent)}
            {status === "over" ? ` · passou ${formatAmount(spent - preview)}` : null}
          </p>
        </div>
      ) : null}

      {hasChildren ? (
        <div className="mt-1 pl-5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1 text-muted-foreground"
            onClick={() => onUpdate(node.uid, { expanded: !expanded })}
            aria-expanded={expanded}
          >
            {expanded ? <ChevronDown aria-hidden /> : <ChevronRight aria-hidden />}
            {node.children.length} {node.children.length === 1 ? "tag" : "tags"}
          </Button>
        </div>
      ) : null}

      {expanded && hasChildren ? (
        <BudgetAllocationRows
          pool={preview}
          nodes={node.children}
          onChange={(children) => onUpdate(node.uid, { children })}
          categories={categories}
          tags={tags}
          usedCategoryIds={usedCategoryIds}
          usedTagIds={usedTagIds}
          depth={depth + 1}
          showActuals={showActuals}
        />
      ) : null}
    </li>
  );
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
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

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

  const updateNode = (uid: string, patch: Partial<DraftAllocationNode>) => {
    onChange(nodes.map((n) => (n.uid === uid ? { ...n, ...patch } : n)));
  };

  const removeNode = (uid: string) => {
    onChange(nodes.filter((n) => n.uid !== uid));
  };

  const setNodeMode = (uid: string, mode: BudgetAllocationMode) => {
    const idx = nodes.findIndex((n) => n.uid === uid);
    if (idx < 0) return;
    const node = nodes[idx]!;
    if (node.allocationMode === mode) return;
    const amount = previewAmounts[idx] ?? node.amount;
    const percent = pool > 0 ? Number(((amount / pool) * 100).toFixed(2)) : 0;
    updateNode(uid, { allocationMode: mode, amount, percent });
  };

  const fillRemainder = (uid: string) => {
    const idx = nodes.findIndex((n) => n.uid === uid);
    if (idx < 0) return;
    const node = nodes[idx]!;
    const othersSum = previewAmounts.reduce((a, v, i) => (i === idx ? a : a + v), 0);
    const remainder = Number(Math.max(0, pool - othersSum).toFixed(2));
    const percent = pool > 0 ? Number(((remainder / pool) * 100).toFixed(2)) : 0;
    if (node.allocationMode === "percent") {
      updateNode(uid, { percent, amount: remainder });
    } else {
      updateNode(uid, { amount: remainder, percent });
    }
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;
    const oldIndex = nodes.findIndex((n) => n.uid === active.id);
    const newIndex = nodes.findIndex((n) => n.uid === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onChange(arrayMove(nodes, oldIndex, newIndex));
  };

  return (
    <div className={cn(depth > 0 && "ml-8 mt-2 border-l border-border pl-3")}>
      {depth > 0 ? (
        <p className={cn("pb-1 text-[15px] tabular-nums", remaining < -0.02 ? "text-ink-out" : "text-muted-foreground")}>
          {remaining < -0.02
            ? `passou ${formatAmount(-remaining)} de ${formatAmount(pool)}`
            : `restam ${formatAmount(remaining)} de ${formatAmount(pool)}`}
        </p>
      ) : null}

      {nodes.length > 0 ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={(e) => setActiveId(String(e.active.id))}
          onDragCancel={() => setActiveId(null)}
          onDragEnd={onDragEnd}
        >
          <SortableContext items={nodes.map((n) => n.uid)} strategy={verticalListSortingStrategy}>
            <ul className={cn(activeId && "select-none")}>
              {nodes.map((node, index) => {
                const preview = previewAmounts[index] ?? 0;
                const excludeCategories = usedCategoryIds.filter((id) => id !== node.categoryId);
                const excludeTags = usedTagIds.filter((id) => id !== node.tagId);

                return (
                  <SortableAllocationRow
                    key={node.uid}
                    node={node}
                    preview={preview}
                    pool={pool}
                    isRootLevel={isRootLevel}
                    showActuals={showActuals}
                    categories={categories}
                    tags={tags}
                    excludeCategories={excludeCategories}
                    excludeTags={excludeTags}
                    usedCategoryIds={usedCategoryIds}
                    usedTagIds={usedTagIds}
                    depth={depth}
                    onUpdate={updateNode}
                    onRemove={removeNode}
                    onSetMode={setNodeMode}
                    onFillRemainder={fillRemainder}
                  />
                );
              })}
            </ul>
          </SortableContext>
        </DndContext>
      ) : null}

      <Button
        type="button"
        variant={isRootLevel ? "outline" : "ghost"}
        size="sm"
        className={cn("gap-1.5", isRootLevel ? "mt-3" : "-ml-3 text-muted-foreground")}
        onClick={() => onChange([...nodes, newNode()])}
      >
        <Plus aria-hidden />
        {isRootLevel ? "categoria" : "tag"}
      </Button>
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
