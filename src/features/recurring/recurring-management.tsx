"use client";

import { Pencil, Repeat, Trash2 } from "lucide-react";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import {
  useCards,
  useCategories,
  useCreateRecurring,
  useCreateTag,
  useCurrentUser,
  useDeleteRecurring,
  usePockets,
  useRecurring,
  useRunRecurring,
  useTags,
  useUpdateRecurring,
  type RecurringRow,
} from "@/shared/hooks/use-app-data";
import { toInputDate, formatCurrency, formatDisplayDate } from "@/shared/utils/formatters";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { CurrencyInput } from "@/shared/ui/currency-input";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Modal } from "@/shared/ui/modal";
import { SelectOptions } from "@/shared/ui/select-options";
import { cn } from "@/shared/lib/cn";

const PAYMENT_LABEL: Record<string, string> = {
  account: "Conta corrente",
  pocket: "Caixinha",
  card: "Cartão de crédito",
};

async function resolveRecurringTagIds(
  raw: string,
  existing: Array<{ id: string; name: string }>,
  createTag: { mutateAsync: (input: Record<string, unknown>) => Promise<unknown> },
  userId: string
): Promise<string[]> {
  const names = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (names.length === 0) return [];
  const byLower = new Map(existing.map((t) => [t.name.toLowerCase(), t.id]));
  const ids: string[] = [];
  for (const name of names) {
    const key = name.toLowerCase();
    let id = byLower.get(key);
    if (!id) {
      const res = (await createTag.mutateAsync({
        name,
        createdByUserId: userId,
      })) as { data: { id: string; name: string } };
      id = res.data.id;
      byLower.set(key, id);
    }
    ids.push(id);
  }
  return [...new Set(ids)];
}

const schema = z.object({
  title: z.string().min(1),
  amount: z.number().positive(),
  nextExecutionDate: z.string().min(1),
  paymentSourceType: z.enum(["account", "pocket", "card"]),
  paymentSourceId: z.string().optional(),
  categoryId: z.string().optional(),
});

type TabId = "all" | "upcoming";

