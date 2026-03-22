"use client";

import {
  Calendar,
  ChevronRight,
  CreditCard,
  Filter,
  Landmark,
  Loader2,
  PiggyBank,
  Plus,
  ReceiptText,
  Tag as TagIcon,
  User,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { PurchaseDetailDialog } from "@/features/purchases/purchase-detail-dialog";
import {
  useCategories,
  useCreateCategory,
  useCreateTag,
  useCurrentUser,
  usePurchases,
  useTags,
  useUsers,
  type PurchaseRow,
} from "@/shared/hooks/use-app-data";
import { formatCalendarMonthLabel, formatCurrency, formatDisplayDate } from "@/shared/utils/formatters";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Modal } from "@/shared/ui/modal";
import { SelectOptions } from "@/shared/ui/select-options";
import { PurchaseForm } from "@/features/purchases/purchase-form";

const PAYMENT_LABEL: Record<string, string> = {
  account: "Conta corrente",
  pocket: "Caixinha",
  card: "Cartão",
};

const defaultFilters = {
  categoryId: "",
  tagId: "",
  userId: "",
  startDate: "",
  endDate: "",
};

function purchaseGroupKey(p: PurchaseRow) {
  return `${p.title}\0${p.paymentSourceType}\0${p.paymentSourceId ?? ""}\0${p.installmentCount}`;
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

function groupPurchases(rows: PurchaseRow[]): PurchaseGroup[] {
  const map = new Map<string, PurchaseRow[]>();
  for (const p of rows) {
    const k = purchaseGroupKey(p);
    const arr = map.get(k) ?? [];
    arr.push(p);
    map.set(k, arr);
  }
  const out: PurchaseGroup[] = [];
  for (const [, groupRows] of map) {
    groupRows.sort((a, b) => a.installmentNumber - b.installmentNumber);
    const first = groupRows[0]!;
    const last = groupRows[groupRows.length - 1]!;
    const totalAmount = groupRows.reduce((s, r) => s + r.amount, 0);
    const tagSet = new Set<string>();
    for (const r of groupRows) for (const t of r.tags) tagSet.add(t);
    out.push({
      key: `${purchaseGroupKey(first)}-${first.id}`,
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
  out.sort((a, b) => b.firstDate.localeCompare(a.firstDate));
  return out;
}

function PaymentSourceBadge({ type }: { type: PurchaseRow["paymentSourceType"] }) {
  const Icon = type === "card" ? CreditCard : type === "pocket" ? PiggyBank : Landmark;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs font-medium text-foreground">
      <Icon className="h-3 w-3 shrink-0 opacity-70" />
      {PAYMENT_LABEL[type] ?? type}
    </span>
  );
}

export function PurchaseList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState(defaultFilters);
  const [openPurchaseModal, setOpenPurchaseModal] = useState(false);
  const [editPurchaseId, setEditPurchaseId] = useState<string | null>(null);
  const [openCategoryModal, setOpenCategoryModal] = useState(false);
  const [openTagModal, setOpenTagModal] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [filtersExpanded, setFiltersExpanded] = useState(true);

  const editFromUrl = searchParams.get("edit");
  useEffect(() => {
    if (!editFromUrl) return;
    setEditPurchaseId(editFromUrl);
    setOpenPurchaseModal(true);
    router.replace("/purchases", { scroll: false });
  }, [editFromUrl, router]);

  const purchases = usePurchases({
    categoryId: filters.categoryId || undefined,
    tagId: filters.tagId || undefined,
    userId: filters.userId || undefined,
    startDate: filters.startDate || undefined,
    endDate: filters.endDate || undefined,
  });

  const categories = useCategories();
  const users = useUsers();
  const tags = useTags();
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

  const hasActiveFilters =
    Boolean(filters.categoryId) ||
    Boolean(filters.tagId) ||
    Boolean(filters.userId) ||
    Boolean(filters.startDate) ||
    Boolean(filters.endDate);

  const list = purchases.data ?? [];
  const isLoading = purchases.isLoading;

  const grouped = useMemo(() => groupPurchases(list), [list]);

  return (
    <div className="space-y-6">
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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          className="h-11 w-full gap-2 sm:w-auto"
          size="lg"
          onClick={() => {
            setEditPurchaseId(null);
            setOpenPurchaseModal(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Nova despesa
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setOpenCategoryModal(true)}>
            Nova categoria
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setOpenTagModal(true)}>
            Nova tag
          </Button>
        </div>
      </div>

      <Modal
        open={openPurchaseModal}
        onClose={() => {
          setOpenPurchaseModal(false);
          setEditPurchaseId(null);
        }}
        title={editPurchaseId ? "Editar despesa" : "Nova despesa"}
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
          <div>
            <Label htmlFor="new-category">Nome</Label>
            <Input id="new-category" placeholder="Ex: Alimentação" {...categoryForm.register("name")} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpenCategoryModal(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createCategory.isPending}>
              {createCategory.isPending ? "Salvando..." : "Criar categoria"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={openTagModal} onClose={() => setOpenTagModal(false)} title="Nova tag" size="sm">
        <form onSubmit={addTag} className="space-y-4">
          <div>
            <Label htmlFor="new-tag">Nome</Label>
            <Input id="new-tag" placeholder="Ex: mercado" {...tagForm.register("name")} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpenTagModal(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createTag.isPending}>
              {createTag.isPending ? "Salvando..." : "Criar tag"}
            </Button>
          </div>
        </form>
      </Modal>

      <Card className="overflow-hidden border-border/80 shadow-sm">
        <CardHeader className="space-y-1 border-b border-border/60 bg-muted/20 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base font-semibold">Filtros</CardTitle>
              <p className="text-sm text-muted-foreground">Refine por categoria, tag, usuário ou período.</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground"
              onClick={() => setFiltersExpanded((e) => !e)}
            >
              <Filter className="h-4 w-4" />
              {filtersExpanded ? "Ocultar" : "Mostrar"}
            </Button>
          </div>
        </CardHeader>
        {filtersExpanded && (
          <CardContent className="space-y-4 pt-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div className="space-y-2">
                <Label htmlFor="filter-category" className="text-xs text-muted-foreground">
                  Categoria
                </Label>
                <SelectOptions
                  id="filter-category"
                  value={filters.categoryId}
                  onValueChange={(v) => setFilters((prev) => ({ ...prev, categoryId: v }))}
                  options={[
                    { value: "", label: "Todas" },
                    ...(categories.data ?? []).map((item) => ({ value: item.id, label: item.name })),
                  ]}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="filter-tag" className="text-xs text-muted-foreground">
                  Tag
                </Label>
                <SelectOptions
                  id="filter-tag"
                  value={filters.tagId}
                  onValueChange={(v) => setFilters((prev) => ({ ...prev, tagId: v }))}
                  options={[
                    { value: "", label: "Todas" },
                    ...(tags.data ?? []).map((item) => ({ value: item.id, label: item.name })),
                  ]}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="filter-user" className="text-xs text-muted-foreground">
                  Usuário
                </Label>
                <SelectOptions
                  id="filter-user"
                  value={filters.userId}
                  onValueChange={(v) => setFilters((prev) => ({ ...prev, userId: v }))}
                  options={[
                    { value: "", label: "Todos" },
                    ...(users.data ?? []).map((item) => ({ value: item.id, label: item.name })),
                  ]}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="filter-start" className="text-xs text-muted-foreground">
                  Data inicial
                </Label>
                <Input
                  id="filter-start"
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters((prev) => ({ ...prev, startDate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="filter-end" className="text-xs text-muted-foreground">
                  Data final
                </Label>
                <Input
                  id="filter-end"
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters((prev) => ({ ...prev, endDate: e.target.value }))}
                />
              </div>
            </div>
            {hasActiveFilters && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setFilters(defaultFilters)}
                className="text-muted-foreground"
              >
                Limpar filtros
              </Button>
            )}
          </CardContent>
        )}
      </Card>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">Suas despesas</h2>
            <p className="text-sm text-muted-foreground">
              {isLoading
                ? "Carregando…"
                : grouped.length === 0
                  ? "Nenhum resultado"
                  : `${grouped.length} ${grouped.length === 1 ? "compra" : "compras"} agrupadas · toque para ver parcelas e datas`}
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Carregando despesas…</p>
          </div>
        ) : grouped.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border bg-muted/10 py-16 text-center">
            <div className="rounded-full bg-muted p-4">
              <ReceiptText className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="max-w-sm space-y-1">
              <p className="font-medium text-foreground">Nenhuma despesa encontrada</p>
              <p className="text-sm text-muted-foreground">
                {hasActiveFilters
                  ? "Tente ajustar os filtros ou cadastre uma nova despesa."
                  : "Cadastre sua primeira despesa para começar."}
              </p>
            </div>
            <Button onClick={() => setOpenPurchaseModal(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Nova despesa
            </Button>
          </div>
        ) : (
          <ul className="space-y-2">
            {grouped.map((g) => (
              <li key={g.key}>
                <button
                  type="button"
                  onClick={() => setDetailId(g.detailPurchaseId)}
                  className="group flex w-full items-stretch gap-0 overflow-hidden rounded-xl border border-border bg-card text-left shadow-sm transition hover:border-primary/25 hover:bg-accent/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="w-1 shrink-0 bg-primary/70 opacity-80 group-hover:opacity-100" aria-hidden />
                  <div className="flex min-w-0 flex-1 flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-semibold text-foreground">{g.title}</span>
                        <PaymentSourceBadge type={g.paymentSourceType} />
                        {g.installmentCount > 1 ? (
                          <Badge variant="secondary" className="font-normal tabular-nums">
                            {g.installmentCount} parcelas
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="font-normal">
                            À vista
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 shrink-0" />
                          {g.firstDate === g.lastDate
                            ? formatDisplayDate(g.firstDate)
                            : `${formatDisplayDate(g.firstDate)} → ${formatDisplayDate(g.lastDate)}`}
                        </span>
                        <span className="text-border">·</span>
                        <span>
                          {g.categoryName ?? "Sem categoria"}
                        </span>
                        {g.userName ? (
                          <>
                            <span className="text-border">·</span>
                            <span className="inline-flex items-center gap-1">
                              <User className="h-3.5 w-3.5" />
                              {g.userName}
                            </span>
                          </>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          Primeiro pagamento
                        </span>
                        <span className="text-xs text-foreground">{formatCalendarMonthLabel(g.firstDate)}</span>
                        {g.installmentCount > 1 ? (
                          <>
                            <span className="text-muted-foreground">·</span>
                            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                              Último
                            </span>
                            <span className="text-xs text-foreground">{formatCalendarMonthLabel(g.lastDate)}</span>
                          </>
                        ) : null}
                      </div>
                      {g.tags.length > 0 ? (
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {g.tags.map((tag) => (
                            <Badge key={tag} variant="outline" className="font-normal text-xs">
                              <TagIcon className="mr-1 h-3 w-3 opacity-60" />
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-3 sm:pl-2">
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Total</p>
                        <p className="text-lg font-semibold tabular-nums text-foreground">{formatCurrency(g.totalAmount)}</p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
