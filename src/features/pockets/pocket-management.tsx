"use client";

import { ArrowLeftRight, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch, type Resolver } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import {
  useCreateAdjustment,
  useCreatePocket,
  useCurrentUser,
  useDeletePocket,
  usePocketCategories,
  usePockets,
  useTransferToPocket,
  useUpdatePocket,
  type PocketRow,
} from "@/shared/hooks/use-app-data";
import { AnswerFigure, LedgerGroup, LedgerRow, LedgerSkeleton } from "@/features/month/ledger";
import { formatAmount } from "@/features/month/month-model";
import { PlaneBar } from "@/features/month/plane-bar";
import { toInputDate, formatCurrency } from "@/shared/utils/formatters";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import { CurrencyInput } from "@/shared/ui/currency-input";
import { Input } from "@/shared/ui/input";
import { Modal } from "@/shared/ui/modal";
import { Field, FormActions, PageHeader } from "@/shared/ui/page-header";
import { SelectOptions } from "@/shared/ui/select-options";

const pocketSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  categoryId: z.string().optional(),
  initialAmount: z.number().min(0).default(0),
});

type PocketFormValues = z.infer<typeof pocketSchema>;

const transferSchema = z
  .object({
    fromType: z.enum(["account", "pocket"]),
    fromPocketId: z.string().optional(),
    toType: z.enum(["account", "pocket"]),
    toPocketId: z.string().optional(),
    amount: z.number().positive(),
    transferDate: z.string().min(1),
  })
  .refine((data) => data.fromType !== "pocket" || (data.fromPocketId && data.fromPocketId.length > 0), {
    message: "Selecione a caixinha de origem",
    path: ["fromPocketId"],
  })
  .refine((data) => data.toType !== "pocket" || (data.toPocketId && data.toPocketId.length > 0), {
    message: "Selecione a caixinha de destino",
    path: ["toPocketId"],
  })
  .refine(
    (data) => {
      const sameOrigin = data.fromType === "account" && data.toType === "account";
      const samePocket =
        data.fromType === "pocket" && data.toType === "pocket" && data.fromPocketId === data.toPocketId;
      return !sameOrigin && !samePocket;
    },
    { message: "Origem e destino devem ser diferentes", path: ["toType"] }
  );

const editPocketSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  categoryId: z.string().optional(),
  newBalance: z.number(),
});

type EditPocketValues = z.infer<typeof editPocketSchema>;

type EditingPocket = Pick<PocketRow, "id" | "name" | "description" | "categoryId" | "balance">;

