"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { useDeletePurchase, usePurchaseDetail } from "@/shared/hooks/use-app-data";
import { DayTile, LedgerRow, LedgerSkeleton } from "@/features/month/ledger";
import { dayOfMonth, formatAmount } from "@/features/month/month-model";
import { formatDisplayDate } from "@/shared/utils/formatters";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

const SHORT_MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function shortMonth(yyyyMm: string): string {
  const [year, month] = yyyyMm.split("-");
  return `${SHORT_MONTHS[Number(month) - 1] ?? month}/${year?.slice(2)}`;
}

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

  const source =
    data?.paymentSourceType === "card"
      ? `cartão ${data.cardName ?? ""}`.trim()
      : data?.paymentSourceType === "pocket"
        ? (data.pocketName ?? "caixinha")
        : "conta corrente";
  const isCard = data?.paymentSourceType === "card";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90dvh] w-[calc(100vw-1rem)] max-w-2xl gap-0 overflow-y-auto p-0 sm:w-full">
          <DialogHeader className="space-y-0 px-5 pb-0 pt-5 text-left sm:px-6">
            <DialogTitle className={data ? "pr-8 normal-case" : "pr-8"}>{data?.title ?? title}</DialogTitle>
            <DialogDescription className="sr-only">Parcelas, datas e fonte de pagamento.</DialogDescription>
          </DialogHeader>
          <div className="px-5 pb-5 pt-4 sm:px-6">
            {isLoading ? <LedgerSkeleton rows={3} /> : null}
            {isError ? <p className="py-6 text-[15px] text-ink-out">Não foi possível carregar os detalhes.</p> : null}
            {data ? (
              <>
                <p className="text-2xl font-bold tabular-nums text-foreground">{formatAmount(data.totalAmount, "−")}</p>
                <p className="mt-1 text-[15px] text-muted-foreground">
                  {[data.categoryName ?? "sem categoria", source, isCard && data.closingDay != null && data.dueDay != null
                    ? `fecha dia ${data.closingDay} · vence dia ${data.dueDay}`
                    : null]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {data.description ? <p className="mt-3 text-[15px] text-foreground">{data.description}</p> : null}

                <h3 className="mt-6 border-b-2 border-foreground pb-1.5 text-[15px] font-bold lowercase text-foreground">
                  {data.installments.length > 1 ? `${data.installments.length} parcelas` : "lançamento"}
                </h3>
                {isCard ? (
                  <p className="pt-2 text-[15px] text-muted-foreground">Depois do fechamento, a compra vai para a fatura seguinte.</p>
                ) : null}
                <div>
                  {data.installments.map((row) => (
                    <div key={row.id} className={row.id === data.id ? "bg-accent/60" : undefined}>
                      <LedgerRow
                        tile={<DayTile day={dayOfMonth(row.purchaseDate)} tone="neutral" />}
                        title={
                          row.installmentCount > 1 ? `${row.installmentNumber}/${row.installmentCount}` : formatDisplayDate(row.purchaseDate)
                        }
                        meta={
                          isCard
                            ? [
                                row.statementMonth ? `fatura ${shortMonth(row.statementMonth)}` : null,
                                row.dueDate ? `vence ${formatDisplayDate(row.dueDate).slice(0, 5)}` : null,
                              ]
                                .filter(Boolean)
                                .join(" · ") || null
                            : row.installmentCount > 1
                              ? `debita ${formatDisplayDate(row.purchaseDate)}`
                              : null
                        }
                        amount={formatAmount(row.amount, "−")}
                      />
                    </div>
                  ))}
                </div>

                <DialogFooter className="mt-4 flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-between sm:space-x-0">
                  <Button
                    type="button"
                    variant="ghost"
                    className="gap-2 text-ink-out hover:text-ink-out"
                    onClick={() => setConfirmDeleteOpen(true)}
                  >
                    <Trash2 aria-hidden />
                    excluir
                  </Button>
                  <Button type="button" className="gap-2" onClick={handleEdit}>
                    <Pencil aria-hidden />
                    editar
                  </Button>
                </DialogFooter>
              </>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-md">
          <DialogHeader className="text-left">
            <DialogTitle className="pr-8">excluir esta compra?</DialogTitle>
            <DialogDescription>
              Todas as parcelas saem. O que foi debitado da conta ou da caixinha volta. Não dá para desfazer.
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
