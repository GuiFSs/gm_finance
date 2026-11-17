"use client";

import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";

import type { MonthlyBudgetPayload } from "@/entities/budget/model";
import { yearMonthParams } from "@/features/dashboard/period-model";
import type { MonthMovementRow } from "@/shared/hooks/use-app-data";
import { fetcher } from "@/shared/lib/fetcher";

export function useYearMovements(year: number, enabled: boolean) {
  const months = useMemo(() => yearMonthParams(year), [year]);
  return useQueries({
    queries: months.map((month) => ({
      queryKey: ["movements", month] as const,
      enabled,
      queryFn: () => fetcher<{ data: MonthMovementRow[] }>(`/api/movements?month=${month}`),
    })),
  });
}

export function useYearBudgets(year: number, enabled: boolean) {
  const months = useMemo(() => yearMonthParams(year), [year]);
  return useQueries({
    queries: months.map((month) => ({
      queryKey: ["budgets", month] as const,
      enabled,
      queryFn: () =>
        fetcher<{ data: MonthlyBudgetPayload }>(`/api/budgets?month=${encodeURIComponent(month)}`),
    })),
  });
}