export function RecurringManagement() {
  const currentUser = useCurrentUser();
  const recurring = useRecurring();
  const createRecurring = useCreateRecurring();
  const updateRecurring = useUpdateRecurring();
  const deleteRecurring = useDeleteRecurring();
  const runRecurring = useRunRecurring();
  const pockets = usePockets();
  const cards = useCards();
  const categories = useCategories();
  const tags = useTags();
  const createTag = useCreateTag();

  const [activeTab, setActiveTab] = useState<TabId>("all");
  const [openCreate, setOpenCreate] = useState(false);
  const [editingItem, setEditingItem] = useState<RecurringRow | null>(null);
  const [deletingItem, setDeletingItem] = useState<RecurringRow | null>(null);
  const [tagsField, setTagsField] = useState("");

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      amount: 0,
      nextExecutionDate: toInputDate(new Date()),
      paymentSourceType: "account",
      categoryId: "",
    },
  });

  const paymentSourceType = useWatch({ control: form.control, name: "paymentSourceType" }) ?? "account";
  const paymentSourceId = useWatch({ control: form.control, name: "paymentSourceId" });
  const sourceOptions =
    paymentSourceType === "pocket"
      ? (pockets.data ?? []).map((item) => ({ value: item.id, label: item.name }))
      : paymentSourceType === "card"
        ? (cards.data ?? []).map((item) => ({ value: item.id, label: item.name }))
        : [{ value: "", label: "Conta corrente" }];

  const categoryOptions = [
    { value: "", label: "Sem categoria" },
    ...(categories.data ?? []).map((c) => ({ value: c.id, label: c.name })),
  ];

  const openCreateModal = () => {
    setTagsField("");
    setOpenCreate(true);
  };

  const onSubmit = form.handleSubmit(async (values) => {
    if (!currentUser.data?.id) return;
    const tagIds = await resolveRecurringTagIds(tagsField, tags.data ?? [], createTag, currentUser.data.id);
    await createRecurring.mutateAsync({
      ...values,
      recurrenceType: "monthly",
      createdByUserId: currentUser.data.id,
      categoryId: values.categoryId?.trim() || undefined,
      tagIds,
    });
    toast.success("Despesa recorrente criada");
    form.reset({
      title: "",
      amount: 0,
      nextExecutionDate: toInputDate(new Date()),
      paymentSourceType: "account",
      categoryId: "",
    });
    setTagsField("");
    setOpenCreate(false);
  });

  const openEdit = (item: RecurringRow) => {
    setEditingItem(item);
    setTagsField(item.tags.map((t) => t.name).join(", "));
    form.reset({
      title: item.title,
      amount: item.amount,
      nextExecutionDate: item.nextExecutionDate,
      paymentSourceType: item.paymentSourceType as "account" | "pocket" | "card",
      paymentSourceId: item.paymentSourceId ?? undefined,
      categoryId: item.categoryId ?? "",
    });
  };

  const onEditSubmit = form.handleSubmit(async (values) => {
    if (!editingItem || !currentUser.data?.id) return;
    const tagIds = await resolveRecurringTagIds(tagsField, tags.data ?? [], createTag, currentUser.data.id);
    await updateRecurring.mutateAsync({
      id: editingItem.id,
      title: values.title,
      amount: values.amount,
      nextExecutionDate: values.nextExecutionDate,
      paymentSourceType: values.paymentSourceType,
      paymentSourceId: values.paymentSourceId || undefined,
      categoryId: values.categoryId?.trim() || undefined,
      tagIds,
    });
    toast.success("Despesa recorrente atualizada");
    setTagsField("");
    setEditingItem(null);
  });

  const onConfirmDelete = async () => {
    if (!deletingItem) return;
    await deleteRecurring.mutateAsync(deletingItem.id);
    toast.success("Despesa recorrente excluída");
    setDeletingItem(null);
  };

  const onRun = async () => {
    await runRecurring.mutateAsync();
    toast.success("Execução dos recorrentes concluída");
  };

  const list = recurring.data ?? [];
  const isLoading = recurring.isLoading;

  return (
    <div className="space-y-6">
      {/* Barra: abas + ações */}
      <Card>
        <div className="flex flex-col gap-4 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                activeTab === "all"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              Despesas recorrentes
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("upcoming")}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                activeTab === "upcoming"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              Próximos recorrentes
            </button>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button onClick={openCreateModal}>Nova despesa recorrente</Button>
            <Button variant="outline" onClick={onRun} disabled={runRecurring.isPending}>
              {runRecurring.isPending ? "Executando..." : "Executar agora"}
            </Button>
          </div>
        </div>

        <Modal
          open={openCreate}
          onClose={() => {
            setOpenCreate(false);
            setTagsField("");
          }}
          title="Nova despesa recorrente"
          size="lg"
        >
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label htmlFor="recurring-title">Título</Label>
              <Input id="recurring-title" placeholder="Ex: Aluguel" {...form.register("title")} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label>Valor</Label>
                <CurrencyInput
                  value={form.watch("amount") ?? 0}
                  onChange={(v) => form.setValue("amount", v)}
                />
              </div>
              <div>
                <Label>Próxima execução</Label>
                <Input type="date" {...form.register("nextExecutionDate")} />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label>Forma de pagamento</Label>
                <SelectOptions
                  value={paymentSourceType}
                  onValueChange={(v) => form.setValue("paymentSourceType", v as "account" | "pocket" | "card")}
                  options={[
                    { value: "account", label: "Conta corrente" },
                    { value: "pocket", label: "Caixinha" },
                    { value: "card", label: "Cartão de crédito" },
                  ]}
                />
              </div>
              <div>
                <Label>Fonte</Label>
                <SelectOptions
                  value={paymentSourceId ?? ""}
                  onValueChange={(v) => form.setValue("paymentSourceId", v || undefined)}
                  options={sourceOptions}
                />
              </div>
            </div>
            <div>
              <Label>Categoria</Label>
              <SelectOptions
                value={form.watch("categoryId") ?? ""}
                onValueChange={(v) => form.setValue("categoryId", v || undefined)}
                options={categoryOptions}
              />
            </div>
            <div>
              <Label htmlFor="recurring-tags">Tags</Label>
              <Input
                id="recurring-tags"
                placeholder="Ex: mercado, mensal"
                value={tagsField}
                onChange={(e) => setTagsField(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Nomes de tags já cadastradas ou novas, separados por vírgula (iguais à despesa normal).
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setOpenCreate(false);
                  setTagsField("");
                }}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={createRecurring.isPending}>
                {createRecurring.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </form>
        </Modal>

        <Modal
          open={!!editingItem}
          onClose={() => {
            setEditingItem(null);
            setTagsField("");
          }}
          title="Editar despesa recorrente"
          size="lg"
        >
          <form onSubmit={onEditSubmit} className="space-y-4">
            <div>
              <Label htmlFor="edit-recurring-title">Título</Label>
              <Input id="edit-recurring-title" placeholder="Ex: Aluguel" {...form.register("title")} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label>Valor</Label>
                <CurrencyInput
                  value={form.watch("amount") ?? 0}
                  onChange={(v) => form.setValue("amount", v)}
                />
              </div>
              <div>
                <Label>Próxima execução</Label>
                <Input type="date" {...form.register("nextExecutionDate")} />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label>Forma de pagamento</Label>
                <SelectOptions
                  value={paymentSourceType}
                  onValueChange={(v) => form.setValue("paymentSourceType", v as "account" | "pocket" | "card")}
                  options={[
                    { value: "account", label: "Conta corrente" },
                    { value: "pocket", label: "Caixinha" },
                    { value: "card", label: "Cartão de crédito" },
                  ]}
                />
              </div>
              <div>
                <Label>Fonte</Label>
                <SelectOptions
                  value={paymentSourceId ?? ""}
                  onValueChange={(v) => form.setValue("paymentSourceId", v || undefined)}
                  options={sourceOptions}
                />
              </div>
            </div>
            <div>
              <Label>Categoria</Label>
              <SelectOptions
                value={form.watch("categoryId") ?? ""}
                onValueChange={(v) => form.setValue("categoryId", v || undefined)}
                options={categoryOptions}
              />
            </div>
            <div>
              <Label htmlFor="edit-recurring-tags">Tags</Label>
              <Input
                id="edit-recurring-tags"
                placeholder="Ex: mercado, mensal"
                value={tagsField}
                onChange={(e) => setTagsField(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Nomes de tags já cadastradas ou novas, separados por vírgula (iguais à despesa normal).
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditingItem(null);
                  setTagsField("");
                }}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={updateRecurring.isPending}>
                {updateRecurring.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </form>
        </Modal>

        <Modal
          open={!!deletingItem}
          onClose={() => setDeletingItem(null)}
          title="Excluir despesa recorrente"
          size="sm"
        >
          <div className="space-y-4">
            {deletingItem && (
              <p className="text-sm text-muted-foreground">
                Tem certeza que deseja excluir <strong className="text-foreground">{deletingItem.title}</strong> (
                {formatCurrency(deletingItem.amount)})? Esta ação não pode ser desfeita.
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDeletingItem(null)}>
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={onConfirmDelete}
                disabled={deleteRecurring.isPending}
              >
                {deleteRecurring.isPending ? "Excluindo..." : "Excluir"}
              </Button>
            </div>
          </div>
        </Modal>

        {/* Conteúdo da aba */}
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {activeTab === "all" ? "Todas as despesas recorrentes" : "Próximas execuções"}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {activeTab === "all"
              ? "Lista de gastos que se repetem mensalmente."
              : "Ordenado pela data da próxima execução."}
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">Carregando...</p>
            </div>
          ) : list.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
              <div className="rounded-full bg-muted p-4">
                <Repeat className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="font-medium text-foreground">Nenhuma despesa recorrente</p>
              <p className="text-sm text-muted-foreground">
                Crie uma para despesas que se repetem todo mês (aluguel, assinaturas, etc.).
              </p>
              <Button onClick={openCreateModal}>Nova despesa recorrente</Button>
            </div>
          ) : (
            <ul className="space-y-3">
              {list.map((item) => (
                <li key={item.id}>
                  <Card className="overflow-hidden transition-colors hover:bg-muted/30">
                    <CardContent className="p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-foreground">{item.title}</p>
                          <p className="mt-0.5 text-sm text-muted-foreground">
                            Próxima execução: {formatDisplayDate(item.nextExecutionDate)}
                            <span className="mx-1.5">·</span>
                            <span>{PAYMENT_LABEL[item.paymentSourceType] ?? item.paymentSourceType}</span>
                            {item.categoryName && (
                              <>
                                <span className="mx-1.5">·</span>
                                <span>{item.categoryName}</span>
                              </>
                            )}
                            {item.tags.length > 0 && (
                              <>
                                <span className="mx-1.5">·</span>
                                <span>{item.tags.map((t) => `#${t.name}`).join(" ")}</span>
                              </>
                            )}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <p className="text-lg font-semibold tabular-nums text-foreground">
                            {formatCurrency(item.amount)}
                          </p>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openEdit(item)}
                              aria-label="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => setDeletingItem(item)}
                              aria-label="Excluir"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
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
