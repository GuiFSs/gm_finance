"use client";

import * as React from "react";

import { cn } from "@/shared/lib/cn";
import { formatBRLForInput } from "@/shared/utils/formatters";

import { Input } from "@/shared/ui/input";

/**
 * Modo centavos: o usuário digita apenas dígitos (e opcionalmente -).
 * O valor é interpretado como centavos (ex.: 123 → R$ 1,23), formatando desde o primeiro dígito.
 */
function digitsToReais(str: string, allowNegative: boolean): number {
  let s = str.replace(/\s/g, "").replace(/R\$/g, "").replace(/[,.]/g, "");
  const isNegative = allowNegative && s.startsWith("-");
  if (isNegative) s = s.slice(1);
  const digits = s.replace(/\D/g, "");
  const centavos = digits === "" ? 0 : Number.parseInt(digits, 10);
  const reais = centavos / 100;
  return isNegative ? -reais : reais;
}

export type CurrencyInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "value" | "onChange" | "type"
> & {
  value: number;
  onChange: (value: number) => void;
  allowNegative?: boolean;
};

const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onChange, allowNegative = false, className, id, ...props }, ref) => {
    const [displayStr, setDisplayStr] = React.useState(() => formatBRLForInput(value));
    const isFocusedRef = React.useRef(false);

    React.useEffect(() => {
      if (!isFocusedRef.current) {
        setDisplayStr(formatBRLForInput(value));
      }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      const reais = digitsToReais(raw, allowNegative);
      onChange(reais);
      setDisplayStr(formatBRLForInput(reais));
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      isFocusedRef.current = true;
      props.onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      isFocusedRef.current = false;
      setDisplayStr(formatBRLForInput(value));
      props.onBlur?.(e);
    };

    return (
      <Input
        ref={ref}
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        className={cn("tabular-nums", className)}
        value={displayStr}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={props.placeholder ?? "R$ 0,00"}
        {...props}
      />
    );
  }
);
CurrencyInput.displayName = "CurrencyInput";

export { CurrencyInput };
