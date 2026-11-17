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

/** O número que responde a tela: rótulo a lápis, valor em 48px, uma linha de apoio. */
export function AnswerFigure({
  label,
  value,
  negative,
  meta,
  loading,
}: {
  label: ReactNode;
  value: string;
  negative?: boolean;
  meta?: ReactNode;
  loading?: boolean;
}) {
  return (
    <div>
      <p className="text-[15px] font-medium lowercase text-muted-foreground">{label}</p>
      {loading ? (
        <>
          <p className="mt-1 h-12 w-44 animate-pulse bg-muted" aria-label="Carregando" />
          {meta !== undefined ? <p className="mt-2 h-5 w-40 animate-pulse bg-muted" /> : null}
        </>
      ) : (
        <>
          <p className={cn("mt-1 text-[48px] font-bold leading-none tracking-[-0.03em] tabular-nums", negative && "text-ink-out")}>
            <span className="mr-1.5 text-2xl font-medium tracking-normal">{negative ? "−R$" : "R$"}</span>
            {value}
          </p>
          {meta ? <p className="mt-2 text-[15px] text-muted-foreground tabular-nums">{meta}</p> : null}
        </>
      )}
    </div>
  );
}

/** Grupo com título de 24px, total à direita e a régua de 2px sobre as linhas. */
export function LedgerGroup({
  title,
  aside,
  meta,
  children,
  className,
}: {
  title: ReactNode;
  aside?: ReactNode;
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("pt-8", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="min-w-0 truncate text-2xl font-bold leading-tight tracking-tight text-foreground">{title}</h2>
        {aside ? <span className="shrink-0 text-[15px] font-medium tabular-nums text-foreground">{aside}</span> : null}
      </div>
      {meta ? <p className="mt-0.5 text-[15px] text-muted-foreground">{meta}</p> : null}
      <div className="mt-2 border-t-2 border-foreground">{children}</div>
    </section>
  );
}

export function LedgerSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3 pt-6" aria-label="Carregando">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-12 animate-pulse bg-muted" />
      ))}
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
