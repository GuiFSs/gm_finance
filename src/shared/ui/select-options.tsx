"use client";

import * as React from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";

export type SelectOption = {
  value: string;
  label: string;
};

/** Radix Select não aceita `value=""` em SelectItem; mapeamos para um token estável. */
const EMPTY_VALUE_TOKEN = "__select_empty_value__";

function toRadixValue(v: string | undefined | null): string | undefined {
  if (v === undefined || v === null) return undefined;
  return v === "" ? EMPTY_VALUE_TOKEN : v;
}

function fromRadixValue(v: string): string {
  return v === EMPTY_VALUE_TOKEN ? "" : v;
}

type SelectOptionsProps = Omit<
  React.ComponentPropsWithoutRef<typeof SelectTrigger>,
  "value" | "onChange"
> & {
  options: SelectOption[];
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
};

export function SelectOptions({
  options,
  value,
  onValueChange,
  placeholder = "Selecione...",
  className,
  ...props
}: SelectOptionsProps) {
  const emptyOption = options.find((o) => o.value === "");
  const resolvedPlaceholder = emptyOption?.label ?? placeholder;
  const radixValue = toRadixValue(value);

  return (
    <Select
      value={radixValue}
      onValueChange={(v) => onValueChange?.(fromRadixValue(v))}
    >
      <SelectTrigger className={className} {...props}>
        <SelectValue placeholder={resolvedPlaceholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option, index) => (
          <SelectItem
            key={option.value === "" ? `empty-${index}` : option.value}
            value={option.value === "" ? EMPTY_VALUE_TOKEN : option.value}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
