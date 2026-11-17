"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";

import { monthLabel } from "./month-model";

export type TileTone = "out" | "open" | "open-later" | "forecast" | "in" | "forecast-in" | "neutral";

const TILE_TONE: Record<TileTone, string> = {
  out: "bg-plane-out text-white",
  open: "bg-plane-open text-[#141414]",
  "open-later": "border-2 border-plane-open text-foreground",
  forecast: "border-2 border-plane-out text-foreground",
  in: "bg-plane-in text-white",
  "forecast-in": "border-2 border-plane-in text-foreground",
  neutral: "border border-input text-foreground",
};

/** Quadrado com o dia: o plano da linha. A cor segue a legenda do mês. */
export function DayTile({ day, tone, className }: { day: string; tone: TileTone; className?: string }) {
  return (
    <span
      className={cn(
        "grid size-10 shrink-0 place-items-center text-[15px] font-bold leading-none tabular-nums",
        TILE_TONE[tone],
        className,
      )}
      aria-hidden
    >
      {day}
    </span>
  );
}

export function LedgerRow({
  tile,
  title,
  meta,
  amount,
  action,
  onOpen,
  openLabel,
}: {
  tile: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  amount: ReactNode;
  action?: ReactNode;
  onOpen?: () => void;
  openLabel?: string;
}) {
  const body = (
    <>
      {tile}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium leading-snug text-foreground">{title}</span>
        {meta ? <span className="block truncate text-[15px] leading-snug text-muted-foreground">{meta}</span> : null}
      </span>
      <span className="shrink-0 text-right text-[15px] font-medium tabular-nums text-foreground">{amount}</span>
    </>
  );
  return (
    <div className="flex items-center gap-3 border-t border-border py-3 first:border-t-0">
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          aria-label={openLabel}
          className="-my-1 flex min-w-0 flex-1 items-center gap-3 py-1 text-left transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {body}
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3">{body}</div>
      )}
      {action ? <div className="flex shrink-0 items-center">{action}</div> : null}
    </div>
  );
}

export function PaidCheck({
  paid,
  pending,
  onToggle,
  label,
}: {
  paid: boolean;
  pending?: boolean;
  onToggle: (next: boolean) => void;
  label: string;
}) {
  return (
    <label className="-m-2 grid size-11 cursor-pointer place-items-center" onClick={(e) => e.stopPropagation()}>
      <Checkbox
        checked={paid}
        disabled={pending}
        onCheckedChange={(c) => {
          if (c === "indeterminate") return;
          onToggle(c === true);
        }}
        aria-label={paid ? `Desmarcar ${label} como pago` : `Marcar ${label} como pago`}
        className="size-6 border-2 border-foreground data-[state=checked]:border-plane-out data-[state=checked]:bg-plane-out data-[state=checked]:text-white [&_svg]:size-4"
      />
    </label>
  );
}

export function MonthSwitcher({
  month,
  onChange,
  min,
  max,
}: {
  month: string;
  onChange: (next: string) => void;
  min?: string;
  max?: string;
}) {
  const [y, m] = month.split("-").map(Number);
  const shift = (delta: number) => {
    const d = new Date(y, m - 1 + delta, 1);
    onChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };
  return (
    <div className="flex items-center">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-10"
        onClick={() => shift(-1)}
        disabled={min ? month <= min : false}
        aria-label="Mês anterior"
      >
        <ChevronLeft />
      </Button>
      <span className="min-w-[7.5rem] text-center text-[15px] font-medium text-foreground">{monthLabel(month)}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-10"
        onClick={() => shift(1)}
        disabled={max ? month >= max : false}
        aria-label="Próximo mês"
      >
        <ChevronRight />
      </Button>
    </div>
  );
}

export function SectionHeading({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 pb-1 pt-8">
      <h2 className="text-2xl font-bold lowercase leading-tight tracking-tight text-foreground">{children}</h2>
      {aside ? <div className="shrink-0 text-[15px] text-muted-foreground">{aside}</div> : null}
    </div>
  );
}
