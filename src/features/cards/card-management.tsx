"use client";

import { CreditCard, Pencil } from "lucide-react";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { useCards, useCreateCard, useCurrentUser, useUpdateCard } from "@/shared/hooks/use-app-data";
import { formatCurrency } from "@/shared/utils/formatters";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { CurrencyInput } from "@/shared/ui/currency-input";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Modal } from "@/shared/ui/modal";
import { PageHeader } from "@/shared/ui/page-header";

const schema = z.object({
  name: z.string().min(1),
  creditLimit: z.number().positive(),
  closingDay: z.number().int().min(1).max(31),
  dueDay: z.number().int().min(1).max(31),
});

type CardFormValues = z.infer<typeof schema>;

type CardRow = {
  id: string;
  name: string;
  creditLimit: number;
  closingDay: number;
  dueDay: number;
  usedLimit: number;
};

export function CardManagement() {
  const currentUser = useCurrentUser();
  const cards = useCards();
  const createCard = useCreateCard();
  const updateCard = useUpdateCard();
  const form = useForm<CardFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", creditLimit: 0, closingDay: 1, dueDay: 10 },
  });

  const [openCreate, setOpenCreate] = useState(false);
  const [editingCard, setEditingCard] = useState<CardRow | null>(null);

  const editForm = useForm<CardFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", creditLimit: 0, closingDay: 1, dueDay: 10 },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    if (!currentUser.data?.id) return;
    await createCard.mutateAsync({ ...values, createdByUserId: currentUser.data.id });
    form.reset({ ...values, name: "", creditLimit: 0 });
    setOpenCreate(false);
  });

  const openEdit = (card: CardRow) => {
    setEditingCard(card);
    editForm.reset({
      name: card.name,
      creditLimit: card.creditLimit,
      closingDay: card.closingDay,
      dueDay: card.dueDay,
    });
  };

  const onEditCard = editForm.handleSubmit(async (values) => {
    if (!editingCard) return;
    await updateCard.mutateAsync({
      id: editingCard.id,
      name: values.name,
      creditLimit: values.creditLimit,
      closingDay: values.closingDay,
      dueDay: values.dueDay,
    });
    toast.success("Cartão atualizado");
    setEditingCard(null);
  });

  const list = cards.data ?? [];
  const isLoading = cards.isLoading;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Cartões"
        description="Gerencie seus cartões de crédito e acompanhe o uso do limite."
        actions={
          <Button className="w-full sm:w-auto" onClick={() => setOpenCreate(true)}>
            Adicionar cartão
          </Button>
        }
      />

      <Modal open={openCreate} onClose={() => setOpenCreate(false)} title="Adicionar cartão" size="md">
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="card-name">Nome do cartão</Label>
            <Input id="card-name" placeholder="Ex: Nubank" {...form.register("name")} />
          </div>
            <div>
              <Label htmlFor="card-limit">Limite de crédito</Label>
              <CurrencyInput
                id="card-limit"
                value={form.watch("creditLimit") ?? 0}
                onChange={(v) => form.setValue("creditLimit", v)}
              />
            </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="card-closing">Dia do fechamento</Label>
              <Input
                id="card-closing"
                type="number"
                min={1}
                max={31}
                {...form.register("closingDay", { valueAsNumber: true })}
              />
            </div>
            <div>
              <Label htmlFor="card-due">Dia do vencimento</Label>
              <Input
                id="card-due"
                type="number"
                min={1}
                max={31}
                {...form.register("dueDay", { valueAsNumber: true })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpenCreate(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createCard.isPending}>
              {createCard.isPending ? "Salvando..." : "Salvar cartão"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!editingCard}
        onClose={() => setEditingCard(null)}
        title="Editar cartão"
        size="md"
      >
        <form onSubmit={onEditCard} className="space-y-4">
          <div>
            <Label htmlFor="edit-card-name">Nome do cartão</Label>
            <Input
              id="edit-card-name"
              placeholder="Ex: Nubank"
              {...editForm.register("name")}
            />
          </div>
          <div>
            <Label htmlFor="edit-card-limit">Limite de crédito</Label>
            <CurrencyInput
              id="edit-card-limit"
              value={editForm.watch("creditLimit") ?? 0}
              onChange={(v) => editForm.setValue("creditLimit", v)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit-card-closing">Dia do fechamento</Label>
              <Input
                id="edit-card-closing"
                type="number"
                min={1}
                max={31}
                {...editForm.register("closingDay", { valueAsNumber: true })}
              />
            </div>
            <div>
              <Label htmlFor="edit-card-due">Dia do vencimento</Label>
              <Input
                id="edit-card-due"
                type="number"
                min={1}
                max={31}
                {...editForm.register("dueDay", { valueAsNumber: true })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setEditingCard(null)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={updateCard.isPending}>
              {updateCard.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </Modal>

      {isLoading ? (
        <div className="rounded-xl border border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
          Carregando cartões...
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 px-6 py-16 text-center">
          <CreditCard className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-sm font-medium text-foreground">Nenhum cartão cadastrado</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Adicione seu primeiro cartão para acompanhar o limite e as faturas.
          </p>
          <Button className="mt-6 w-full max-w-xs sm:w-auto" onClick={() => setOpenCreate(true)}>
            Adicionar cartão
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((card) => {
            const usageRatio = card.creditLimit === 0 ? 0 : card.usedLimit / card.creditLimit;
            const usagePercent = Math.round(usageRatio * 100);
            const isHighUsage = usageRatio >= 0.8;
            return (
              <article
                key={card.id}
                className="rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <CreditCard className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-foreground">{card.name}</h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Fechamento dia {card.closingDay} · Vencimento dia {card.dueDay}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEdit(card)}
                      aria-label="Editar cartão"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {isHighUsage && (
                      <Badge variant="secondary">
                        Limite alto
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="mt-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Usado</span>
                    <span className="font-medium tabular-nums text-foreground">
                      {formatCurrency(card.usedLimit)} / {formatCurrency(card.creditLimit)}
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isHighUsage ? "bg-destructive" : "bg-primary"
                      }`}
                      style={{ width: `${Math.min(usagePercent, 100)}%` }}
                    />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
