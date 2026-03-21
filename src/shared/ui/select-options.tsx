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
  const selectOptions = options.filter((option) => option.value !== "");

  return (
    <Select value={value || undefined} onValueChange={onValueChange}>
      <SelectTrigger className={className} {...props}>
        <SelectValue placeholder={resolvedPlaceholder} />
      </SelectTrigger>
      <SelectContent>
        {selectOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  );
}
