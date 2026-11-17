"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import { useSetCardStatementPaid, useSetPurchasePaid, type MonthMovementRow } from "@/shared/hooks/use-app-data";

import { DayTile, LedgerRow, PaidCheck } from "./ledger";
import { dayOfMonth, daysFromToday, dueWord, formatAmount, openItems, type OpenItem } from "./month-model";

/**
 * Compromissos em aberto com o check de pago.
 * Um item marcado continua na lista (riscado no plano vermelho) até a tela ser recarregada,
 * para a mudança ser vista e poder ser desfeita.
 */
export function OpenItemsList({
  list,
  month,
  todayStr,
  limit,
  onOpenPurchase,
  emptyText,
}: {
  list: MonthMovementRow[] | undefined;
  month: string;
  todayStr: string;
  limit?: number;
  onOpenPurchase?: (purchaseId: string) => void;
  emptyText: string;
}) {
  const setPurchasePaid = useSetPurchasePaid();
  const setStatementPaid = useSetCardStatementPaid();
  const [settled, setSettled] = useState<Record<string, OpenItem>>({});

  const items = useMemo(() => {
    const open = openItems(list, month);
    const openKeys = new Set(open.map((i) => i.key));
    const kept = Object.values(settled).filter((i) => !openKeys.has(i.key));
    return [...open, ...kept].sort((a, b) => a.date.localeCompare(b.date));
  }, [list, month, settled]);

  const visible = limit ? items.slice(0, limit) : items;

  function toggle(item: OpenItem, paid: boolean) {
    setSettled((prev) => {
      const next = { ...prev };
      if (paid) next[item.key] = item;
      else delete next[item.key];
      return next;
    });
    const onError = (error: unknown) => {
      setSettled((prev) => {
        const next = { ...prev };
        delete next[item.key];
        return next;
      });
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar o pagamento");
    };
    if (item.kind === "purchase") {
      setPurchasePaid.mutate({ purchaseId: item.purchaseId, paid }, { onError });
    } else {
      setStatementPaid.mutate({ cardId: item.cardId, statementMonth: item.statementMonth, paid }, { onError });
    }
  }

  if (items.length === 0) {
    return <p className="border-t border-border py-6 text-[15px] text-muted-foreground">{emptyText}</p>;
  }

  return (
    <div>
      {visible.map((item) => {
        const isPaid = Boolean(settled[item.key]);
        const diff = daysFromToday(item.date, todayStr);
        const pending =
          item.kind === "purchase"
            ? setPurchasePaid.isPending && setPurchasePaid.variables?.purchaseId === item.purchaseId
            : setStatementPaid.isPending && setStatementPaid.variables?.cardId === item.cardId;
        const word = isPaid ? "pago agora" : dueWord(item.date, todayStr);
        const meta =
          item.kind === "purchase"
            ? [word, item.source, item.installment].filter(Boolean).join(" · ")
            : [word, `${item.count} ${item.count === 1 ? "compra" : "compras"}`].join(" · ");
        return (
          <LedgerRow
            key={item.key}
            tile={<DayTile day={dayOfMonth(item.date)} tone={isPaid ? "out" : diff <= 2 ? "open" : "open-later"} />}
            title={<span className={isPaid ? "text-muted-foreground line-through decoration-1" : undefined}>{item.title}</span>}
            meta={<span className={!isPaid && diff <= 0 ? "text-ink-open" : undefined}>{meta}</span>}
            amount={formatAmount(item.amount, "−")}
            onOpen={item.kind === "purchase" && onOpenPurchase ? () => onOpenPurchase(item.purchaseId) : undefined}
            openLabel={`Ver ${item.title}`}
            action={
              <PaidCheck
                paid={isPaid}
                pending={pending}
                label={item.title}
                onToggle={(next) => toggle(item, next)}
              />
            }
          />
        );
      })}
    </div>
  );
}

export function openItemsCount(list: MonthMovementRow[] | undefined, month: string) {
  const items = openItems(list, month);
  return { count: items.length, total: items.reduce((s, i) => s + i.amount, 0) };
}
