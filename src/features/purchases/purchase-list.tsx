"use client";

import { ChevronsUpDown, Eye, EyeOff, ListFilter, Plus, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { PurchaseDetailDialog } from "@/features/purchases/purchase-detail-dialog";
import {
  useCards,
  useCategories,
  useCreateCategory,
  useCreateTag,
  useCurrentUser,
  usePockets,
  usePurchases,
  useTags,
  useUsers,
  type PurchaseRow,
} from "@/shared/hooks/use-app-data";
import { DayTile, LedgerRow } from "@/features/month/ledger";
import { dayOfMonth, formatAmount, monthLabel } from "@/features/month/month-model";
import { formatCurrency } from "@/shared/utils/formatters";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Modal } from "@/shared/ui/modal";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { SelectOptions } from "@/shared/ui/select-options";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/shared/ui/sheet";
import { PurchaseForm } from "@/features/purchases/purchase-form";

const PAYMENT_LABEL: Record<string, string> = {
  account: "conta",
  pocket: "caixinha",
  card: "cartão",
};

const defaultFilters = {
  categoryIds: [] as string[],
  tagIds: [] as string[],
  uncategorized: false,
  untagged: false,
  /** Valor do select de meio de pagamento: "", "account", "card", "card:<id>", "pocket" ou "pocket:<id>". */
  payment: "",
  userId: "",
  startDate: "",
  endDate: "",
};

type PaymentFilterParams = {
  paymentSourceType?: "account" | "pocket" | "card";
  paymentSourceId?: string;
};

/** Converte a opção escolhida no select em parâmetros da API de compras. */
function parsePaymentFilter(value: string): PaymentFilterParams {
  if (!value) return {};
  const [type, id] = value.split(":");
  if (type === "account") return { paymentSourceType: "account" };
  if (type === "pocket" || type === "card") {
    return { paymentSourceType: type, paymentSourceId: id || undefined };
  }
  return {};
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;

/** Filtros vindos da URL, ex.: ao tocar numa categoria ou tag no dashboard. */
function filtersFromSearchParams(params: URLSearchParams): typeof defaultFilters {
  const categoryId = params.get("categoryId");
  const tagId = params.get("tagId");
  const startDate = params.get("startDate") ?? "";
  const endDate = params.get("endDate") ?? "";
  return {
    ...defaultFilters,
    categoryIds: categoryId ? [categoryId] : [],
    tagIds: tagId ? [tagId] : [],
    uncategorized: params.get("uncategorized") === "1",
    untagged: params.get("untagged") === "1",
    startDate: YMD.test(startDate) ? startDate : "",
    endDate: YMD.test(endDate) ? endDate : "",
  };
}

type EntityOption = { id: string; name: string };

function MultiEntityFilter({
  label,
  options,
  selectedIds,
  onChange,
  emptySummary,
  clearLabel,
}: {
  label: string;
  options: EntityOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  emptySummary: string;
  clearLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(
    (id: string) => {
      onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
    },
    [onChange, selectedIds],
  );
  const summary = useMemo(() => {
    if (selectedIds.length === 0) return emptySummary;
    if (selectedIds.length === 1) {
      return options.find((o) => o.id === selectedIds[0])?.name ?? "1 selecionada";
    }
    return `${selectedIds.length} selecionadas`;
  }, [emptySummary, options, selectedIds]);

  return (
    <div className="space-y-1.5">
      <span className="text-[15px] font-medium text-foreground">{label}</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" className="h-10 w-full justify-between font-normal" type="button">
            <span className="truncate">{summary}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-2" align="start">
          <div className="max-h-60 space-y-0.5 overflow-y-auto">
            {options.length === 0 ? (
              <p className="px-2 py-3 text-[15px] text-muted-foreground">Nenhuma opção</p>
            ) : (
              options.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => toggle(opt.id)}
                  className="flex w-full cursor-pointer items-center gap-2 px-2 py-2 text-left text-[15px] hover:bg-accent"
                >
                  <Checkbox checked={selectedIds.includes(opt.id)} className="pointer-events-none" />
                  <span className="truncate">{opt.name}</span>
                </button>
              ))
            )}
          </div>
          {selectedIds.length > 0 ? (
            <Button variant="ghost" size="sm" className="mt-2 h-8 w-full" onClick={() => onChange([])} type="button">
              {clearLabel}
            </Button>
          ) : null}
        </PopoverContent>
      </Popover>
    </div>
  );
}

