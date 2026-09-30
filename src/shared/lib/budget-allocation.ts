import { DEPOSIT_SUM_EPS, PERCENT_SUM_EPS, distributeAmountsByPercent } from "@/shared/lib/deposit-split";
import { formatCurrency } from "@/shared/utils/formatters";
import type {
  BudgetAllocationMode,
  BudgetAllocationNode,
  BudgetStatus,
  BudgetTotals,
} from "@/entities/budget/model";

export type SiblingInput = {
  allocationMode: BudgetAllocationMode;
  percent?: number | null;
  amount?: number | null;
};

/** Mapas opcionais para citar nomes nas mensagens de erro ao salvar. */
export type BudgetNameMaps = {
  categoryById?: Record<string, string>;
  tagById?: Record<string, string>;
};

function fmtPercent(value: number): string {
  return `${Number(value.toFixed(2))}%`;
}

function withScope(scope: string | undefined, phrase: string): string {
  return scope ? `${phrase} ${scope}` : phrase;
}

export type FlatAllocationRow = {
  id: string;
  parentId: string | null;
  categoryId: string | null;
  categoryName?: string | null;
  tagId: string | null;
  tagName?: string | null;
  allocationMode: BudgetAllocationMode;
  percent: number | null;
  amount: number;
  sortOrder: number;
};

/** Resolve amounts de um grupo de irmãos a partir do pool (renda ou amount do pai). */
export function resolveSiblingAmounts(pool: number, rows: SiblingInput[]): number[] {
  if (rows.length === 0) return [];

  const allPercent = rows.every((r) => r.allocationMode === "percent");
  if (allPercent) {
    const percents = rows.map((r) => Number(r.percent ?? 0));
    const sumP = percents.reduce((a, p) => a + p, 0);
    if (Math.abs(sumP - 100) <= PERCENT_SUM_EPS) {
      return distributeAmountsByPercent(pool, percents);
    }
  }

  return rows.map((r) => {
    if (r.allocationMode === "percent") {
      return Number((((pool * Number(r.percent ?? 0)) / 100) || 0).toFixed(2));
    }
    return Number((Number(r.amount ?? 0) || 0).toFixed(2));
  });
}

/**
 * Valida um grupo de irmãos contra o pool.
 * `scope` contextualiza o erro (ex.: "entre as categorias da renda").
 */
export function validateSiblingGroup(
  pool: number,
  rows: SiblingInput[],
  scope?: string,
): string | null {
  if (rows.length === 0) return null;
  if (pool < 0) {
    return withScope(scope, "O valor base da divisão não pode ser negativo");
  }

  const allPercent = rows.every((r) => r.allocationMode === "percent");
  if (allPercent) {
    const sumP = rows.reduce((a, r) => a + Number(r.percent ?? 0), 0);
    if (sumP - 100 > PERCENT_SUM_EPS) {
      const excess = Number((sumP - 100).toFixed(2));
      return `${withScope(scope, "A soma dos percentuais")} é ${fmtPercent(sumP)} (máximo 100%). Reduza ${fmtPercent(excess)}.`;
    }
    if (sumP < 0) {
      return `${withScope(scope, "Há percentuais inválidos")}. Use valores ≥ 0.`;
    }
  }

  const amounts = resolveSiblingAmounts(pool, rows);
  const sum = amounts.reduce((a, v) => a + v, 0);
  if (sum - pool > DEPOSIT_SUM_EPS) {
    const excess = Number((sum - pool).toFixed(2));
    return `${withScope(scope, "A soma das alocações")} é ${formatCurrency(sum)}, mas o disponível é ${formatCurrency(pool)}. Reduza ${formatCurrency(excess)}.`;
  }
  for (let i = 0; i < amounts.length; i++) {
    const amount = amounts[i]!;
    if (amount < 0) {
      return `${withScope(scope, `O valor da linha ${i + 1} não pode ser negativo`)}.`;
    }
  }
  return null;
}

export function assertUniqueRootCategoryIds(
  roots: { categoryId?: string | null }[],
  categoryById?: Record<string, string>,
): string | null {
  const missing: number[] = [];
  const seen = new Map<string, number>();
  for (let i = 0; i < roots.length; i++) {
    const line = i + 1;
    const id = roots[i]?.categoryId?.trim();
    if (!id) {
      missing.push(line);
      continue;
    }
    const first = seen.get(id);
    if (first != null) {
      const name = categoryById?.[id];
      return name
        ? `A categoria "${name}" está duplicada (linhas ${first} e ${line}). Cada categoria só pode aparecer uma vez.`
        : `Há categoria duplicada nas linhas ${first} e ${line}. Cada categoria só pode aparecer uma vez.`;
    }
    seen.set(id, line);
  }
  if (missing.length === 1) {
    return `Selecione a categoria na divisão principal nº ${missing[0]}.`;
  }
  if (missing.length > 1) {
    return `Selecione a categoria nas divisões principais nº ${missing.join(", ")}.`;
  }
  return null;
}

