"use client";

import { Play, Plus } from "lucide-react";
import { useMemo, useState } from "react";
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
import { AnswerFigure, DayTile, LedgerRow, LedgerSkeleton } from "@/features/month/ledger";
import { dayOfMonth, daysFromToday, formatAmount, todayYmd } from "@/features/month/month-model";
import { PlaneBar, PlaneLegend } from "@/features/month/plane-bar";
import { toInputDate, formatCurrency, formatDisplayDate } from "@/shared/utils/formatters";
import { Button } from "@/shared/ui/button";
import { CurrencyInput } from "@/shared/ui/currency-input";
import { Input } from "@/shared/ui/input";
import { Modal } from "@/shared/ui/modal";
import { Field, FormActions, PageHeader } from "@/shared/ui/page-header";
import { SelectOptions } from "@/shared/ui/select-options";

const PAYMENT_LABEL: Record<string, string> = {
  account: "conta",
  pocket: "caixinha",
  card: "cartão",
};

/** Vence em até dois dias: o mesmo amarelo cheio dos movimentos. */
const SOON_DAYS = 2;

function nextWord(ymd: string, todayStr: string): string {
  const diff = daysFromToday(ymd, todayStr);
  if (diff < 0) return `atrasado desde ${formatDisplayDate(ymd).slice(0, 5)}`;
  if (diff === 0) return "hoje";
  if (diff === 1) return "amanhã";
  if (diff <= 31) return `em ${diff} dias`;
  return formatDisplayDate(ymd);
}

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
    setEditingItem(null);
  };

  const onRun = async () => {
    await runRecurring.mutateAsync();
    toast.success("Execução dos recorrentes concluída");
  };

  const list = useMemo(
    () => [...(recurring.data ?? [])].sort((a, b) => a.nextExecutionDate.localeCompare(b.nextExecutionDate)),
    [recurring.data],
  );
  const isLoading = recurring.isLoading;
  const todayStr = todayYmd();
  const total = list.reduce((s, r) => s + r.amount, 0);
  const isSoon = (r: RecurringRow) => daysFromToday(r.nextExecutionDate, todayStr) <= SOON_DAYS;
  const soonTotal = list.filter(isSoon).reduce((s, r) => s + r.amount, 0);
  const byDay = [...list].sort(
    (a, b) => Number(a.nextExecutionDate.slice(8, 10)) - Number(b.nextExecutionDate.slice(8, 10)),
  );

  const closeForm = () => {
    setOpenCreate(false);
    setEditingItem(null);
    setTagsField("");
  };

  const formFields = (prefix: string) => (
    <>
      <Field label="Título" htmlFor={`${prefix}-title`}>
        <Input id={`${prefix}-title`} placeholder="Ex: Aluguel" {...form.register("title")} />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Valor por mês" htmlFor={`${prefix}-amount`}>
          <CurrencyInput
            id={`${prefix}-amount`}
            value={form.watch("amount") ?? 0}
            onChange={(v) => form.setValue("amount", v)}
          />
        </Field>
        <Field label="Próxima vez" htmlFor={`${prefix}-next`}>
          <Input id={`${prefix}-next`} type="date" {...form.register("nextExecutionDate")} />
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Pagar com">
          <SelectOptions
            aria-label="Pagar com"
            value={paymentSourceType}
            onValueChange={(v) => {
              form.setValue("paymentSourceType", v as "account" | "pocket" | "card");
              form.setValue("paymentSourceId", undefined);
            }}
            options={[
              { value: "account", label: "Conta corrente" },
              { value: "pocket", label: "Caixinha" },
              { value: "card", label: "Cartão de crédito" },
            ]}
          />
        </Field>
        {paymentSourceType !== "account" ? (
          <Field label={paymentSourceType === "card" ? "Cartão" : "Caixinha"}>
            <SelectOptions
              aria-label={paymentSourceType === "card" ? "Cartão" : "Caixinha"}
              value={paymentSourceId ?? ""}
              onValueChange={(v) => form.setValue("paymentSourceId", v || undefined)}
              options={[{ value: "", label: "Selecione" }, ...sourceOptions]}
            />
          </Field>
        ) : null}
      </div>
      <Field label="Categoria">
        <SelectOptions
          aria-label="Categoria"
          value={form.watch("categoryId") ?? ""}
          onValueChange={(v) => form.setValue("categoryId", v || undefined)}
          options={categoryOptions}
        />
      </Field>
      <Field label="Tags" htmlFor={`${prefix}-tags`} hint="Separadas por vírgula; as novas são criadas.">
        <Input
          id={`${prefix}-tags`}
          placeholder="Ex: casa, mensal"
          value={tagsField}
          onChange={(e) => setTagsField(e.target.value)}
        />
      </Field>
    </>
  );

  return (
    <div className="pb-4">
      <PageHeader
        title="recorrentes"
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={onRun} disabled={runRecurring.isPending}>
              <Play aria-hidden />
              {runRecurring.isPending ? "lançando…" : "lançar vencidos"}
            </Button>
            <Button size="sm" className="gap-1.5" onClick={openCreateModal}>
              <Plus aria-hidden />
              nova
            </Button>
          </>
        }
      />

      {list.length > 0 || isLoading ? (
        <section aria-label="Resumo dos recorrentes" className="pt-6 md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:items-end md:gap-10">
          <AnswerFigure
            label="fixo por mês"
            value={formatAmount(total)}
            loading={isLoading}
            meta={`${list.length} ${list.length === 1 ? "recorrente" : "recorrentes"}`}
          />
          {isLoading ? (
            <div className="mt-5 h-12 animate-pulse bg-muted md:mt-0" />
          ) : (
            <div className="mt-5 md:mt-0">
              <PlaneBar
                label={`Recorrentes na ordem do mês: ${byDay.map((r) => `${r.title} ${formatAmount(r.amount)}`).join(", ")}`}
                segments={byDay.map((r) => ({
                  key: r.id,
                  value: r.amount,
                  tone: isSoon(r) ? ("open" as const) : ("forecast" as const),
                  onSelect: () => openEdit(r),
                }))}
              />
              <PlaneLegend
                className="mt-3"
                items={[
                  { key: "soon", label: "até 2 dias", tone: "open", amount: formatAmount(soonTotal), value: soonTotal },
                  { key: "later", label: "depois", tone: "forecast", amount: formatAmount(total - soonTotal), value: total - soonTotal },
                ]}
              />
            </div>
          )}
        </section>
      ) : null}

      {isLoading ? (
        <LedgerSkeleton />
      ) : recurring.isError ? (
        <p className="py-10 text-[15px] text-ink-out">Não foi possível carregar os recorrentes. Recarregue a página.</p>
      ) : list.length === 0 ? (
        <div className="space-y-4 py-10">
          <p className="text-[15px] text-muted-foreground">
            Nenhuma despesa recorrente. Aluguel, assinaturas e contas fixas entram aqui.
          </p>
          <Button onClick={openCreateModal} className="gap-2">
            <Plus aria-hidden />
            criar a primeira
          </Button>
        </div>
      ) : (
        <div className="mt-8 border-t-2 border-foreground">
          {list.map((item) => {
            const soon = isSoon(item);
            const meta = [
              nextWord(item.nextExecutionDate, todayStr),
              PAYMENT_LABEL[item.paymentSourceType] ?? item.paymentSourceType,
              item.categoryName,
              ...item.tags.map((t) => `#${t.name}`),
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <LedgerRow
                key={item.id}
                tile={<DayTile day={dayOfMonth(item.nextExecutionDate)} tone={soon ? "open" : "forecast"} />}
                title={item.title}
                meta={<span className={daysFromToday(item.nextExecutionDate, todayStr) <= 0 ? "text-ink-open" : undefined}>{meta}</span>}
                amount={formatAmount(item.amount, "−")}
                onOpen={() => openEdit(item)}
                openLabel={`Editar ${item.title}`}
              />
            );
          })}
        </div>
      )}

      <Modal open={openCreate} onClose={closeForm} title="nova recorrente" size="lg">
        <form onSubmit={onSubmit} className="space-y-4">
          {formFields("recurring")}
          <FormActions>
            <Button type="button" variant="outline" onClick={closeForm}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createRecurring.isPending}>
              {createRecurring.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </FormActions>
        </form>
      </Modal>

      <Modal open={!!editingItem} onClose={closeForm} title="editar recorrente" size="lg">
        <form onSubmit={onEditSubmit} className="space-y-4">
          {formFields("edit-recurring")}
          <FormActions
            aside={
              <Button
                type="button"
                variant="ghost"
                className="w-full text-ink-out hover:text-ink-out sm:w-auto"
                onClick={() => editingItem && setDeletingItem(editingItem)}
              >
                excluir
              </Button>
            }
          >
            <Button type="button" variant="outline" onClick={closeForm}>
              Cancelar
            </Button>
            <Button type="submit" disabled={updateRecurring.isPending}>
              {updateRecurring.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </FormActions>
        </form>
      </Modal>

      <Modal open={!!deletingItem} onClose={() => setDeletingItem(null)} title="excluir recorrente?" size="sm">
        <div className="space-y-4">
          {deletingItem ? (
            <p className="text-[15px] text-muted-foreground">
              <span className="font-medium text-foreground">{deletingItem.title}</span> ({formatCurrency(deletingItem.amount)})
              para de ser lançada. As compras já lançadas continuam.
            </p>
          ) : null}
          <FormActions>
            <Button type="button" variant="outline" onClick={() => setDeletingItem(null)}>
              Cancelar
            </Button>
            <Button type="button" variant="destructive" onClick={onConfirmDelete} disabled={deleteRecurring.isPending}>
              {deleteRecurring.isPending ? "Excluindo…" : "Excluir"}
            </Button>
          </FormActions>
        </div>
      </Modal>
    </div>
  );
}
