"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { useCreateGoal, useCurrentUser, useGoals, usePockets } from "@/shared/hooks/use-app-data";
import { formatCurrency } from "@/shared/utils/formatters";
import { Button } from "@/shared/ui/button";
import { Card, CardTitle } from "@/shared/ui/card";
import { CurrencyInput } from "@/shared/ui/currency-input";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Modal } from "@/shared/ui/modal";
import { SelectOptions } from "@/shared/ui/select-options";

const schema = z.object({
  title: z.string().min(1),
  targetAmount: z.number().positive(),
  pocketId: z.string().min(1),
  deadline: z.string().optional(),
});

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

  const [openCreate, setOpenCreate] = useState(false);

  const onSubmit = form.handleSubmit(async (values) => {
    if (!currentUser.data?.id) return;
    await createGoal.mutateAsync({ ...values, createdByUserId: currentUser.data.id });
    form.reset({ ...values, title: "", targetAmount: 0 });
    setOpenCreate(false);
  });

  return (
    <div className="space-y-4">
      <Card className="p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <CardTitle className="text-lg sm:text-xl">Metas</CardTitle>
          <Button className="w-full sm:w-auto" onClick={() => setOpenCreate(true)}>
            Nova meta
          </Button>
        </div>

        <Modal open={openCreate} onClose={() => setOpenCreate(false)} title="Nova meta" size="md">
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label>Nome da meta</Label>
              <Input placeholder="Ex: Viagem" {...form.register("title")} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label>Valor alvo</Label>
                <CurrencyInput
                  value={form.watch("targetAmount") ?? 0}
                  onChange={(v) => form.setValue("targetAmount", v)}
                />
              </div>
              <div>
                <Label>Data limite (opcional)</Label>
                <Input type="date" {...form.register("deadline")} />
              </div>
            </div>
            <div>
              <Label>Caixinha</Label>
              <SelectOptions
                value={pocketId ?? ""}
                onValueChange={(v) => form.setValue("pocketId", v)}
                options={[
                  { value: "", label: "Selecione a caixinha" },
                  ...(pockets.data ?? []).map((pocket) => ({ value: pocket.id, label: pocket.name })),
                ]}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpenCreate(false)}>Cancelar</Button>
              <Button type="submit" disabled={createGoal.isPending}>
                {createGoal.isPending ? "Salvando..." : "Salvar meta"}
              </Button>
            </div>
          </form>
        </Modal>
        <div className="mt-4 space-y-2">
          {(goals.data ?? []).map((goal) => {
            const progress = goal.targetAmount === 0 ? 0 : Math.min(100, (goal.progressAmount / goal.targetAmount) * 100);
            return (
              <div key={goal.id} className="rounded-md border border-gray-200 p-3 dark:border-gray-700">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                  <p className="min-w-0 font-medium dark:text-gray-100">{goal.title}</p>
                  <p className="shrink-0 text-sm tabular-nums dark:text-gray-300">
                    {formatCurrency(goal.progressAmount)} / {formatCurrency(goal.targetAmount)}
                  </p>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Caixinha: {goal.pocketName}</p>
                <div className="mt-2 h-2 rounded-full bg-gray-100 dark:bg-gray-800">
                  <div className="h-2 rounded-full bg-blue-600" style={{ width: `${progress}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
