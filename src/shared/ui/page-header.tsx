import * as React from "react";

import { cn } from "@/shared/lib/cn";

type PageHeaderProps = {
  title: string;
  actions?: React.ReactNode;
  className?: string;
};

export function PageHeader({ title, actions, className }: PageHeaderProps) {
  return (
    <header className={cn("flex min-h-10 items-center justify-between gap-3", className)}>
      <h1 className="text-2xl font-bold lowercase leading-none tracking-tight text-foreground">{title}</h1>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/** Rótulo e campo empilhados com o respiro do formulário. */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: {
  label: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-[15px] leading-none text-muted-foreground">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-[15px] text-ink-out">{error}</p>
      ) : hint ? (
        <p className="text-[15px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/** Rodapé de formulário em modal: ação destrutiva à esquerda, cancelar e salvar à direita. */
export function FormActions({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="order-2 flex sm:order-1">{aside}</div>
      <div className="order-1 grid auto-cols-fr grid-flow-col gap-2 sm:order-2 sm:flex">{children}</div>
    </div>
  );
}
