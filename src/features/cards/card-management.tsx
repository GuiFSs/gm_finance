"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { useCards, useCreateCard, useCurrentUser, useUpdateCard } from "@/shared/hooks/use-app-data";
import { CardStatementFundingModal } from "@/features/cards/card-statement-funding-modal";
import { AnswerFigure, LedgerSkeleton } from "@/features/month/ledger";
import { formatAmount } from "@/features/month/month-model";
import { PlaneBar, PlaneLegend } from "@/features/month/plane-bar";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import { CurrencyInput } from "@/shared/ui/currency-input";
import { Input } from "@/shared/ui/input";
import { Modal } from "@/shared/ui/modal";
import { Field, FormActions, PageHeader } from "@/shared/ui/page-header";

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
  const [fundingCard, setFundingCard] = useState<CardRow | null>(null);
  const [fundingEpoch, setFundingEpoch] = useState(0);

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
  const totalLimit = list.reduce((s, c) => s + c.creditLimit, 0);
  const totalUsed = list.reduce((s, c) => s + c.usedLimit, 0);
  const totalFree = totalLimit - totalUsed;

  const fields = (f: typeof form, prefix: string) => (
    <>
      <Field label="Nome do cartão" htmlFor={`${prefix}-name`}>
        <Input id={`${prefix}-name`} placeholder="Ex: Nubank" {...f.register("name")} />
      </Field>
      <Field label="Limite" htmlFor={`${prefix}-limit`}>
        <CurrencyInput
          id={`${prefix}-limit`}
          value={f.watch("creditLimit") ?? 0}
          onChange={(v) => f.setValue("creditLimit", v)}
        />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Fecha no dia" htmlFor={`${prefix}-closing`}>
          <Input
            id={`${prefix}-closing`}
            type="number"
            inputMode="numeric"
            min={1}
            max={31}
            {...f.register("closingDay", { valueAsNumber: true })}
          />
        </Field>
        <Field label="Vence no dia" htmlFor={`${prefix}-due`}>
          <Input
            id={`${prefix}-due`}
            type="number"
            inputMode="numeric"
            min={1}
            max={31}
            {...f.register("dueDay", { valueAsNumber: true })}
          />
        </Field>
      </div>
      <p className="text-[15px] text-muted-foreground">Compras no dia do fechamento em diante vão para a fatura seguinte.</p>
    </>
  );

  return (
    <div className="pb-4">
      <PageHeader
        title="cartões"
        actions={
          <Button size="sm" className="gap-1.5" onClick={() => setOpenCreate(true)}>
            <Plus aria-hidden />
            novo
          </Button>
        }
      />

      {list.length > 0 || isLoading ? (
        <section aria-label="Resumo dos cartões" className="pt-6">
          <AnswerFigure
            label={totalFree < 0 ? "passou do limite dos cartões" : "livre nos cartões"}
            value={formatAmount(totalFree)}
            negative={totalFree < 0}
            loading={isLoading}
            meta={`usado ${formatAmount(totalUsed)} de ${formatAmount(totalLimit)}`}
          />
        </section>
      ) : null}

      {isLoading ? (
        <LedgerSkeleton rows={3} />
      ) : cards.isError ? (
        <p className="py-10 text-[15px] text-ink-out">Não foi possível carregar os cartões. Recarregue a página.</p>
      ) : list.length === 0 ? (
        <div className="space-y-4 py-10">
          <p className="text-[15px] text-muted-foreground">Nenhum cartão ainda.</p>
          <Button onClick={() => setOpenCreate(true)} className="gap-2">
            <Plus aria-hidden />
            adicionar o primeiro cartão
          </Button>
        </div>
      ) : (
        <div className="md:grid md:grid-cols-2 md:gap-x-10">
          {list.map((card) => {
            const used = Math.max(0, card.usedLimit);
            const over = used - card.creditLimit;
            const free = card.creditLimit - used;
            const percent = card.creditLimit > 0 ? Math.round((used / card.creditLimit) * 100) : 0;
            return (
              <section key={card.id} className="pt-8" aria-labelledby={`card-${card.id}`}>
                <div className="flex items-baseline justify-between gap-3">
                  <h2 id={`card-${card.id}`} className="min-w-0 truncate text-2xl font-bold leading-tight tracking-tight">
                    {card.name}
                  </h2>
                  <span className={cn("shrink-0 text-[15px] font-medium tabular-nums text-foreground")}>
                    {percent}%
                  </span>
                </div>
                <p className="mt-0.5 text-[15px] text-muted-foreground">
                  fecha dia {card.closingDay} · vence dia {card.dueDay}
                </p>
                <PlaneBar
                  className="mt-3"
                  label={`${card.name}: usado ${formatAmount(used)} de ${formatAmount(card.creditLimit)}`}
                  segments={[
                    { key: "used", value: Math.min(used, card.creditLimit), tone: "out" },
                    over > 0
                      ? { key: "over", value: over, tone: "deficit" }
                      : { key: "free", value: free, tone: "in" },
                  ]}
                />
                <PlaneLegend
                  className="mt-3"
                  items={[
                    { key: "used", label: "usado", tone: "out", amount: formatAmount(used) },
                    over > 0
                      ? { key: "over", label: "excedido", tone: "deficit", amount: formatAmount(over) }
                      : { key: "free", label: "livre", tone: "in", amount: formatAmount(free) },
                  ]}
                />
                <div className="mt-2 flex gap-2 border-t border-border pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setFundingCard(card);
                      setFundingEpoch((e) => e + 1);
                    }}
                  >
                    pagar fatura
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => openEdit(card)}>
                    editar
                  </Button>
                </div>
              </section>
            );
          })}
        </div>
      )}

      <Modal open={openCreate} onClose={() => setOpenCreate(false)} title="novo cartão" size="md">
        <form onSubmit={onSubmit} className="space-y-4">
          {fields(form, "card")}
          <FormActions>
            <Button type="button" variant="outline" onClick={() => setOpenCreate(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createCard.isPending}>
              {createCard.isPending ? "Salvando…" : "Salvar cartão"}
            </Button>
          </FormActions>
        </form>
      </Modal>

      <CardStatementFundingModal
        key={fundingCard ? `${fundingCard.id}-${fundingEpoch}` : "idle"}
        card={fundingCard ? { id: fundingCard.id, name: fundingCard.name } : null}
        open={!!fundingCard}
        onClose={() => setFundingCard(null)}
      />

      <Modal open={!!editingCard} onClose={() => setEditingCard(null)} title="editar cartão" size="md">
        <form onSubmit={onEditCard} className="space-y-4">
          {fields(editForm, "edit-card")}
          <FormActions>
            <Button type="button" variant="outline" onClick={() => setEditingCard(null)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={updateCard.isPending}>
              {updateCard.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </FormActions>
        </form>
      </Modal>
    </div>
  );
}
