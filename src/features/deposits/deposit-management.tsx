"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useCreateDeposit, useCurrentUser, useDeposits } from "@/shared/hooks/use-app-data";
import { formatCurrency, toInputDate } from "@/shared/utils/formatters";
import { Button } from "@/shared/ui/button";
import { Card, CardTitle } from "@/shared/ui/card";
import { CurrencyInput } from "@/shared/ui/currency-input";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Modal } from "@/shared/ui/modal";

const schema = z.object({
  title: z.string().min(1),
  amount: z.number().positive(),
  depositDate: z.string().min(1),
});

export function DepositManagement() {
  const deposits = useDeposits();
  const createDeposit = useCreateDeposit();
  const currentUser = useCurrentUser();
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      amount: 0,
      depositDate: toInputDate(new Date()),
    },
  });

  const [openCreate, setOpenCreate] = useState(false);

  const onSubmit = form.handleSubmit(async (values) => {
    if (!currentUser.data?.id) return;
    await createDeposit.mutateAsync({ ...values, createdByUserId: currentUser.data.id });
    form.reset({ ...values, title: "", amount: 0 });
    setOpenCreate(false);
  });

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <CardTitle>Histórico de depósitos</CardTitle>
          <Button onClick={() => setOpenCreate(true)}>Novo depósito</Button>
        </div>

        <Modal open={openCreate} onClose={() => setOpenCreate(false)} title="Novo depósito" size="md">
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label>Título</Label>
              <Input placeholder="Ex: Salário, bônus" {...form.register("title")} />
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
                <Label>Data</Label>
                <Input type="date" {...form.register("depositDate")} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpenCreate(false)}>Cancelar</Button>
              <Button type="submit" disabled={createDeposit.isPending}>
                {createDeposit.isPending ? "Salvando..." : "Salvar depósito"}
              </Button>
            </div>
          </form>
        </Modal>
        <ul className="mt-4 space-y-2 text-sm">
          {(deposits.data ?? []).map((deposit) => (
            <li key={deposit.id} className="flex justify-between rounded-md border border-gray-200 p-2 text-gray-700 dark:border-gray-700 dark:text-gray-300">
              <span>
                {deposit.depositDate} - {deposit.title}
              </span>
              <span className="font-medium">{formatCurrency(deposit.amount)}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
