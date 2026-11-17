"use client";

import type { KeyboardEvent } from "react";

type Slice = {
  key: string;
  value: number;
  className?: string;
  fill?: string;
};

export function FlatPie({
  slices,
  label,
  onSelect,
}: {
  slices: Slice[];
  label: string;
  onSelect?: (key: string) => void;
}) {
  const drawn = slices.filter((slice) => slice.value > 0.004);
  const total = drawn.reduce((sum, slice) => sum + slice.value, 0);
  if (total <= 0) return null;

  const cx = 84;
  const cy = 84;
  const radius = 78;

  return (
    <svg viewBox="0 0 168 168" className="size-40 shrink-0" role="group" aria-label={label}>
      {drawn.length === 1 ? (
        <SliceShape
          d={undefined}
          circle={{ cx, cy, r: radius }}
          slice={drawn[0]}
          onSelect={onSelect}
        />
      ) : (
        drawn.map((slice, index) => {
          const start = drawn.slice(0, index).reduce((sum, item) => sum + item.value, 0) / total;
          const sweep = slice.value / total;
          return (
            <SliceShape
              key={slice.key}
              d={wedge(cx, cy, radius, start, sweep, drawn.length)}
              slice={slice}
              onSelect={onSelect}
            />
          );
        })
      )}
    </svg>
  );
}

function SliceShape({
  d,
  circle,
  slice,
  onSelect,
}: {
  d?: string;
  circle?: { cx: number; cy: number; r: number };
  slice: Slice;
  onSelect?: (key: string) => void;
}) {
  const interactive = Boolean(onSelect);
  const shared = {
    className: slice.className,
    style: fillStyle(slice.fill),
    onClick: interactive ? () => onSelect?.(slice.key) : undefined,
    onKeyDown: interactive
      ? (event: KeyboardEvent<SVGElement>) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          onSelect?.(slice.key);
        }
      : undefined,
    role: interactive ? "button" : undefined,
    tabIndex: interactive ? 0 : undefined,
    "aria-label": interactive ? slice.key : undefined,
    cursor: interactive ? "pointer" : undefined,
  };
  const className = [slice.className, interactive ? "cursor-pointer outline-none hover:brightness-110 focus-visible:outline focus-visible:outline-1 focus-visible:outline-ring" : ""]
    .filter(Boolean)
    .join(" ");
  if (circle) {
    return (
      <circle
        cx={circle.cx}
        cy={circle.cy}
        r={circle.r}
        className={className}
        style={shared.style}
        onClick={shared.onClick}
        onKeyDown={shared.onKeyDown}
        role={shared.role}
        tabIndex={shared.tabIndex}
        aria-label={shared["aria-label"]}
      />
    );
  }
  return (
    <path
      d={d}
      className={className}
      style={shared.style}
      onClick={shared.onClick}
      onKeyDown={shared.onKeyDown}
      role={shared.role}
      tabIndex={shared.tabIndex}
      aria-label={shared["aria-label"]}
    />
  );
}

function fillStyle(fill?: string): { fill: string } | undefined {
  return fill ? { fill } : undefined;
}

function wedge(cx: number, cy: number, radius: number, start: number, sweep: number, count: number): string {
  const gap = Math.min(0.05, (sweep * Math.PI * 2) * 0.22);
  const a0 = -Math.PI / 2 + start * Math.PI * 2 + (count > 1 ? gap / 2 : 0);
  const a1 = -Math.PI / 2 + (start + sweep) * Math.PI * 2 - (count > 1 ? gap / 2 : 0);
  const x0 = cx + radius * Math.cos(a0);
  const y0 = cy + radius * Math.sin(a0);
  const x1 = cx + radius * Math.cos(a1);
  const y1 = cy + radius * Math.sin(a1);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${x0} ${y0} A ${radius} ${radius} 0 ${large} 1 ${x1} ${y1} Z`;
}