export function assertUniqueTagIds(
  nodes: { tagId?: string | null }[],
  options?: { tagById?: Record<string, string>; scope?: string },
): string | null {
  const missing: number[] = [];
  const seen = new Map<string, number>();
  const scope = options?.scope;
  const tagById = options?.tagById;

  for (let i = 0; i < nodes.length; i++) {
    const line = i + 1;
    const id = nodes[i]?.tagId?.trim();
    if (!id) {
      missing.push(line);
      continue;
    }
    const first = seen.get(id);
    if (first != null) {
      const name = tagById?.[id];
      const where = scope ? ` ${scope}` : "";
      return name
        ? `A tag "${name}" está duplicada${where} (linhas ${first} e ${line}). Cada tag só pode aparecer uma vez no orçamento.`
        : `Há tag duplicada${where} nas linhas ${first} e ${line}. Cada tag só pode aparecer uma vez no orçamento.`;
    }
    seen.set(id, line);
  }
  if (missing.length === 1) {
    const where = scope ? ` ${scope}` : "";
    return `Selecione a tag na subdivisão nº ${missing[0]}${where}.`;
  }
  if (missing.length > 1) {
    const where = scope ? ` ${scope}` : "";
    return `Selecione a tag nas subdivisões nº ${missing.join(", ")}${where}.`;
  }
  return null;
}

export function collectTreeNodes(tree: BudgetAllocationNode[]): BudgetAllocationNode[] {
  const out: BudgetAllocationNode[] = [];
  const walk = (nodes: BudgetAllocationNode[]) => {
    for (const n of nodes) {
      out.push(n);
      if (n.children?.length) walk(n.children);
    }
  };
  walk(tree);
  return out;
}

export function buildAllocationTree(flatRows: FlatAllocationRow[]): BudgetAllocationNode[] {
  const byParent = new Map<string | null, FlatAllocationRow[]>();
  for (const row of flatRows) {
    const key = row.parentId;
    const list = byParent.get(key) ?? [];
    list.push(row);
    byParent.set(key, list);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
  }

  const build = (parentId: string | null): BudgetAllocationNode[] => {
    const rows = byParent.get(parentId) ?? [];
    return rows.map((row) => ({
      id: row.id,
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      tagId: row.tagId,
      tagName: row.tagName,
      allocationMode: row.allocationMode,
      percent: row.percent,
      amount: row.amount,
      sortOrder: row.sortOrder,
      children: build(row.id),
    }));
  };

  return build(null);
}

export type FlattenedInsert = {
  id: string;
  parentId: string | null;
  categoryId: string | null;
  tagId: string | null;
  allocationMode: BudgetAllocationMode;
  percent: number | null;
  amount: number;
  sortOrder: number;
};

export type TreeInputNode = {
  id?: string;
  categoryId?: string | null;
  tagId?: string | null;
  allocationMode: BudgetAllocationMode;
  percent?: number | null;
  amount?: number | null;
  children?: TreeInputNode[];
};

function nodeLabel(
  node: TreeInputNode,
  index: number,
  isRoot: boolean,
  names?: BudgetNameMaps,
): string {
  if (isRoot) {
    const id = node.categoryId?.trim();
    const name = id ? names?.categoryById?.[id] : undefined;
    return name ? `"${name}"` : `categoria nº ${index + 1}`;
  }
  const id = node.tagId?.trim();
  const name = id ? names?.tagById?.[id] : undefined;
  return name ? `"${name}"` : `tag nº ${index + 1}`;
}

function validateTreeRefs(tree: TreeInputNode[], names?: BudgetNameMaps): string | null {
  const uniqueCatErr = assertUniqueRootCategoryIds(tree, names?.categoryById);
  if (uniqueCatErr) return uniqueCatErr;

  const allTags: { tagId?: string | null }[] = [];
  const walkChildren = (nodes: TreeInputNode[], parentLabel: string): string | null => {
    if (nodes.length === 0) return null;
    const localErr = assertUniqueTagIds(nodes, {
      tagById: names?.tagById,
      scope: `em ${parentLabel}`,
    });
    if (localErr) return localErr;

    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i]!;
      allTags.push({ tagId: n.tagId });
      const children = n.children ?? [];
      if (children.length > 0) {
        const childErr = walkChildren(children, nodeLabel(n, i, false, names));
        if (childErr) return childErr;
      }
    }
    return null;
  };

  for (let i = 0; i < tree.length; i++) {
    const root = tree[i]!;
    const children = root.children ?? [];
    if (children.length === 0) continue;
    const childErr = walkChildren(children, nodeLabel(root, i, true, names));
    if (childErr) return childErr;
  }

  // Unicidade global de tags (além da checagem por grupo)
  if (allTags.length > 1) {
    const seen = new Map<string, true>();
    for (const t of allTags) {
      const id = t.tagId?.trim();
      if (!id) continue;
      if (seen.has(id)) {
        const name = names?.tagById?.[id];
        return name
          ? `A tag "${name}" aparece mais de uma vez no orçamento. Cada tag só pode ser usada uma vez.`
          : "A mesma tag aparece mais de uma vez no orçamento. Cada tag só pode ser usada uma vez.";
      }
      seen.set(id, true);
    }
  }
  return null;
}

