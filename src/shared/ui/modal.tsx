"use client";

import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { cn } from "@/shared/lib/cn";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
  /** max width: sm (max-w-sm), md (max-w-md), lg (max-w-lg), xl (max-w-xl), 2xl (max-w-2xl), 3xl (max-w-3xl) */
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";
};

const sizeClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
};

export function Modal({
  open,
  onClose,
  title,
  children,
  className,
  size = "md",
}: ModalProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className={cn(
          sizeClasses[size],
          "max-h-[90dvh] w-[calc(100%-1.5rem)] p-4 sm:w-full sm:p-6",
          className
        )}
      >
        <DialogHeader>
          <DialogTitle className="pr-6 text-left leading-snug">{title}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[calc(100dvh-12rem)] overflow-x-hidden overflow-y-auto">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}
