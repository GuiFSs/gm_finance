"use client";

import { differenceInCalendarMonths, parseISO } from "date-fns";
import { Plus } from "lucide-react";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { AnswerFigure, LedgerSkeleton } from "@/features/month/ledger";
import { formatAmount, monthLabel } from "@/features/month/month-model";
import { PlaneBar, PlaneLegend } from "@/features/month/plane-bar";
import { useCreateGoal, useCurrentUser, useGoals, usePockets } from "@/shared/hooks/use-app-data";
import { Button } from "@/shared/ui/button";
import { CurrencyInput } from "@/shared/ui/currency-input";
import { Input } from "@/shared/ui/input";
import { Modal } from "@/shared/ui/modal";
import { Field, FormActions, PageHeader } from "@/shared/ui/page-header";
import { SelectOptions } from "@/shared/ui/select-options";

const schema = z.object({
  title: z.string().min(1, "Dê um nome à meta"),
  targetAmount: z.number().positive("Informe o valor alvo"),
  pocketId: z.string().min(1, "Escolha a caixinha"),
  deadline: z.string().optional(),
});

/** Meses inteiros até o prazo, contando o mês corrente. */
function monthsLeft(deadline: string): number {
  return differenceInCalendarMonths(parseISO(deadline), new Date()) + 1;
}

export function GoalManagement() {
  const goals = useGoals();
  const pockets = usePockets();
  const currentUser = useCurrentUser();
  const createGoal = useCreateGoal();
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      targetAmount: 0,
      pocketId: "",
      deadline: "",
    },
  });
  const pocketId = useWatch({ control: form.control, name: "pocketId" });
  const errors = form.formState.errors;

  const [openCreate, setOpenCreate] = useState(false);

  const onSubmit = form.handleSubmit(async (values) => {
    if (!currentUser.data?.id) return;
    try {
      await createGoal.mutateAsync({ ...values, createdByUserId: currentUser.data.id });
      form.reset({ ...values, title: "", targetAmount: 0 });
      toast.success("Meta criada");
      setOpenCreate(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível criar a meta.");
    }
  });

  const list = goals.data ?? [];
  const saved = list.reduce((s, g) => s + Math.min(Math.max(0, g.progressAmount), g.targetAmount), 0);
  const target = list.reduce((s, g) => s + g.targetAmount, 0);

  return (
    <div className="pb-4">
      <PageHeader
        title="metas"
        actions={
          <Button size="sm" className="gap-1.5" onClick={() => setOpenCreate(true)}>
            <Plus aria-hidden />
            nova
          </Button>
        }
      />

      {list.length > 0 || goals.isLoading ? (
        <section aria-label="Resumo das metas" className="pt-6">
          <AnswerFigure
            label="falta guardar"
            value={formatAmount(Math.max(0, target - saved))}
            loading={goals.isLoading}
            meta={`guardado ${formatAmount(saved)} de ${formatAmount(target)}`}
          />
        </section>
      ) : null}

      {goals.isLoading ? (
        <LedgerSkeleton rows={3} />
      ) : goals.isError ? (
        <p className="py-10 text-[15px] text-ink-out">Não foi possível carregar as metas. Recarregue a página.</p>
      ) : list.length === 0 ? (
        <div className="space-y-4 py-10">
          <p className="text-[15px] text-muted-foreground">Nenhuma meta ainda. Uma meta acompanha o saldo de uma caixinha.</p>
          <Button onClick={() => setOpenCreate(true)} className="gap-2">
            <Plus aria-hidden />
            criar a primeira meta
          </Button>
        </div>
      ) : (
        <div className="md:grid md:grid-cols-2 md:gap-x-10">
          {list.map((goal) => {
            const progress = Math.max(0, goal.progressAmount);
            const missing = Math.max(0, goal.targetAmount - progress);
            const done = missing <= 0.004;
            const percent = goal.targetAmount > 0 ? Math.min(100, Math.round((progress / goal.targetAmount) * 100)) : 0;
            const left = goal.deadline ? monthsLeft(goal.deadline) : null;
            const meta = [
              goal.pocketName,
              goal.deadline ? `até ${monthLabel(goal.deadline.slice(0, 7))}` : null,
              done
                ? "alcançada"
                : left != null && left > 0
                  ? `${formatAmount(missing / left)} por mês`
                  : left != null
                    ? "prazo passou"
                    : null,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <section key={goal.id} className="pt-8" aria-labelledby={`goal-${goal.id}`}>
                <div className="flex items-baseline justify-between gap-3">
                  <h2 id={`goal-${goal.id}`} className="min-w-0 truncate text-2xl font-bold leading-tight tracking-tight">
                    {goal.title}
                  </h2>
                  <span className="shrink-0 text-[15px] font-medium tabular-nums text-foreground">{percent}%</span>
                </div>
                <p className="mt-0.5 truncate text-[15px] text-muted-foreground">{meta}</p>
                <PlaneBar
                  className="mt-3"
                  label={`${goal.title}: guardado ${formatAmount(progress)} de ${formatAmount(goal.targetAmount)}`}
                  segments={[
                    { key: "saved", value: Math.min(progress, goal.targetAmount), tone: "in" },
                    { key: "missing", value: missing, tone: "forecast-in" },
                  ]}
                />
                <PlaneLegend
                  className="mt-3"
                  items={[
                    { key: "saved", label: "guardado", tone: "in", amount: formatAmount(progress), value: progress },
                    { key: "missing", label: "falta", tone: "forecast-in", amount: formatAmount(missing), value: missing },
                  ]}
                />
              </section>
            );
          })}
        </div>
      )}

      <Modal open={openCreate} onClose={() => setOpenCreate(false)} title="nova meta" size="md">
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Nome" htmlFor="goal-title" error={errors.title?.message}>
            <Input id="goal-title" placeholder="Ex: Viagem" {...form.register("title")} />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Valor alvo" htmlFor="goal-target" error={errors.targetAmount?.message}>
              <CurrencyInput
                id="goal-target"
                value={form.watch("targetAmount") ?? 0}
                onChange={(v) => form.setValue("targetAmount", v)}
              />
            </Field>
            <Field label="Prazo (opcional)" htmlFor="goal-deadline">
              <Input id="goal-deadline" type="date" {...form.register("deadline")} />
            </Field>
          </div>
          <Field label="Caixinha" error={errors.pocketId?.message} hint="O saldo da caixinha é o quanto já foi guardado.">
            <SelectOptions
              aria-label="Caixinha"
              value={pocketId ?? ""}
              onValueChange={(v) => form.setValue("pocketId", v)}
              options={[
                { value: "", label: "Selecione a caixinha" },
                ...(pockets.data ?? []).map((pocket) => ({ value: pocket.id, label: pocket.name })),
              ]}
            />
          </Field>
          <FormActions>
            <Button type="button" variant="outline" onClick={() => setOpenCreate(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createGoal.isPending}>
              {createGoal.isPending ? "Salvando…" : "Salvar meta"}
            </Button>
          </FormActions>
        </form>
      </Modal>
    </div>
  );
}