type PurchaseGroup = {
  key: string;
  detailPurchaseId: string;
  title: string;
  totalAmount: number;
  firstDate: string;
  lastDate: string;
  categoryName: string | null;
  userName: string | null;
  paymentSourceType: PurchaseRow["paymentSourceType"];
  installmentCount: number;
  tags: string[];
};

/** Groups installment rows of the same purchase via seriesId — never by title. */
function groupPurchases(rows: PurchaseRow[]): PurchaseGroup[] {
  const map = new Map<string, PurchaseRow[]>();
  for (const p of rows) {
    const k = p.seriesId || p.id;
    const arr = map.get(k) ?? [];
    arr.push(p);
    map.set(k, arr);
  }
  const out: PurchaseGroup[] = [];
  for (const [seriesId, groupRows] of map) {
    groupRows.sort((a, b) => a.installmentNumber - b.installmentNumber);
    const first = groupRows[0]!;
    const last = groupRows[groupRows.length - 1]!;
    const totalAmount = groupRows.reduce((s, r) => s + r.amount, 0);
    const tagSet = new Set<string>();
    for (const r of groupRows) for (const t of r.tags) tagSet.add(t);
    out.push({
      key: seriesId,
      detailPurchaseId: first.id,
      title: first.title,
      totalAmount,
      firstDate: first.purchaseDate,
      lastDate: last.purchaseDate,
      categoryName: first.categoryName,
      userName: first.userName,
      paymentSourceType: first.paymentSourceType,
      installmentCount: first.installmentCount,
      tags: [...tagSet],
    });
  }
  return out;
}

type PurchaseSortKey = "date_desc" | "date_asc" | "amount_desc" | "amount_asc";

function sortPurchaseGroups(groups: PurchaseGroup[], sortKey: PurchaseSortKey): PurchaseGroup[] {
  const copy = [...groups];
  switch (sortKey) {
    case "date_desc":
      copy.sort((a, b) => b.firstDate.localeCompare(a.firstDate));
      break;
    case "date_asc":
      copy.sort((a, b) => a.firstDate.localeCompare(b.firstDate));
      break;
    case "amount_desc":
      copy.sort((a, b) => b.totalAmount - a.totalAmount);
      break;
    case "amount_asc":
      copy.sort((a, b) => a.totalAmount - b.totalAmount);
      break;
    default:
      break;
  }
  return copy;
}

function groupByMonth(groups: PurchaseGroup[]) {
  const out: Array<{ month: string; items: PurchaseGroup[]; total: number }> = [];
  for (const g of groups) {
    const month = g.firstDate.slice(0, 7);
    const last = out[out.length - 1];
    if (last && last.month === month) {
      last.items.push(g);
      last.total += g.totalAmount;
    } else {
      out.push({ month, items: [g], total: g.totalAmount });
    }
  }
  return out;
}

function PurchaseRowItem({ g, onOpen }: { g: PurchaseGroup; onOpen: () => void }) {
  const meta = [
    g.categoryName ?? "sem categoria",
    PAYMENT_LABEL[g.paymentSourceType] ?? g.paymentSourceType,
    g.installmentCount > 1 ? `${g.installmentCount}×` : null,
    g.userName,
    ...g.tags.map((t) => `#${t}`),
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <LedgerRow
      tile={<DayTile day={dayOfMonth(g.firstDate)} tone="neutral" />}
      title={g.title}
      meta={meta}
      amount={
        <span className="block">
          {formatAmount(g.totalAmount, "−")}
          {g.installmentCount > 1 ? (
            <span className="block text-[15px] font-normal text-muted-foreground">
              {g.installmentCount}× {formatAmount(g.totalAmount / g.installmentCount)}
            </span>
          ) : null}
        </span>
      }
      onOpen={onOpen}
      openLabel={`Ver ${g.title}`}
    />
  );
}

