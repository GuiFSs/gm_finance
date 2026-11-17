"use client";

import {
  columnMagnitude,
  columnSummary,
  periodHasMovement,
  type PeriodColumn,
} from "@/features/dashboard/period-model";
import type { MonthTotals } from "@/features/month/month-model";

const EPS = 0.004;

export function PeriodColumns({
  label,
  columns,
  emptyText,
  onSelectMonth,
}: {
  label: string;
  columns: PeriodColumn[];
  emptyText: string;
  onSelectMonth?: (month: string) => void;
}) {
  const max = Math.max(0, ...columns.map((column) => columnMagnitude(column.totals)));
  const empty = !periodHasMovement(columns);
  const anyDeficit = columns.some((column) => column.totals.sobra < -EPS);

  return (
    <div>
      <ul className="flex h-40 items-end gap-[3px] border-b border-border md:h-56" aria-label={label}>
        {columns.map((column) => {
          const summary = columnSummary(column.label, column.totals);
          const bar = <ColumnBar totals={column.totals} max={max} />;
          return (
            <li key={column.key} className="flex h-full min-w-0 flex-1 items-end">
              {column.month && onSelectMonth ? (
                <button
                  type="button"
                  onClick={() => onSelectMonth(column.month!)}
                  aria-label={`${summary}. Abrir o mês.`}
                  className="group flex h-full w-full items-end focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {bar}
                </button>
              ) : (
                <div className="flex h-full w-full items-end" role="img" aria-label={summary}>
                  {bar}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <ul className="mt-2 flex gap-[3px]" aria-hidden>
        {columns.map((column) => (
          <li
            key={column.key}
            className="min-w-0 flex-1 truncate text-center text-[12px] leading-none text-muted-foreground"
          >
            {column.label}
          </li>
        ))}
      </ul>
      {empty ? (
        <p className="pt-4 text-[15px] text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="flex flex-wrap gap-x-6 gap-y-1 pt-3 text-[15px] text-muted-foreground">
          <li className="flex items-center gap-2">
            <span className="size-2.5 bg-plane-out" aria-hidden />
            sai
          </li>
          <li className="flex items-center gap-2">
            <span className="size-2.5 bg-plane-in" aria-hidden />
            sobra
          </li>
          {anyDeficit ? (
            <li className="flex items-center gap-2">
              <span
                className="size-2.5 bg-[repeating-linear-gradient(135deg,var(--plane-out)_0_2px,transparent_2px_5px)]"
                aria-hidden
              />
              falta
            </li>
          ) : null}
        </ul>
      )}
    </div>
  );
}

function ColumnBar({ totals, max }: { totals: MonthTotals; max: number }) {
  const magnitude = columnMagnitude(totals);
  if (magnitude <= EPS || max <= EPS) {
    return <span className="mb-px block h-3 w-full border border-dashed border-input" aria-hidden />;
  }

  const deficit = totals.sobra < -EPS;
  const height = `${(magnitude / max) * 100}%`;

  return (
    <span className="plane-column relative flex w-full flex-col gap-[3px]" style={{ height }} aria-hidden>
      {deficit ? (
        <span className="w-full flex-1 bg-plane-out group-hover:brightness-110" />
      ) : (
        <>
          {totals.sobra > EPS ? (
            <span
              className="plane-segment w-full bg-plane-in group-hover:brightness-110"
              style={{ flexGrow: totals.sobra, flexBasis: 0 }}
            />
          ) : null}
          {totals.saidas > EPS ? (
            <span
              className="plane-segment w-full bg-plane-out group-hover:brightness-110"
              style={{ flexGrow: totals.saidas, flexBasis: 0 }}
            />
          ) : null}
        </>
      )}
      {deficit && totals.saidas > EPS ? (
        <span
          className="pointer-events-none absolute inset-x-0 top-0 border-b-2 border-foreground bg-[repeating-linear-gradient(135deg,#141414_0_3px,transparent_3px_9px)]"
          style={{ height: `${Math.min(100, (Math.abs(totals.sobra) / totals.saidas) * 100)}%` }}
        />
      ) : null}
    </span>
  );
}
