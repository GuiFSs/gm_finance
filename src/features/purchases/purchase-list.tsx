"use client";

import { ReceiptText } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import {
  useCategories,
  useCreateCategory,
  useCreateTag,
  useCurrentUser,
  usePurchases,
  useTags,
  useUsers,
} from "@/shared/hooks/use-app-data";
import { formatCurrency } from "@/shared/utils/formatters";
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
  card: "Cartão de crédito",
};

const defaultFilters = {
  categoryId: "",
  tagId: "",
  userId: "",
  startDate: "",
  endDate: "",
};

export function PurchaseList() {
  const [filters, setFilters] = useState(defaultFilters);
  const [openPurchaseModal, setOpenPurchaseModal] = useState(false);
  const [openCategoryModal, setOpenCategoryModal] = useState(false);
  const [openTagModal, setOpenTagModal] = useState(false);

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
    filters.categoryId || filters.tagId || filters.userId || filters.startDate || filters.endDate;

  const list = purchases.data ?? [];
  const isLoading = purchases.isLoading;

  return (
    <div className="space-y-6">
      {/* Ações principais */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Button className="w-full sm:w-auto" size="lg" onClick={() => setOpenPurchaseModal(true)}>
          Nova despesa
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setOpenCategoryModal(true)}>
            Nova categoria
          </Button>
          <Button variant="outline" size="sm" onClick={() => setOpenTagModal(true)}>
            Nova tag
          </Button>
        </div>
      </div>

      <Modal
        open={openPurchaseModal}
        onClose={() => setOpenPurchaseModal(false)}
        title="Nova despesa"
        size="2xl"
      >
        <PurchaseForm
          onSuccess={() => setOpenPurchaseModal(false)}
          onCancel={() => setOpenPurchaseModal(false)}
        />
      </Modal>

      <Modal open={openCategoryModal} onClose={() => setOpenCategoryModal(false)} title="Nova categoria" size="sm">
        <form onSubmit={addCategory} className="space-y-4">
          <div>
            <Label htmlFor="new-category">Nome</Label>
            <Input
              id="new-category"
              placeholder="Ex: Alimentação"
              {...categoryForm.register("name")}
            />
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

      {/* Filtros */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Filtros</CardTitle>
          <p className="text-sm text-muted-foreground">Refine a lista por categoria, tag, usuário ou período.</p>
        </CardHeader>
        <CardContent className="space-y-4">
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
      </Card>

      {/* Lista */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Lista de despesas</CardTitle>
          {list.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {list.length} {list.length === 1 ? "registro" : "registros"}
            </p>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">Carregando despesas...</p>
            </div>
          ) : list.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
              <div className="rounded-full bg-muted p-4">
                <ReceiptText className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-foreground">Nenhuma despesa encontrada</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {hasActiveFilters
                    ? "Tente alterar os filtros ou registre uma nova despesa."
                    : "Registre sua primeira despesa para começar."}
                </p>
              </div>
              <Button onClick={() => setOpenPurchaseModal(true)}>Nova despesa</Button>
            </div>
          ) : (
            <ul className="space-y-3">
              {list.map((purchase) => (
                <li key={purchase.id}>
                  <Card className="overflow-hidden transition-colors hover:bg-muted/30">
                    <CardContent className="p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1 space-y-1">
                          <p className="font-semibold leading-tight text-foreground">{purchase.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {purchase.purchaseDate}
                            <span className="mx-1.5">·</span>
                            {purchase.categoryName ?? "Sem categoria"}
                            <span className="mx-1.5">·</span>
                            {purchase.userName}
                          </p>
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            <Badge variant="secondary" className="font-normal">
                              {PAYMENT_LABEL[purchase.paymentSourceType] ?? purchase.paymentSourceType}
                            </Badge>
                            {purchase.installmentCount > 1 && (
                              <Badge variant="outline" className="font-normal">
                                {purchase.installmentNumber}/{purchase.installmentCount} parcelas
                              </Badge>
                            )}
                            {purchase.tags.map((tag) => (
                              <Badge key={tag} variant="outline" className="font-normal">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <p className="shrink-0 text-right text-lg font-semibold tabular-nums text-foreground">
                          {formatCurrency(purchase.amount)}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
