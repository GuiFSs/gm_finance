"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import {
  useCreatePurchase,
  useCurrentUser,
  useCategories,
  useCreateCategory,
  useTags,
  usePockets,
  useCards,
  useDashboard,
} from "@/shared/hooks/use-app-data";
import { toInputDate } from "@/shared/utils/formatters";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardTitle } from "@/shared/ui/card";
import { CurrencyInput } from "@/shared/ui/currency-input";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { SelectOptions } from "@/shared/ui/select-options";

const schema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  amount: z.number().positive(),
  purchaseDate: z.string().min(1),
  categoryId: z.string().optional(),
  paymentSourceType: z.enum(["account", "pocket", "card"]),
  paymentSourceId: z.string().optional(),
  installmentCount: z.number().int().min(1).max(48),
  tagIds: z.array(z.string()),
});

type FormValues = z.infer<typeof schema>;

function FormSection({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
        {title}
      </h4>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export type PurchaseFormProps = {
  /** Quando definido, o formulário é usado dentro de um modal: ao salvar chama onSuccess e não redireciona */
  onSuccess?: () => void;
  /** Chamado ao cancelar (ex.: fechar modal) */
  onCancel?: () => void;
};

export function PurchaseForm({ onSuccess, onCancel }: PurchaseFormProps = {}) {
  const router = useRouter();
  const createPurchase = useCreatePurchase();
  const currentUser = useCurrentUser();
  const categories = useCategories();
  const createCategory = useCreateCategory();
  const tags = useTags();
  const pockets = usePockets();
  const cards = useCards();
  const dashboard = useDashboard();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      purchaseDate: toInputDate(new Date()),
      paymentSourceType: "account",
      installmentCount: 1,
      tagIds: [],
    },
  });

  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const paymentSourceType = useWatch({ control: form.control, name: "paymentSourceType" }) ?? "account";
  const paymentSourceId = useWatch({ control: form.control, name: "paymentSourceId" });
  const categoryId = useWatch({ control: form.control, name: "categoryId" });
  const amount = useWatch({ control: form.control, name: "amount" }) ?? 0;

  const handleCreateCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) {
      toast.error("Digite o nome da categoria");
      return;
    }
    if (!currentUser.data?.id) return;
    const result = await createCategory.mutateAsync({
      name,
      createdByUserId: currentUser.data.id,
    });
    const created = result?.data as { id: string; name: string } | undefined;
    if (created?.id) {
      form.setValue("categoryId", created.id);
      setNewCategoryName("");
      setShowCreateCategory(false);
      toast.success("Categoria criada");
    }
  };

  const submit = form.handleSubmit(async (values) => {
    const createdByUserId = currentUser.data?.id;
    if (!createdByUserId) {
      toast.error("Sessão inválida");
      return;
    }

    await createPurchase.mutateAsync({ ...values, createdByUserId });
    toast.success("Compra criada");
    if (onSuccess) onSuccess();
    else router.push("/purchases");
  });

  const sourceOptions =
    paymentSourceType === "pocket"
      ? (pockets.data ?? []).map((item) => ({ value: item.id, label: `${item.name} (${item.balance.toFixed(2)})` }))
      : paymentSourceType === "card"
        ? (cards.data ?? []).map((item) => ({ value: item.id, label: item.name }))
        : [{ value: "", label: "Conta corrente" }];

  const checkingWouldBeNegative =
    paymentSourceType === "account" &&
    dashboard.data &&
    dashboard.data.checkingBalance - amount < 0;
  const selectedPocket = (pockets.data ?? []).find((item) => item.id === paymentSourceId);
  const pocketWouldBeNegative = paymentSourceType === "pocket" && selectedPocket ? selectedPocket.balance - amount < 0 : false;

  const formContent = (
    <form onSubmit={submit} className={onSuccess ? "space-y-6" : "space-y-8"}>
          <FormSection title="Dados básicos">
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Título</Label>
                <Input id="title" {...form.register("title")} placeholder="Ex: Supermercado" />
              </div>
              <div>
                <Label htmlFor="description">Descrição (opcional)</Label>
                <Input id="description" {...form.register("description")} placeholder="Ex: Compras do mês" />
              </div>
            </div>
          </FormSection>

          <FormSection title="Valor e data">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="amount">Valor</Label>
                <CurrencyInput
                  id="amount"
                  value={form.watch("amount") ?? 0}
                  onChange={(v) => form.setValue("amount", v)}
                />
              </div>
              <div>
                <Label htmlFor="purchaseDate">Data da compra</Label>
                <Input id="purchaseDate" type="date" {...form.register("purchaseDate")} />
              </div>
            </div>
          </FormSection>

          <FormSection title="Categoria">
            <div className="space-y-3">
              <div>
                <Label htmlFor="categoryId">Categoria</Label>
                <SelectOptions
                  id="categoryId"
                  value={categoryId ?? ""}
                  onValueChange={(v) => form.setValue("categoryId", v || undefined)}
                  options={[
                    { value: "", label: "Sem categoria" },
                    ...(categories.data ?? []).map((item) => ({ value: item.id, label: item.name })),
                  ]}
                />
              </div>
              {showCreateCategory ? (
                <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-muted/30 p-3 dark:bg-muted/20">
                  <div className="min-w-0 flex-1 space-y-1">
                    <Label htmlFor="new-category-name" className="text-xs text-muted-foreground">
                      Nova categoria
                    </Label>
                    <Input
                      id="new-category-name"
                      placeholder="Ex: Alimentação"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleCreateCategory())}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowCreateCategory(false);
                        setNewCategoryName("");
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleCreateCategory}
                      disabled={createCategory.isPending || !newCategoryName.trim()}
                    >
                      {createCategory.isPending ? "Criando..." : "Criar"}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-auto gap-1.5 px-0 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowCreateCategory(true)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Criar nova categoria
                </Button>
              )}
            </div>
          </FormSection>

          <FormSection title="Forma de pagamento">
            <div
              className={`grid gap-4 ${paymentSourceType === "card" ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2"}`}
            >
              <div>
                <Label htmlFor="paymentSourceType">Tipo</Label>
                <SelectOptions
                  id="paymentSourceType"
                  value={paymentSourceType}
                  onValueChange={(v) => {
                    const type = v as FormValues["paymentSourceType"];
                    form.setValue("paymentSourceType", type);
                    if (type !== "card") form.setValue("installmentCount", 1);
                  }}
                  options={[
                    { value: "account", label: "Conta corrente" },
                    { value: "pocket", label: "Caixinha" },
                    { value: "card", label: "Cartão de crédito" },
                  ]}
                />
              </div>
              <div>
                <Label htmlFor="paymentSourceId">Fonte</Label>
                <SelectOptions
                  id="paymentSourceId"
                  value={paymentSourceId ?? ""}
                  onValueChange={(v) => form.setValue("paymentSourceId", v || undefined)}
                  options={sourceOptions}
                />
              </div>
              {paymentSourceType === "card" && (
                <div>
                  <Label htmlFor="installmentCount">Número de parcelas</Label>
                  <Input
                    id="installmentCount"
                    type="number"
                    min={1}
                    max={48}
                    {...form.register("installmentCount", { valueAsNumber: true })}
                  />
                </div>
              )}
            </div>
          </FormSection>

          <FormSection title="Tags">
            <div>
              <Label htmlFor="tags">Tags (digite nomes existentes separados por vírgula)</Label>
              <Input
                id="tags"
                placeholder="Ex: mercado, mensal"
                onChange={(event) => {
                  const lookup = new Map((tags.data ?? []).map((tag) => [tag.name.toLowerCase(), tag.id]));
                  const ids = event.target.value
                    .split(",")
                    .map((item) => item.trim().toLowerCase())
                    .map((name) => lookup.get(name))
                    .filter((id): id is string => Boolean(id));
                  form.setValue("tagIds", ids);
                }}
              />
            </div>
          </FormSection>

          {(checkingWouldBeNegative || pocketWouldBeNegative) && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-950/30">
              <Badge variant="destructive">Esta compra deixará o saldo negativo</Badge>
            </div>
          )}

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel ?? (() => router.push("/purchases"))}
              className="sm:order-2"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={createPurchase.isPending}
              className="w-full sm:w-auto sm:min-w-[140px]"
            >
              {createPurchase.isPending ? "Salvando..." : "Salvar compra"}
            </Button>
          </div>
        </form>
  );

  if (onSuccess) return formContent;
  return (
    <div className="mx-auto max-w-2xl">
      <Card className="p-6 sm:p-8">
        <CardTitle className="mb-6">Nova compra</CardTitle>
        {formContent}
      </Card>
    </div>
  );
}