export function PocketManagement() {
  const currentUser = useCurrentUser();
  const pockets = usePockets();
  const pocketCategories = usePocketCategories();
  const createPocket = useCreatePocket();
  const updatePocket = useUpdatePocket();
  const deletePocket = useDeletePocket();
  const createAdjustment = useCreateAdjustment();
  const transferToPocket = useTransferToPocket();

  const pocketForm = useForm<PocketFormValues>({
    resolver: zodResolver(pocketSchema) as Resolver<PocketFormValues>,
    defaultValues: { name: "", description: "", categoryId: "", initialAmount: 0 },
  });

  const transferForm = useForm<z.infer<typeof transferSchema>>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      fromType: "account",
      fromPocketId: "",
      toType: "pocket",
      toPocketId: "",
      amount: 0,
      transferDate: toInputDate(new Date()),
    },
  });
  const transferFromType = useWatch({ control: transferForm.control, name: "fromType" }) ?? "account";
  const transferToType = useWatch({ control: transferForm.control, name: "toType" }) ?? "pocket";

  const [openCreatePocket, setOpenCreatePocket] = useState(false);
  const [openTransfer, setOpenTransfer] = useState(false);
  const [editingPocket, setEditingPocket] = useState<EditingPocket | null>(null);
  const [deletingPocket, setDeletingPocket] = useState<EditingPocket | null>(null);

  const editForm = useForm<EditPocketValues>({
    resolver: zodResolver(editPocketSchema),
    defaultValues: { name: "", description: "", categoryId: "", newBalance: 0 },
  });

  const onCreatePocket = pocketForm.handleSubmit(async (values) => {
    if (!currentUser.data?.id) return;
    const initialAmount = Number.isFinite(values.initialAmount) ? values.initialAmount : 0;
    try {
      await createPocket.mutateAsync({
        name: values.name,
        description: values.description ?? undefined,
        categoryId: values.categoryId || null,
        initialAmount,
        createdByUserId: currentUser.data.id,
      });
      pocketForm.reset();
      toast.success("Caixinha criada");
      setOpenCreatePocket(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível criar a caixinha.");
    }
  });

  const onTransfer = transferForm.handleSubmit(async (values) => {
    if (!currentUser.data?.id) return;
    await transferToPocket.mutateAsync({
      fromType: values.fromType,
      fromPocketId: values.fromPocketId || undefined,
      toType: values.toType,
      toPocketId: values.toPocketId || undefined,
      amount: values.amount,
      transferDate: values.transferDate,
      createdByUserId: currentUser.data.id,
    });
    transferForm.reset({
      fromType: "account",
      fromPocketId: "",
      toType: "pocket",
      toPocketId: "",
      amount: 0,
      transferDate: toInputDate(new Date()),
    });
    toast.success("Transferência concluída");
    setOpenTransfer(false);
  });

  const openEdit = (pocket: EditingPocket) => {
    setEditingPocket(pocket);
    editForm.reset({
      name: pocket.name,
      description: pocket.description ?? "",
      categoryId: pocket.categoryId ?? "",
      newBalance: pocket.balance,
    });
  };

  const onEditPocket = editForm.handleSubmit(async (values) => {
    if (!currentUser.data?.id || !editingPocket) return;
    const { name, description, categoryId, newBalance } = values;
    try {
      await updatePocket.mutateAsync({
        id: editingPocket.id,
        name,
        description: description || null,
        categoryId: categoryId || null,
      });
      const balanceDelta = newBalance - editingPocket.balance;
      if (Math.abs(balanceDelta) > 1e-6) {
        await createAdjustment.mutateAsync({
          targetType: "pocket",
          targetId: editingPocket.id,
          amount: balanceDelta,
          reason: "Ajuste de saldo (edição)",
          adjustmentDate: toInputDate(new Date()),
          createdByUserId: currentUser.data.id,
        });
      }
      toast.success("Caixinha atualizada");
      setEditingPocket(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar a caixinha.");
    }
  });

  const onConfirmDelete = async () => {
    if (!deletingPocket) return;
    try {
      await deletePocket.mutateAsync(deletingPocket.id);
      toast.success("Caixinha excluída");
      setDeletingPocket(null);
      setEditingPocket(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível excluir a caixinha.");
    }
  };

  const openTransfer_ = () => {
    transferForm.reset({
      fromType: "account",
      fromPocketId: "",
      toType: "pocket",
      toPocketId: "",
      amount: 0,
      transferDate: toInputDate(new Date()),
    });
    setOpenTransfer(true);
  };

  const list = useMemo(() => [...(pockets.data ?? [])].sort((a, b) => b.balance - a.balance), [pockets.data]);
  const total = list.reduce((s, p) => s + p.balance, 0);
  const positiveTotal = list.reduce((s, p) => s + Math.max(0, p.balance), 0);
  const pocketOptions = [
    { value: "", label: "Selecione a caixinha" },
    ...list.map((p) => ({ value: p.id, label: p.name })),
  ];
  const categoryOptions = [
    { value: "", label: "Sem categoria" },
    ...(pocketCategories.data ?? []).map((c) => ({ value: c.id, label: c.name })),
  ];
  const transferErrors = transferForm.formState.errors;

  /** Agrupa por categoria de caixinha. Sem nenhuma categoria cadastrada, a lista fica plana. */
  const groups = useMemo(() => {
    const cats = [...(pocketCategories.data ?? [])].sort((a, b) =>
      a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }),
    );
    const known = new Set(cats.map((c) => c.id));
    const byCategory = new Map<string, PocketRow[]>();
    const uncategorized: PocketRow[] = [];
    for (const p of list) {
      if (p.categoryId && known.has(p.categoryId)) {
        byCategory.set(p.categoryId, [...(byCategory.get(p.categoryId) ?? []), p]);
      } else {
        uncategorized.push(p);
      }
    }
    const sections = cats
      .filter((c) => byCategory.has(c.id))
      .map((c) => ({ id: c.id, name: c.name, items: byCategory.get(c.id) ?? [] }));
    return { hasCategories: cats.length > 0, sections, uncategorized };
  }, [list, pocketCategories.data]);

  function renderPocketRow(pocket: PocketRow) {
    const negative = pocket.balance < 0;
    const share = positiveTotal > 0 && !negative ? Math.round((pocket.balance / positiveTotal) * 100) : 0;
    return (
      <LedgerRow
        key={pocket.id}
        tile={
          <span
            className={cn(
              "grid size-10 shrink-0 place-items-center text-[15px] font-bold leading-none tabular-nums",
              negative
                ? "bg-[repeating-linear-gradient(135deg,var(--plane-out)_0_2px,transparent_2px_6px)] text-foreground"
                : "bg-plane-in text-white",
            )}
            aria-hidden
          >
            {negative ? "−" : `${share}%`}
          </span>
        }
        title={pocket.name}
        meta={negative ? <span className="text-ink-out">saldo negativo</span> : pocket.description || null}
        amount={
          <span className={negative ? "text-ink-out" : undefined}>
            {formatAmount(pocket.balance, negative ? "−" : undefined)}
          </span>
        }
        onOpen={() => openEdit(pocket)}
        openLabel={`Editar ${pocket.name}`}
      />
    );
  }

  function sumBalance(items: PocketRow[]) {
    const sum = items.reduce((s, p) => s + p.balance, 0);
    return formatAmount(sum, sum < 0 ? "−" : undefined);
  }

  function countLabel(n: number) {
    return `${n} ${n === 1 ? "caixinha" : "caixinhas"}`;
  }

  return (
    <div className="pb-4">
      <PageHeader
        title="caixinhas"
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={openTransfer_} disabled={list.length === 0}>
              <ArrowLeftRight aria-hidden />
              transferir
            </Button>
            <Button size="sm" className="gap-1.5" onClick={() => setOpenCreatePocket(true)}>
              <Plus aria-hidden />
              nova
            </Button>
          </>
        }
      />

      <section aria-label="Resumo das caixinhas" className="pt-6 md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:items-end md:gap-10">
        <AnswerFigure
          label="guardado nas caixinhas"
          value={formatAmount(total)}
          negative={total < 0}
          loading={pockets.isLoading}
          meta={countLabel(list.length)}
        />
        {pockets.isLoading ? (
          <div className="mt-5 h-12 animate-pulse bg-muted md:mt-0" />
        ) : (
          <PlaneBar
            className="mt-5 md:mt-0"
            label={`Caixinhas: ${list.map((p) => `${p.name} ${formatAmount(p.balance)}`).join(", ")}`}
            segments={list.map((p) => ({
              key: p.id,
              value: Math.max(0, p.balance),
              tone: "in" as const,
              onSelect: () => openEdit(p),
            }))}
          />
        )}
      </section>

      {pockets.isLoading ? (
        <LedgerSkeleton />
      ) : pockets.isError ? (
        <p className="py-10 text-[15px] text-ink-out">Não foi possível carregar as caixinhas. Recarregue a página.</p>
      ) : list.length === 0 ? (
        <div className="space-y-4 py-10">
          <p className="text-[15px] text-muted-foreground">Nenhuma caixinha ainda.</p>
          <Button onClick={() => setOpenCreatePocket(true)} className="gap-2">
            <Plus aria-hidden />
            criar a primeira caixinha
          </Button>
        </div>
      ) : groups.hasCategories ? (
        <>
          {groups.sections.map((section) => (
            <LedgerGroup
              key={section.id}
              title={section.name}
              aside={sumBalance(section.items)}
              meta={countLabel(section.items.length)}
            >
              {section.items.map(renderPocketRow)}
            </LedgerGroup>
          ))}
          {groups.uncategorized.length > 0 ? (
            <LedgerGroup
              title="sem categoria"
              aside={sumBalance(groups.uncategorized)}
              meta={countLabel(groups.uncategorized.length)}
            >
              {groups.uncategorized.map(renderPocketRow)}
            </LedgerGroup>
          ) : null}
        </>
      ) : (
        <div className="mt-8 border-t-2 border-foreground">{list.map(renderPocketRow)}</div>
      )}

      <Modal open={openCreatePocket} onClose={() => setOpenCreatePocket(false)} title="nova caixinha" size="md">
        <form onSubmit={onCreatePocket} className="space-y-4">
          <Field label="Nome" htmlFor="pocket-name">
            <Input id="pocket-name" placeholder="Ex: Reserva de emergência" {...pocketForm.register("name")} />
          </Field>
          <Field label="Descrição (opcional)" htmlFor="pocket-desc">
            <Input id="pocket-desc" placeholder="Ex: Para imprevistos" {...pocketForm.register("description")} />
          </Field>
          <Field label="Categoria" hint="Só para agrupar caixinhas. Não é a categoria das compras.">
            <SelectOptions
              aria-label="Categoria da caixinha"
              value={pocketForm.watch("categoryId") ?? ""}
              onValueChange={(v) => pocketForm.setValue("categoryId", v)}
              options={categoryOptions}
            />
          </Field>
          <Field label="Valor inicial" htmlFor="pocket-initial" hint="Não sai da conta corrente.">
            <CurrencyInput
              id="pocket-initial"
              value={pocketForm.watch("initialAmount") ?? 0}
              onChange={(v) => pocketForm.setValue("initialAmount", v)}
            />
          </Field>
          <FormActions>
            <Button type="button" variant="outline" onClick={() => setOpenCreatePocket(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createPocket.isPending}>
              {createPocket.isPending ? "Criando…" : "Criar caixinha"}
            </Button>
          </FormActions>
        </form>
      </Modal>

      <Modal open={!!editingPocket} onClose={() => setEditingPocket(null)} title="editar caixinha" size="md">
        <form onSubmit={onEditPocket} className="space-y-4">
          <Field label="Nome" htmlFor="edit-name">
            <Input id="edit-name" placeholder="Ex: Reserva de emergência" {...editForm.register("name")} />
          </Field>
          <Field label="Descrição (opcional)" htmlFor="edit-desc">
            <Input id="edit-desc" placeholder="Ex: Para imprevistos" {...editForm.register("description")} />
          </Field>
          <Field label="Categoria" hint="Só para agrupar caixinhas. Não é a categoria das compras.">
            <SelectOptions
              aria-label="Categoria da caixinha"
              value={editForm.watch("categoryId") ?? ""}
              onValueChange={(v) => editForm.setValue("categoryId", v)}
              options={categoryOptions}
            />
          </Field>
          <Field
            label="Saldo"
            htmlFor="edit-balance"
            hint={
              editingPocket ? (
                <>
                  Hoje <span className="font-medium tabular-nums text-foreground">{formatCurrency(editingPocket.balance)}</span>
                  . Só muda o saldo. Não conta como entrada nem como saída do mês.
                </>
              ) : null
            }
          >
            <CurrencyInput
              id="edit-balance"
              allowNegative
              value={editForm.watch("newBalance") ?? 0}
              onChange={(v) => editForm.setValue("newBalance", v)}
            />
          </Field>
          <FormActions
            aside={
              editingPocket ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-ink-out hover:text-ink-out sm:w-auto"
                  onClick={() => setDeletingPocket(editingPocket)}
                >
                  excluir
                </Button>
              ) : null
            }
          >
            <Button type="button" variant="outline" onClick={() => setEditingPocket(null)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={updatePocket.isPending || createAdjustment.isPending}>
              {updatePocket.isPending || createAdjustment.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </FormActions>
        </form>
      </Modal>

      <Modal open={!!deletingPocket} onClose={() => setDeletingPocket(null)} title="excluir caixinha?" size="sm">
        <div className="space-y-4">
          {deletingPocket ? (
            <p className="text-[15px] text-muted-foreground">
              <span className="font-medium text-foreground">{deletingPocket.name}</span> sai da lista.
              {Math.abs(deletingPocket.balance) > 1e-6 ? (
                <>
                  {" "}
                  Ainda tem{" "}
                  <span className="font-medium tabular-nums text-foreground">{formatCurrency(deletingPocket.balance)}</span>.
                  Transfira esse saldo antes de excluir.
                </>
              ) : (
                " Sem saldo, então nada se perde."
              )}
            </p>
          ) : null}
          <p className="text-[15px] text-muted-foreground">
            Se houver compras, depósitos, recorrências ou metas ligados a ela, a exclusão é recusada para manter o histórico.
          </p>
          <FormActions>
            <Button type="button" variant="outline" onClick={() => setDeletingPocket(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={onConfirmDelete}
              disabled={
                deletePocket.isPending || (deletingPocket !== null && Math.abs(deletingPocket.balance) > 1e-6)
              }
            >
              {deletePocket.isPending ? "Excluindo…" : "Excluir"}
            </Button>
          </FormActions>
        </div>
      </Modal>

      <Modal open={openTransfer} onClose={() => setOpenTransfer(false)} title="transferir" size="md">
        <form onSubmit={onTransfer} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="De">
              <SelectOptions
                aria-label="Origem"
                value={transferFromType}
                onValueChange={(v) => {
                  transferForm.setValue("fromType", v as "account" | "pocket");
                  if (v !== "pocket") transferForm.setValue("fromPocketId", "");
                }}
                options={[
                  { value: "account", label: "Conta corrente" },
                  { value: "pocket", label: "Caixinha" },
                ]}
              />
            </Field>
            {transferFromType === "pocket" ? (
              <Field label="Caixinha de origem" error={transferErrors.fromPocketId?.message}>
                <SelectOptions
                  aria-label="Caixinha de origem"
                  value={transferForm.watch("fromPocketId") ?? ""}
                  onValueChange={(v) => transferForm.setValue("fromPocketId", v)}
                  options={pocketOptions}
                />
              </Field>
            ) : null}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Para" error={transferErrors.toType?.message}>
              <SelectOptions
                aria-label="Destino"
                value={transferToType}
                onValueChange={(v) => {
                  transferForm.setValue("toType", v as "account" | "pocket");
                  if (v !== "pocket") transferForm.setValue("toPocketId", "");
                }}
                options={[
                  { value: "account", label: "Conta corrente" },
                  { value: "pocket", label: "Caixinha" },
                ]}
              />
            </Field>
            {transferToType === "pocket" ? (
              <Field label="Caixinha de destino" error={transferErrors.toPocketId?.message}>
                <SelectOptions
                  aria-label="Caixinha de destino"
                  value={transferForm.watch("toPocketId") ?? ""}
                  onValueChange={(v) => transferForm.setValue("toPocketId", v)}
                  options={pocketOptions}
                />
              </Field>
            ) : null}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Valor" htmlFor="transfer-amount">
              <CurrencyInput
                id="transfer-amount"
                value={transferForm.watch("amount") ?? 0}
                onChange={(v) => transferForm.setValue("amount", v)}
              />
            </Field>
            <Field label="Data" htmlFor="transfer-date">
              <Input id="transfer-date" type="date" {...transferForm.register("transferDate")} />
            </Field>
          </div>
          <FormActions>
            <Button type="button" variant="outline" onClick={() => setOpenTransfer(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={transferToPocket.isPending}>
              {transferToPocket.isPending ? "Transferindo…" : "Transferir"}
            </Button>
          </FormActions>
        </form>
      </Modal>
    </div>
  );
}
