"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch, type Resolver } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import {
  useCreateAdjustment,
  useCreatePocket,
  useCurrentUser,
  usePockets,
  useTransferToPocket,
  useUpdatePocket,
} from "@/shared/hooks/use-app-data";
import { toInputDate, formatCurrency } from "@/shared/utils/formatters";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { CurrencyInput } from "@/shared/ui/currency-input";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Modal } from "@/shared/ui/modal";
import { SelectOptions } from "@/shared/ui/select-options";

const pocketSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
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
  newBalance: z.number(),
});

type EditPocketValues = z.infer<typeof editPocketSchema>;

export function PocketManagement() {
  const currentUser = useCurrentUser();
  const pockets = usePockets();
  const createPocket = useCreatePocket();
  const updatePocket = useUpdatePocket();
  const createAdjustment = useCreateAdjustment();
  const transferToPocket = useTransferToPocket();

  const pocketForm = useForm<PocketFormValues>({
    resolver: zodResolver(pocketSchema) as Resolver<PocketFormValues>,
    defaultValues: { name: "", description: "", initialAmount: 0 },
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
  const [editingPocket, setEditingPocket] = useState<{
    id: string;
    name: string;
    description: string | null;
    balance: number;
  } | null>(null);

  const editForm = useForm<EditPocketValues>({
    resolver: zodResolver(editPocketSchema),
    defaultValues: { name: "", description: "", newBalance: 0 },
  });

  const onCreatePocket = pocketForm.handleSubmit(async (values) => {
    if (!currentUser.data?.id) return;
    const initialAmount = Number.isFinite(values.initialAmount) ? values.initialAmount : 0;
    await createPocket.mutateAsync({
      name: values.name,
      description: values.description ?? undefined,
      initialAmount,
      createdByUserId: currentUser.data.id,
    });
    pocketForm.reset();
    toast.success("Caixinha criada");
    setOpenCreatePocket(false);
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

  const openEdit = (pocket: { id: string; name: string; description: string | null; balance: number }) => {
    setEditingPocket(pocket);
    editForm.reset({
      name: pocket.name,
      description: pocket.description ?? "",
      newBalance: pocket.balance,
    });
  };

  const onEditPocket = editForm.handleSubmit(async (values) => {
    if (!currentUser.data?.id || !editingPocket) return;
    const { name, description, newBalance } = values;
    await updatePocket.mutateAsync({
      id: editingPocket.id,
      name,
      description: description || null,
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
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
          <CardTitle>Caixinhas</CardTitle>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => setOpenCreatePocket(true)}>Nova caixinha</Button>
            <Button
              variant="outline"
              onClick={() => {
                transferForm.reset({
                  fromType: "account",
                  fromPocketId: "",
                  toType: "pocket",
                  toPocketId: "",
                  amount: 0,
                  transferDate: toInputDate(new Date()),
                });
                setOpenTransfer(true);
              }}
            >
              Transferir
            </Button>
          </div>
        </CardHeader>
        <CardContent>

        <Modal open={openCreatePocket} onClose={() => setOpenCreatePocket(false)} title="Nova caixinha" size="md">
          <form onSubmit={onCreatePocket} className="space-y-4">
            <div>
              <Label htmlFor="pocket-name">Nome</Label>
              <Input id="pocket-name" placeholder="Ex: Reserva de emergência" {...pocketForm.register("name")} />
            </div>
            <div>
              <Label htmlFor="pocket-desc">Descrição (opcional)</Label>
              <Input id="pocket-desc" placeholder="Ex: Para imprevistos" {...pocketForm.register("description")} />
            </div>
            <div>
              <Label htmlFor="pocket-initial">Valor inicial</Label>
              <CurrencyInput
                id="pocket-initial"
                value={pocketForm.watch("initialAmount") ?? 0}
                onChange={(v) => pocketForm.setValue("initialAmount", v)}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Saldo inicial da caixinha (não altera a conta corrente).
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpenCreatePocket(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createPocket.isPending}>
                {createPocket.isPending ? "Criando..." : "Criar caixinha"}
              </Button>
            </div>
          </form>
        </Modal>

        <Modal
          open={!!editingPocket}
          onClose={() => setEditingPocket(null)}
          title="Editar caixinha"
          size="md"
        >
          <form onSubmit={onEditPocket} className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Nome</Label>
              <Input
                id="edit-name"
                placeholder="Ex: Reserva de emergência"
                {...editForm.register("name")}
              />
            </div>
            <div>
              <Label htmlFor="edit-desc">Descrição (opcional)</Label>
              <Input
                id="edit-desc"
                placeholder="Ex: Para imprevistos"
                {...editForm.register("description")}
              />
            </div>
            <div>
              <Label>Saldo atual</Label>
              <p className="text-lg font-semibold tabular-nums text-foreground">
                {editingPocket ? formatCurrency(editingPocket.balance) : "—"}
              </p>
            </div>
            <div>
              <Label htmlFor="edit-balance">Novo saldo</Label>
              <CurrencyInput
                id="edit-balance"
                value={editForm.watch("newBalance") ?? 0}
                onChange={(v) => editForm.setValue("newBalance", v)}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Altere o valor para corrigir o saldo da caixinha (gera um ajuste).
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditingPocket(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={updatePocket.isPending || createAdjustment.isPending}>
                {updatePocket.isPending || createAdjustment.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </form>
        </Modal>

        <Modal open={openTransfer} onClose={() => setOpenTransfer(false)} title="Transferir" size="md">
          <form onSubmit={onTransfer} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label>Origem</Label>
                <SelectOptions
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
              </div>
              {transferFromType === "pocket" && (
                <div>
                  <Label>Caixinha de origem</Label>
                  <SelectOptions
                    value={transferForm.watch("fromPocketId") ?? ""}
                    onValueChange={(v) => transferForm.setValue("fromPocketId", v)}
                    options={[
                      { value: "", label: "Selecione a caixinha" },
                      ...(pockets.data ?? []).map((p) => ({ value: p.id, label: p.name })),
                    ]}
                  />
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label>Destino</Label>
                <SelectOptions
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
              </div>
              {transferToType === "pocket" && (
                <div>
                  <Label>Caixinha de destino</Label>
                  <SelectOptions
                    value={transferForm.watch("toPocketId") ?? ""}
                    onValueChange={(v) => transferForm.setValue("toPocketId", v)}
                    options={[
                      { value: "", label: "Selecione a caixinha" },
                      ...(pockets.data ?? []).map((p) => ({ value: p.id, label: p.name })),
                    ]}
                  />
                </div>
              )}
            </div>
            <div>
              <Label>Valor</Label>
              <CurrencyInput
                value={transferForm.watch("amount") ?? 0}
                onChange={(v) => transferForm.setValue("amount", v)}
              />
            </div>
            <div>
              <Label>Data</Label>
              <Input type="date" {...transferForm.register("transferDate")} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpenTransfer(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={transferToPocket.isPending}>
                {transferToPocket.isPending ? "Transferindo..." : "Transferir"}
              </Button>
            </div>
          </form>
        </Modal>

        <div className="space-y-3">
          {(pockets.data ?? []).map((pocket) => (
            <div
              key={pocket.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3 dark:bg-muted/20"
            >
              <div className="min-w-0">
                <p className="font-medium text-foreground">{pocket.name}</p>
                {pocket.description && (
                  <p className="mt-0.5 text-sm text-muted-foreground">{pocket.description}</p>
                )}
                {pocket.balance < 0 && (
                  <Badge variant="destructive" className="mt-1.5">
                    Saldo negativo na caixinha
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3">
                <p className={`text-lg font-semibold tabular-nums ${pocket.balance < 0 ? "text-destructive" : "text-foreground"}`}>
                  {formatCurrency(pocket.balance)}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => openEdit(pocket)}
                  aria-label="Editar caixinha"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
        </CardContent>
      </Card>
    </div>
  );
}
