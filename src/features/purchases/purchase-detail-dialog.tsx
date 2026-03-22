"use client";

import { CreditCard, Landmark, Loader2, Pencil, PiggyBank, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { useDeletePurchase, usePurchaseDetail } from "@/shared/hooks/use-app-data";
import { formatCalendarMonthLabel, formatCurrency, formatDisplayDate, formatYearMonthLabel } from "@/shared/utils/formatters";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

export function PurchaseDetailDialog({
  purchaseId,
  open,
  onOpenChange,
  title = "Detalhes da despesa",
  onEdit,
  onDeleted,
}: {
  purchaseId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Título da janela (ex.: movimentos vs compras) */
  title?: string;
  /** Se definido, chamado ao clicar em Editar (recebe o ID da compra). Senão, redireciona para /purchases?edit= */
  onEdit?: (purchaseId: string) => void;
  onDeleted?: () => void;
}) {
  const router = useRouter();
  const deletePurchase = useDeletePurchase();
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const { data, isLoading, isError } = usePurchaseDetail(open ? purchaseId : null);

  const handleEdit = () => {
    if (!purchaseId) return;
    if (onEdit) onEdit(purchaseId);
    else router.push(`/purchases?edit=${purchaseId}`);
    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (!purchaseId) return;
    try {
      await deletePurchase.mutateAsync(purchaseId);
      toast.success("Despesa excluída");
      setConfirmDeleteOpen(false);
      onOpenChange(false);
      onDeleted?.();
    } catch {
      toast.error("Não foi possível excluir");
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] w-[calc(100vw-1rem)] max-w-2xl gap-0 overflow-y-auto p-0 sm:w-full">
        <div className="border-b border-border px-4 py-4 sm:px-6 sm:py-5">
          <DialogHeader className="space-y-1 text-left">
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              Parcelas, datas de pagamento e — no cartão — fatura e vencimento.
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="space-y-5 px-4 py-4 sm:px-6 sm:py-5">
          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Carregando...
            </div>
          )}
          {isError && <p className="text-sm text-destructive">Não foi possível carregar os detalhes.</p>}
          {data && (
            <>
              <div className="space-y-3">
                <div>
                  <p className="text-lg font-semibold leading-snug text-foreground">{data.title}</p>
                  {data.description ? (
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{data.description}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {data.categoryName ? (
                    <Badge variant="secondary">{data.categoryName}</Badge>
                  ) : (
                    <Badge variant="outline" className="font-normal text-muted-foreground">
                      Sem categoria
                    </Badge>
                  )}
                  {data.paymentSourceType === "card" && data.cardName ? (
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2.5 py-1 text-xs font-medium text-foreground">
                      <CreditCard className="h-3.5 w-3.5" />
                      {data.cardName}
                    </span>
                  ) : null}
                  {data.paymentSourceType === "account" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2.5 py-1 text-xs font-medium text-foreground">
                      <Landmark className="h-3.5 w-3.5" />
                      Conta corrente
                    </span>
                  ) : null}
                  {data.paymentSourceType === "pocket" && data.pocketName ? (
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2.5 py-1 text-xs font-medium text-foreground">
                      <PiggyBank className="h-3.5 w-3.5" />
                      {data.pocketName}
                    </span>
                  ) : null}
                  {data.paymentSourceType === "pocket" && !data.pocketName ? (
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2.5 py-1 text-xs font-medium text-foreground">
                      <PiggyBank className="h-3.5 w-3.5" />
                      Caixinha
                    </span>
                  ) : null}
                </div>
              </div>

              {data.paymentSourceType === "card" && data.closingDay != null && data.dueDay != null ? (
                <p className="rounded-lg border border-border bg-muted/30 px-3.5 py-3 text-sm leading-relaxed text-muted-foreground">
                  Fechamento no dia <span className="font-medium text-foreground">{data.closingDay}</span> · vencimento
                  no dia <span className="font-medium text-foreground">{data.dueDay}</span> do{" "}
                  <span className="font-medium text-foreground">mesmo mês</span> da fatura. Compras a partir do dia do
                  fechamento entram na fatura do mês seguinte.
                </p>
              ) : null}

              {data.paymentSourceType !== "card" && data.installments && data.installments.length > 1 ? (
                <p className="rounded-lg border border-border bg-muted/30 px-3.5 py-3 text-sm leading-relaxed text-muted-foreground">
                  Cada parcela debita a conta ou caixinha na data indicada (um lançamento por mês).
                </p>
              ) : null}

              <div>
                <p className="mb-2.5 text-sm font-semibold text-foreground">{data.installments.length > 1 ? "Parcelas" : "Lançamento"}</p>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/50 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        <th className="px-3 py-2.5">#</th>
                        <th className="px-3 py-2.5">Valor</th>
                        <th className="px-3 py-2.5">Data</th>
                        {data.paymentSourceType === "card" ? (
                          <>
                            <th className="px-3 py-2.5">Fatura</th>
                            <th className="px-3 py-2.5">Vencimento</th>
                          </>
                        ) : (
                          <th className="px-3 py-2.5">Mês de referência</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {data.installments.map((row) => (
                        <tr key={row.id} className={row.id === data.id ? "bg-primary/5" : undefined}>
                          <td className="px-3 py-2.5 tabular-nums text-foreground">
                            {row.installmentNumber}/{row.installmentCount}
                          </td>
                          <td className="px-3 py-2.5 font-medium tabular-nums text-foreground">{formatCurrency(row.amount)}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">{formatDisplayDate(row.purchaseDate)}</td>
                          {data.paymentSourceType === "card" ? (
                            <>
                              <td className="px-3 py-2.5 text-muted-foreground">
                                {row.statementMonth ? formatYearMonthLabel(row.statementMonth) : "—"}
                              </td>
                              <td className="px-3 py-2.5 text-muted-foreground">
                                {row.dueDate ? formatDisplayDate(row.dueDate) : "—"}
                              </td>
                            </>
                          ) : (
                            <td className="px-3 py-2.5 text-muted-foreground">{formatCalendarMonthLabel(row.purchaseDate)}</td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <DialogFooter className="flex-col gap-2 border-t border-border px-0 pb-0 pt-4 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" className="gap-2" onClick={handleEdit}>
                  <Pencil className="h-4 w-4" />
                  Editar
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  className="gap-2"
                  onClick={() => setConfirmDeleteOpen(true)}
                >
                  <Trash2 className="h-4 w-4" />
                  Excluir
                </Button>
              </DialogFooter>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Excluir esta despesa?</DialogTitle>
          <DialogDescription>
            Todas as parcelas deste lançamento serão removidas. Lançamentos em conta ou caixinha serão estornados do
            histórico. Esta ação não pode ser desfeita.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-end">
          <Button type="button" variant="outline" onClick={() => setConfirmDeleteOpen(false)}>
            Cancelar
          </Button>
          <Button type="button" variant="destructive" disabled={deletePurchase.isPending} onClick={handleDelete}>
            {deletePurchase.isPending ? "Excluindo…" : "Excluir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