/**
 * Resolve amounts top-down e achata a árvore para insert.
 * Raiz: categoryId; filhos: tagId.
 */
export function flattenAndResolveTree(
  incomeAmount: number,
  tree: TreeInputNode[],
  makeId: () => string = () => crypto.randomUUID(),
  names?: BudgetNameMaps,
): { rows: FlattenedInsert[]; error: string | null } {
  const refErr = validateTreeRefs(tree, names);
  if (refErr) return { rows: [], error: refErr };

  const rows: FlattenedInsert[] = [];

  const resolveGroup = (
    pool: number,
    nodes: TreeInputNode[],
    parentId: string | null,
    isRoot: boolean,
    scope: string,
  ): string | null => {
    if (nodes.length === 0) return null;
    const err = validateSiblingGroup(
      pool,
      nodes.map((n) => ({
        allocationMode: n.allocationMode,
        percent: n.percent,
        amount: n.amount,
      })),
      scope,
    );
    if (err) return err;

    const amounts = resolveSiblingAmounts(
      pool,
      nodes.map((n) => ({
        allocationMode: n.allocationMode,
        percent: n.percent,
        amount: n.amount,
      })),
    );

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]!;
      const amount = amounts[i] ?? 0;
      const id = node.id?.trim() || makeId();
      let percent = Number(node.percent ?? 0);
      if (node.allocationMode !== "percent") {
        percent = pool > 0 ? Number(((amount / pool) * 100).toFixed(2)) : 0;
      }

      rows.push({
        id,
        parentId,
        categoryId: isRoot ? (node.categoryId?.trim() || null) : null,
        tagId: isRoot ? null : (node.tagId?.trim() || null),
        allocationMode: node.allocationMode,
        percent,
        amount,
        sortOrder: i,
      });

      const children = node.children ?? [];
      if (children.length > 0) {
        const parentName = nodeLabel(node, i, isRoot, names);
        const childScope = isRoot
          ? `entre as tags de ${parentName}`
          : `entre as subdivisões de ${parentName}`;
        const childErr = resolveGroup(amount, children, id, false, childScope);
        if (childErr) return childErr;
      }
    }
    return null;
  };

  const error = resolveGroup(incomeAmount, tree, null, true, "entre as categorias da renda");
  return { rows, error };
}

export function computeBudgetTotals(incomeAmount: number, tree: BudgetAllocationNode[]): BudgetTotals {
  const allocatedRoot = tree.reduce((a, n) => a + n.amount, 0);
  const remainingRoot = Number((incomeAmount - allocatedRoot).toFixed(2));
  const allocatedPercentOfIncome =
    incomeAmount > 0 ? Number(((allocatedRoot / incomeAmount) * 100).toFixed(2)) : 0;
  return { allocatedRoot, remainingRoot, allocatedPercentOfIncome };
}

export function budgetStatus(planned: number, spent: number): BudgetStatus {
  if (spent > planned + DEPOSIT_SUM_EPS) return "over";
  if (planned <= 0) return spent > DEPOSIT_SUM_EPS ? "over" : "under";
  const ratio = spent / planned;
  if (ratio >= 0.9) return "on_track";
  return "under";
}

/**
 * Anexa spent/status.
 * Raiz: gasto por categoryId. Filhos: gasto por tagId (compras com essa tag no mês).
 */
export function attachActualsToTree(
  tree: BudgetAllocationNode[],
  actualsByCategoryId: Record<string, number>,
  actualsByTagId: Record<string, number> = {},
): BudgetAllocationNode[] {
  const enrich = (node: BudgetAllocationNode): BudgetAllocationNode => {
    const children = (node.children ?? []).map(enrich);
    const plannedAmount = node.amount;
    let spentAmount: number | undefined;
    let status: BudgetStatus | undefined;

    if (node.categoryId) {
      spentAmount = actualsByCategoryId[node.categoryId] ?? 0;
      status = budgetStatus(plannedAmount, spentAmount);
    } else if (node.tagId) {
      spentAmount = actualsByTagId[node.tagId] ?? 0;
      status = budgetStatus(plannedAmount, spentAmount);
    }

    return {
      ...node,
      children,
      plannedAmount,
      spentAmount,
      spentChildrenSum: 0,
      status,
    };
  };
  return tree.map(enrich);
}

export function fillRemainderAmount(pool: number, amounts: number[], lastIndex: number): number[] {
  if (amounts.length === 0 || lastIndex < 0 || lastIndex >= amounts.length) return amounts;
  const others = amounts.reduce((a, v, i) => (i === lastIndex ? a : a + v), 0);
  const next = [...amounts];
  next[lastIndex] = Number(Math.max(0, pool - others).toFixed(2));
  return next;
}

export function fillRemainderPercent(percents: number[], lastIndex: number): number[] {
  if (percents.length === 0 || lastIndex < 0 || lastIndex >= percents.length) return percents;
  const others = percents.reduce((a, v, i) => (i === lastIndex ? a : a + v), 0);
  const next = [...percents];
  next[lastIndex] = Number(Math.max(0, 100 - others).toFixed(2));
  return next;
}
