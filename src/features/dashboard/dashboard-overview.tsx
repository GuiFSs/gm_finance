"use client";

import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

import { useCreateAdjustment, useCurrentUser, useDashboard } from "@/shared/hooks/use-app-data";
import { formatCurrency, formatDisplayDate, toInputDate } from "@/shared/utils/formatters";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { CurrencyInput } from "@/shared/ui/currency-input";
import { Label } from "@/shared/ui/label";
import { Modal } from "@/shared/ui/modal";

export function DashboardOverview() {
  const { data, isLoading } = useDashboard();
  const currentUser = useCurrentUser();
  const createAdjustment = useCreateAdjustment();
  const [openEditAccount, setOpenEditAccount] = useState(false);
  const [newBalance, setNewBalance] = useState(0);

  const openEditAccountModal = () => {
    if (data) {
      setNewBalance(data.checkingBalance);
      setOpenEditAccount(true);
    }
  };

  const onSaveAccountBalance = async () => {
    if (!currentUser.data?.id || !data) return;
    const amount = newBalance - data.checkingBalance;
    if (Math.abs(amount) < 1e-6) {
      setOpenEditAccount(false);
      return;
    }
    await createAdjustment.mutateAsync({
      targetType: "account",
      amount,
      reason: "Ajuste de saldo da conta corrente",
      adjustmentDate: toInputDate(new Date()),
      createdByUserId: currentUser.data.id,
    });
    toast.success("Saldo da conta atualizado");
    setOpenEditAccount(false);
  };

  if (isLoading || !data) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">Carregando dashboard...</p>;
  }

  return (
    <div className="space-y-6">
      {/* Resumo: métricas principais */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <MetricCard label="Saldo total" value={data.totalBalance} />
        <MetricCard label="Despesas do mês" value={-Math.abs(data.monthlyExpenses)} />
      </div>

      {/* Conta corrente + Caixinhas em um único card compacto */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Saldos</CardTitle>
          <p className="text-xs text-muted-foreground">Conta corrente e caixinhas</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/40 py-2 px-3 dark:bg-muted/30">
            <span className="text-sm font-medium text-muted-foreground">Conta corrente</span>
            <div className="flex items-center gap-2">
              <span
                className={`text-base font-semibold tabular-nums ${data.checkingBalance < 0 ? "text-destructive" : "text-foreground"}`}
              >
                {formatCurrency(data.checkingBalance)}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={openEditAccountModal}
                className="h-7 shrink-0 text-xs text-muted-foreground"
              >
                Editar
              </Button>
            </div>
          </div>
          {data.pocketBalances.length > 0 ? (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Caixinhas</p>
              <ul className="divide-y divide-border rounded-md border border-border">
                {data.pocketBalances.map((pocket) => (
                  <li
                    key={pocket.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2 px-3 first:rounded-t-md last:rounded-b-md"
                  >
                    <span className="text-sm text-foreground">{pocket.name}</span>
                    <div className="flex items-center gap-2">
                      {pocket.balance < 0 && (
                        <Badge variant="destructive" className="h-5 gap-0.5 px-1.5 text-xs">
                          <AlertTriangle size={10} />
                          Negativo
                        </Badge>
                      )}
                      <span
                        className={`text-sm font-semibold tabular-nums ${pocket.balance < 0 ? "text-destructive" : "text-foreground"}`}
                      >
                        {formatCurrency(pocket.balance)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma caixinha cadastrada.</p>
          )}
        </CardContent>
      </Card>

      <Modal
        open={openEditAccount}
        onClose={() => setOpenEditAccount(false)}
        title="Editar conta corrente"
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <Label>Saldo atual</Label>
            <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
              {formatCurrency(data.checkingBalance)}
            </p>
          </div>
          <div>
            <Label htmlFor="account-new-balance">Novo saldo</Label>
            <CurrencyInput
              id="account-new-balance"
              value={newBalance}
              onChange={setNewBalance}
              allowNegative
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpenEditAccount(false)}>
              Cancelar
            </Button>
            <Button onClick={onSaveAccountBalance} disabled={createAdjustment.isPending}>
              {createAdjustment.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </Modal>

      <div className="grid grid-cols-1 gap-5 lg:gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Evolução do saldo</CardTitle>
          </CardHeader>
          <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.balanceEvolution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: 8, color: "#e5e7eb" }} />
                <Line type="monotone" dataKey="balance" stroke="#3b82f6" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Despesas por categoria</CardTitle>
          </CardHeader>
          <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.expensesByCategory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: 8, color: "#e5e7eb" }} />
                <Bar dataKey="total" fill="#0ea5e9" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Maiores despesas</CardTitle>
          </CardHeader>
          <CardContent>
          <ul className="space-y-3 text-sm text-muted-foreground">
            {data.biggestExpenses.map((expense) => (
              <li key={`${expense.title}-${expense.purchaseDate}`} className="flex justify-between gap-2">
                <span>{expense.title}</span>
                <span className="font-medium">{formatCurrency(expense.amount)}</span>
              </li>
            ))}
          </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Parcelas a vencer</CardTitle>
          </CardHeader>
          <CardContent>
          <ul className="space-y-3 text-sm text-muted-foreground">
            {data.upcomingInstallments.map((installment) => (
              <li key={`${installment.title}-${installment.purchaseDate}-${installment.installmentNumber}`}>
                {installment.title} ({installment.installmentNumber}/{installment.installmentCount}) -{" "}
                {formatCurrency(installment.amount)}
              </li>
            ))}
          </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recorrentes próximos</CardTitle>
          </CardHeader>
          <CardContent>
          <ul className="space-y-3 text-sm text-muted-foreground">
            {data.upcomingRecurring.map((rec) => (
              <li key={`${rec.title}-${rec.nextExecutionDate}`}>
                {formatDisplayDate(rec.nextExecutionDate)} - {rec.title} ({formatCurrency(rec.amount)})
              </li>
            ))}
          </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  onEdit,
}: {
  label: string;
  value: number;
  onEdit?: () => void;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-1.5 px-4 py-3 pb-1">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {onEdit && (
          <Button variant="ghost" size="sm" onClick={onEdit} className="h-7 shrink-0 px-2 text-xs text-muted-foreground">
            Editar
          </Button>
        )}
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">
        <p className={`text-lg font-bold tabular-nums tracking-tight sm:text-xl ${value < 0 ? "text-destructive" : "text-foreground"}`}>
          {formatCurrency(value)}
        </p>
        {value < 0 && (
          <Badge variant="destructive" className="mt-2 gap-1 py-0 text-xs">
            <AlertTriangle size={10} />
            Atenção
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}