export function PurchaseList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState(() => filtersFromSearchParams(searchParams));
  const [openPurchaseModal, setOpenPurchaseModal] = useState(false);
  const [editPurchaseId, setEditPurchaseId] = useState<string | null>(null);
  const [openCategoryModal, setOpenCategoryModal] = useState(false);
  const [openTagModal, setOpenTagModal] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortKey, setSortKey] = useState<PurchaseSortKey>("date_desc");
  /** Valores agregados (total e total por mês) ficam escondidos a cada visita. */
  const [showTotals, setShowTotals] = useState(false);

  const editFromUrl = searchParams.get("edit");
  const newFromUrl = searchParams.get("new");
  const urlIntent = editFromUrl ? `edit:${editFromUrl}` : newFromUrl ? "new" : null;
  const [handledIntent, setHandledIntent] = useState<string | null>(null);
  if (urlIntent !== handledIntent) {
    setHandledIntent(urlIntent);
    if (urlIntent) {
      setEditPurchaseId(editFromUrl);
      setOpenPurchaseModal(true);
    }
  }
  useEffect(() => {
    if (!urlIntent) return;
    router.replace("/purchases", { scroll: false });
  }, [urlIntent, router]);

  const purchases = usePurchases({
    categoryIds: filters.categoryIds.length ? filters.categoryIds : undefined,
    tagIds: filters.tagIds.length ? filters.tagIds : undefined,
    uncategorized: filters.uncategorized || undefined,
    untagged: filters.untagged || undefined,
    ...parsePaymentFilter(filters.payment),
    userId: filters.userId || undefined,
    startDate: filters.startDate || undefined,
    endDate: filters.endDate || undefined,
  });

  const categories = useCategories();
  const users = useUsers();
  const tags = useTags();
  const pockets = usePockets();
  const cards = useCards();
  const paymentOptions = useMemo(
    () => [
      { value: "", label: "Todos" },
      { value: "account", label: "Conta corrente" },
      { value: "card", label: "Todos os cartões" },
      ...(cards.data ?? []).map((c) => ({ value: `card:${c.id}`, label: `Cartão ${c.name}` })),
      { value: "pocket", label: "Todas as caixinhas" },
      ...(pockets.data ?? []).map((p) => ({ value: `pocket:${p.id}`, label: `Caixinha ${p.name}` })),
    ],
    [cards.data, pockets.data],
  );
  const currentUser = useCurrentUser();
  const createCategory = useCreateCategory();
  const createTag = useCreateTag();
  const categoryForm = useForm<{ name: string }>({ defaultValues: { name: "" } });
  const tagForm = useForm<{ name: string }>({ defaultValues: { name: "" } });

  const addCategory = categoryForm.handleSubmit(async ({ name }) => {
    if (!currentUser.data?.id) return;
    await createCategory.mutateAsync({ name, createdByUserId: currentUser.data.id });
    categoryForm.reset();
    toast.success("Categoria criada");
    setOpenCategoryModal(false);
  });

  const addTag = tagForm.handleSubmit(async ({ name }) => {
    if (!currentUser.data?.id) return;
    await createTag.mutateAsync({ name, createdByUserId: currentUser.data.id });
    tagForm.reset();
    toast.success("Tag criada");
    setOpenTagModal(false);
  });

  const activeFilterLabels = useMemo(() => {
    const labels: string[] = [];
    const catName = new Map((categories.data ?? []).map((c) => [c.id, c.name]));
    const tagName = new Map((tags.data ?? []).map((t) => [t.id, t.name]));
    if (filters.uncategorized) labels.push("sem categoria");
    for (const id of filters.categoryIds) labels.push(catName.get(id) ?? "categoria");
    if (filters.untagged) labels.push("sem tag");
    for (const id of filters.tagIds) labels.push(`#${tagName.get(id) ?? "tag"}`);
    if (filters.payment) labels.push(paymentOptions.find((o) => o.value === filters.payment)?.label ?? "pagamento");
    if (filters.userId) labels.push((users.data ?? []).find((u) => u.id === filters.userId)?.name ?? "usuário");
    if (filters.startDate || filters.endDate) {
      const fmt = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
      labels.push(
        filters.startDate && filters.endDate
          ? `${fmt(filters.startDate)}–${fmt(filters.endDate)}`
          : filters.startDate
            ? `desde ${fmt(filters.startDate)}`
            : `até ${fmt(filters.endDate)}`,
      );
    }
    return labels;
  }, [filters, categories.data, tags.data, users.data, paymentOptions]);
  const hasActiveFilters = activeFilterLabels.length > 0;

  const list = purchases.data ?? [];
  const isLoading = purchases.isLoading;
  const grouped = useMemo(() => sortPurchaseGroups(groupPurchases(list), sortKey), [list, sortKey]);
  const byMonth = sortKey.startsWith("date") ? groupByMonth(grouped) : null;
  const total = grouped.reduce((s, g) => s + g.totalAmount, 0);

  const openNew = () => {
    setEditPurchaseId(null);
    setOpenPurchaseModal(true);
  };

  return (
    <div className="pb-4">
      <PurchaseDetailDialog
        purchaseId={detailId}
        open={detailId !== null}
        onOpenChange={(open) => {
          if (!open) setDetailId(null);
        }}
        title="Detalhes da compra"
        onEdit={(id) => {
          setDetailId(null);
          setEditPurchaseId(id);
          setOpenPurchaseModal(true);
        }}
        onDeleted={() => setDetailId(null)}
      />

      <Modal
        open={openPurchaseModal}
        onClose={() => {
          setOpenPurchaseModal(false);
          setEditPurchaseId(null);
        }}
        title={editPurchaseId ? "editar compra" : "nova compra"}
        size="2xl"
      >
        <PurchaseForm
          key={editPurchaseId ?? "new-purchase"}
          purchaseId={editPurchaseId}
          onSuccess={() => {
            setOpenPurchaseModal(false);
            setEditPurchaseId(null);
          }}
          onCancel={() => {
            setOpenPurchaseModal(false);
            setEditPurchaseId(null);
          }}
        />
      </Modal>

      <Modal open={openCategoryModal} onClose={() => setOpenCategoryModal(false)} title="Nova categoria" size="sm">
        <form onSubmit={addCategory} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-category">Nome</Label>
            <Input id="new-category" placeholder="Ex: Alimentação" {...categoryForm.register("name")} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpenCategoryModal(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createCategory.isPending}>
              {createCategory.isPending ? "Salvando…" : "Criar categoria"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={openTagModal} onClose={() => setOpenTagModal(false)} title="Nova tag" size="sm">
        <form onSubmit={addTag} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-tag">Nome</Label>
            <Input id="new-tag" placeholder="Ex: mercado" {...tagForm.register("name")} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpenTagModal(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createTag.isPending}>
              {createTag.isPending ? "Salvando…" : "Criar tag"}
            </Button>
          </div>
        </form>
      </Modal>

      <header className="flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-bold lowercase leading-none tracking-tight text-foreground">compras</h1>
      </header>
      <div className="mt-2 flex items-center gap-1 text-[15px] text-muted-foreground tabular-nums">
        <span>
          {isLoading
            ? "Carregando…"
            : `${grouped.length} ${grouped.length === 1 ? "compra" : "compras"} · ${showTotals ? formatCurrency(total) : "R$ •••••"}`}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground"
          onClick={() => setShowTotals((value) => !value)}
          aria-label={showTotals ? "Ocultar valor total" : "Mostrar valor total"}
          aria-pressed={showTotals}
          disabled={isLoading}
        >
          {showTotals ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
        </Button>
      </div>

      <div className="sticky top-0 z-20 -mx-4 mt-4 flex items-center gap-2 border-b border-border bg-background px-4 py-2 pt-[calc(0.5rem+env(safe-area-inset-top))] sm:-mx-6 sm:px-6 md:static md:mx-0 md:px-0 md:pt-2">
        <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-1.5">
              <ListFilter aria-hidden />
              filtros
              {hasActiveFilters ? (
                <span className="grid min-w-5 place-items-center bg-foreground px-1 text-xs text-background tabular-nums">
                  {activeFilterLabels.length}
                </span>
              ) : null}
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-sm">
            <SheetHeader className="border-b border-border px-5 py-4 text-left">
              <SheetTitle className="text-2xl font-bold lowercase">filtros</SheetTitle>
            </SheetHeader>
            <div className="flex-1 space-y-5 px-5 py-5">
              <MultiEntityFilter
                label="Categorias"
                emptySummary="Todas"
                clearLabel="Limpar categorias"
                options={(categories.data ?? []).map((item) => ({ id: item.id, name: item.name }))}
                selectedIds={filters.categoryIds}
                onChange={(categoryIds) =>
                  setFilters((prev) => ({ ...prev, categoryIds, uncategorized: categoryIds.length ? false : prev.uncategorized }))
                }
              />
              <MultiEntityFilter
                label="Tags"
                emptySummary="Todas"
                clearLabel="Limpar tags"
                options={(tags.data ?? []).map((item) => ({ id: item.id, name: item.name }))}
                selectedIds={filters.tagIds}
                onChange={(tagIds) =>
                  setFilters((prev) => ({ ...prev, tagIds, untagged: tagIds.length ? false : prev.untagged }))
                }
              />
              <div className="space-y-1.5">
                <Label htmlFor="filter-payment">Meio de pagamento</Label>
                <SelectOptions
                  id="filter-payment"
                  value={filters.payment}
                  onValueChange={(v) => setFilters((prev) => ({ ...prev, payment: v }))}
                  options={paymentOptions}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="filter-user">Quem lançou</Label>
                <SelectOptions
                  id="filter-user"
                  value={filters.userId}
                  onValueChange={(v) => setFilters((prev) => ({ ...prev, userId: v }))}
                  options={[
                    { value: "", label: "Os dois" },
                    ...(users.data ?? []).map((item) => ({ value: item.id, label: item.name })),
                  ]}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="filter-start">De</Label>
                  <Input
                    id="filter-start"
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => setFilters((prev) => ({ ...prev, startDate: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="filter-end">Até</Label>
                  <Input
                    id="filter-end"
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => setFilters((prev) => ({ ...prev, endDate: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex gap-2 border-t border-border pt-5">
                <Button variant="outline" size="sm" onClick={() => setOpenCategoryModal(true)}>
                  nova categoria
                </Button>
                <Button variant="outline" size="sm" onClick={() => setOpenTagModal(true)}>
                  nova tag
                </Button>
              </div>
            </div>
            <div className="flex gap-2 border-t border-border px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <Button variant="ghost" className="flex-1" disabled={!hasActiveFilters} onClick={() => setFilters(defaultFilters)}>
                limpar
              </Button>
              <Button className="flex-1" onClick={() => setFiltersOpen(false)}>
                ver {grouped.length} {grouped.length === 1 ? "compra" : "compras"}
              </Button>
            </div>
          </SheetContent>
        </Sheet>

        <SelectOptions
          id="purchase-sort"
          aria-label="Ordenar"
          className="h-9 w-auto min-w-0 gap-2 border-input"
          value={sortKey}
          onValueChange={(v) => setSortKey(v as PurchaseSortKey)}
          options={[
            { value: "date_desc", label: "mais recentes" },
            { value: "date_asc", label: "mais antigas" },
            { value: "amount_desc", label: "maior valor" },
            { value: "amount_asc", label: "menor valor" },
          ]}
        />

        {hasActiveFilters ? (
          <button
            type="button"
            onClick={() => setFilters(defaultFilters)}
            className="ml-auto flex min-w-0 items-center gap-1 py-1 text-[15px] text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <span className="truncate">{activeFilterLabels.join(", ")}</span>
            <X className="size-4 shrink-0" aria-hidden />
            <span className="sr-only">Limpar filtros</span>
          </button>
        ) : null}
      </div>

      {isLoading ? (
        <div className="space-y-3 pt-6" aria-label="Carregando">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 animate-pulse bg-muted" />
          ))}
        </div>
      ) : purchases.isError ? (
        <p className="py-10 text-[15px] text-ink-out">Não foi possível carregar as compras. Recarregue a página.</p>
      ) : grouped.length === 0 ? (
        <div className="space-y-4 py-10">
          <p className="text-[15px] text-muted-foreground">
            {hasActiveFilters ? "Nenhuma compra com esses filtros." : "Nenhuma compra ainda."}
          </p>
          {hasActiveFilters ? (
            <Button variant="outline" onClick={() => setFilters(defaultFilters)}>
              limpar filtros
            </Button>
          ) : (
            <Button onClick={openNew} className="gap-2">
              <Plus aria-hidden />
              lançar a primeira compra
            </Button>
          )}
        </div>
      ) : byMonth ? (
        byMonth.map((m) => (
          <section key={m.month} className="pt-8">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-2xl font-bold lowercase leading-tight tracking-tight text-foreground">{monthLabel(m.month)}</h2>
              <span className="text-[15px] font-medium tabular-nums text-foreground">
                {showTotals ? formatAmount(m.total, "−") : "•••••"}
              </span>
            </div>
            <div className="mt-2 border-t-2 border-foreground">
              {m.items.map((g) => (
                <PurchaseRowItem key={g.key} g={g} onOpen={() => setDetailId(g.detailPurchaseId)} />
              ))}
            </div>
          </section>
        ))
      ) : (
        <div className="mt-6 border-t-2 border-foreground">
          {grouped.map((g) => (
            <PurchaseRowItem key={g.key} g={g} onOpen={() => setDetailId(g.detailPurchaseId)} />
          ))}
        </div>
      )}
    </div>
  );
}
