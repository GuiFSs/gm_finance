"use client";

import { cn } from "@/shared/lib/cn";

import { formatAmount, type MonthStatus, type MonthTotals } from "./month-model";

type Segment = {
  key: MonthStatus | "sobra";
  label: string;
  value: number;
  plane: string;
  marker: string;
};

/**
 * A assinatura do app: o mês como composição de planos.
 * Largura de cada plano = valor. Com sobra, o total é o que entrou; com falta, o total é o que saiu.
 */
export function MonthPlane({
  totals,
  active,
  onSelect,
  className,
  size = "lg",
}: {
  totals: MonthTotals;
  active?: MonthStatus | null;
  onSelect?: (status: MonthStatus | null) => void;
  className?: string;
  size?: "lg" | "md";
}) {
  const deficit = totals.sobra < 0;
  const segments: Segment[] = [
    { key: "pago", label: "pago", value: totals.pago, plane: "bg-plane-out", marker: "bg-plane-out" },
    { key: "aberto", label: "em aberto", value: totals.aberto, plane: "bg-plane-open", marker: "bg-plane-open" },
    {
      key: "previsto",
      label: "previsto",
      value: totals.previsto,
      plane: "border-2 border-plane-out bg-transparent",
      marker: "border-2 border-plane-out",
    },
    {
      key: "sobra",
      label: deficit ? "falta" : "sobra",
      value: Math.abs(totals.sobra),
      plane: deficit
        ? "bg-[repeating-linear-gradient(135deg,var(--plane-out)_0_2px,transparent_2px_8px)]"
        : "bg-plane-in",
      marker: deficit ? "bg-[repeating-linear-gradient(135deg,var(--plane-out)_0_2px,transparent_2px_5px)]" : "bg-plane-in",
    },
  ];
  const empty = totals.entradas === 0 && totals.saidas === 0;
  const dim = (key: Segment["key"]) => Boolean(active) && active !== key && !(active === "entradas" && key === "sobra");

  return (
    <div className={cn("space-y-3", className)}>
      <div
        className={cn("flex w-full gap-[3px]", size === "lg" ? "h-16" : "h-12")}
        role={onSelect ? undefined : "img"}
        aria-label={`Mês: pago ${formatAmount(totals.pago)}, em aberto ${formatAmount(totals.aberto)}, previsto ${formatAmount(totals.previsto)}, ${deficit ? "falta" : "sobra"} ${formatAmount(Math.abs(totals.sobra))}`}
      >
        {empty ? (
          <div className="h-full flex-1 border border-dashed border-input" />
        ) : (
          <div className="relative flex h-full flex-1 gap-[3px]">
            {segments
              .filter((s) => s.value > 0.004 && !(deficit && s.key === "sobra"))
              .map((s) => {
                const filterKey: MonthStatus = s.key === "sobra" ? "entradas" : s.key;
                const cls = cn("plane-segment h-full min-w-[6px]", s.plane, dim(s.key) && "opacity-25");
                const style = { flexGrow: s.value, flexBasis: 0 };
                return onSelect ? (
                  <button
                    key={s.key}
                    type="button"
                    tabIndex={-1}
                    aria-hidden
                    onClick={() => onSelect(active === filterKey ? null : filterKey)}
                    className={cn(cls, "cursor-pointer hover:brightness-110")}
                    style={style}
                  />
                ) : (
                  <div key={s.key} className={cls} style={style} />
                );
              })}
            {deficit && totals.saidas > 0 ? (
              <div
                className="pointer-events-none absolute inset-y-0 right-0 border-l-2 border-foreground bg-[repeating-linear-gradient(135deg,#141414_0_3px,transparent_3px_9px)]"
                style={{ width: `${Math.min(100, (Math.abs(totals.sobra) / totals.saidas) * 100)}%` }}
              />
            ) : null}
          </div>
        )}
      </div>
      <ul className="grid grid-cols-2 gap-x-6 gap-y-1">
        {segments.map((s) => {
          const filterKey: MonthStatus | null = s.key === "sobra" ? "entradas" : s.key;
          const isActive = active != null && active === filterKey;
          const content = (
            <>
              <span className={cn("size-2.5 shrink-0", s.marker)} aria-hidden />
              <span className={cn("text-muted-foreground", isActive && "text-foreground")}>{s.label}</span>
              {s.key === "sobra" ? null : (
                <span className="ml-auto font-medium tabular-nums text-foreground">{formatAmount(s.value)}</span>
              )}
            </>
          );
          return (
            <li key={s.key}>
              {onSelect ? (
                <button
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => onSelect(isActive ? null : filterKey)}
                  className={cn(
                    "-mx-1.5 flex w-[calc(100%+0.75rem)] items-center gap-2 px-1.5 py-1.5 text-[15px] transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                    isActive && "bg-accent",
                  )}
                >
                  {content}
                </button>
              ) : (
                <div className="flex items-center gap-2 py-1.5 text-[15px]">{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
