"use client";

import type { ReactNode } from "react";

import { cn } from "@/shared/lib/cn";

export const PLANE = {
  out: "bg-plane-out",
  open: "bg-plane-open",
  in: "bg-plane-in",
  forecast: "border-2 border-plane-out bg-transparent",
  "forecast-in": "border-2 border-plane-in bg-transparent",
  deficit: "bg-[repeating-linear-gradient(135deg,var(--plane-out)_0_2px,transparent_2px_8px)]",
} as const;

export const MARKER = {
  out: "bg-plane-out",
  open: "bg-plane-open",
  in: "bg-plane-in",
  forecast: "border-2 border-plane-out",
  "forecast-in": "border-2 border-plane-in",
  deficit: "bg-[repeating-linear-gradient(135deg,var(--plane-out)_0_2px,transparent_2px_5px)]",
} as const;

export type PlaneTone = keyof typeof PLANE;

export type PlaneSegment = {
  key: string;
  value: number;
  tone: PlaneTone;
  /** Parte preenchida dentro de um plano contornado (0–1), ex.: gasto dentro do planejado. */
  fill?: number;
  onSelect?: () => void;
  dim?: boolean;
};

/** Planos lado a lado: a largura de cada um é o valor. Sem valores, um retângulo tracejado. */
export function PlaneBar({
  segments,
  label,
  size = "md",
  className,
}: {
  segments: PlaneSegment[];
  label: string;
  size?: "lg" | "md" | "sm";
  className?: string;
}) {
  const visible = segments.filter((s) => s.value > 0.004);
  return (
    <div className={cn("flex w-full gap-[3px]", size === "lg" ? "h-16" : size === "sm" ? "h-4" : "h-12", className)} role="img" aria-label={label}>
      {visible.length === 0 ? (
        <div className="h-full flex-1 border border-dashed border-input" />
      ) : (
        visible.map((s) => {
          const cls = cn(
            "plane-segment relative h-full min-w-[6px] overflow-hidden",
            PLANE[s.tone],
            size === "sm" && (s.tone === "forecast" || s.tone === "forecast-in") && "border",
            s.dim && "opacity-25",
          );
          const style = { flexGrow: s.value, flexBasis: 0 };
          const fill =
            s.fill != null && s.fill > 0 ? (
              <span
                className={cn("absolute inset-y-0 left-0", s.fill > 1 ? PLANE.deficit : "bg-plane-out")}
                style={{ width: `${Math.min(1, s.fill) * 100}%` }}
                aria-hidden
              />
            ) : null;
          return s.onSelect ? (
            <button
              key={s.key}
              type="button"
              tabIndex={-1}
              aria-hidden
              onClick={s.onSelect}
              className={cn(cls, "cursor-pointer hover:brightness-110")}
              style={style}
            >
              {fill}
            </button>
          ) : (
            <div key={s.key} className={cls} style={style}>
              {fill}
            </div>
          );
        })
      )}
    </div>
  );
}

export type LegendItem = {
  key: string;
  label: ReactNode;
  tone: PlaneTone;
  amount?: ReactNode;
  /** Itens com valor zero somem, como os planos sem largura. */
  value?: number;
};

/** Legenda em duas colunas: marcador, rótulo a lápis, valor em tinta. */
export function PlaneLegend({ items: all, className }: { items: LegendItem[]; className?: string }) {
  const items = all.filter((item) => item.value == null || item.value > 0.004);
  return (
    <ul className={cn("grid gap-x-6 gap-y-1", items.length > 1 ? "grid-cols-2" : "grid-cols-1 max-w-sm", className)}>
      {items.map((item) => (
        <li key={item.key} className="flex min-w-0 items-center gap-2 py-1.5 text-[15px]">
          <span className={cn("size-2.5 shrink-0", MARKER[item.tone])} aria-hidden />
          <span className="min-w-0 truncate text-muted-foreground">{item.label}</span>
          {item.amount != null ? (
            <span className="ml-auto shrink-0 font-medium tabular-nums text-foreground">{item.amount}</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
