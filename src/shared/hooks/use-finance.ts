"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetcher } from "@/shared/lib/fetcher";

export function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: () => fetcher<{ data: DashboardData }>("/api/dashboard"),
    select: (response) => response.data,
  });
}

type MonthMovementRow = {
  id: string;
  type: "in" | "out" | "future_out";
  date: string;
  title: string;
  amount: number;
  category?: string | null;
  source?: string | null;
  sourceType?: "account" | "pocket" | "card";
  sourceId?: string | null;
  extra?: string | null;
};

type SourcesSummaryRow = {
  account?: { balance: number; outflows: number; sufficient: boolean };
  pockets: Array<{ id: string; name: string; balance: number; outflows: number; sufficient: boolean }>;
  cards: Array<{ id: string; name: string; creditLimit: number; used: number; outflows: number; sufficient: boolean }>;
};

export function useMonthMovements(month?: string) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const monthParam = month ?? `${y}-${String(m).padStart(2, "0")}`;
  return useQuery({
    queryKey: ["movements", monthParam],
    queryFn: () =>
      fetcher<{ data: MonthMovementRow[]; sourcesSummary: SourcesSummaryRow }>(
        `/api/movements?month=${monthParam}`
      ),
    select: (response) => ({ data: response.data, sourcesSummary: response.sourcesSummary }),
  });
}

export function usePurchases(filters: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => value && params.set(key, value));
  return useQuery({
    queryKey: ["purchases", filters],
    queryFn: () => fetcher<{ data: PurchaseRow[] }>(`/api/purchases?${params.toString()}`),
    select: (response) => response.data,
  });
}

export function useCreatePurchase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      fetcher("/api/purchases", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function usePockets() {
  return useQuery({
    queryKey: ["pockets"],
    queryFn: () => fetcher<{ data: PocketRow[] }>("/api/pockets"),
    select: (response) => response.data,
  });
}

export function useCreatePocket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      fetcher("/api/pockets", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pockets"] }),
  });
}

export function useUpdatePocket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { id: string; name: string; description?: string | null }) =>
      fetcher(`/api/pockets/${payload.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: payload.name, description: payload.description }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pockets"] }),
  });
}

export function useTransferToPocket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      fetcher("/api/pockets/transfer", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pockets"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useCards() {
  return useQuery({
    queryKey: ["cards"],
    queryFn: () => fetcher<{ data: CardRow[] }>("/api/cards"),
    select: (response) => response.data,
  });
}

export function useCreateCard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      fetcher("/api/cards", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cards"] }),
  });
}

export function useUpdateCard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      id: string;
      name: string;
      creditLimit: number;
      closingDay: number;
      dueDay: number;
    }) =>
      fetcher(`/api/cards/${payload.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: payload.name,
          creditLimit: payload.creditLimit,
          closingDay: payload.closingDay,
          dueDay: payload.dueDay,
        }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cards"] }),
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: () => fetcher<{ data: NamedEntity[] }>("/api/categories"),
    select: (response) => response.data,
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      fetcher("/api/categories", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["categories"] }),
  });
}

export function useTags() {
  return useQuery({
    queryKey: ["tags"],
    queryFn: () => fetcher<{ data: NamedEntity[] }>("/api/tags"),
    select: (response) => response.data,
  });
}

export function useCreateTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      fetcher("/api/tags", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tags"] }),
  });
}

export function useRecurring() {
  return useQuery({
    queryKey: ["recurring"],
    queryFn: () => fetcher<{ data: RecurringRow[] }>("/api/recurring"),
    select: (response) => response.data,
  });
}

export function useCreateRecurring() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      fetcher("/api/recurring", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["recurring"] }),
  });
}

export function useUpdateRecurring() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { id: string; title: string; amount: number; nextExecutionDate: string; paymentSourceType: string; paymentSourceId?: string }) =>
      fetcher(`/api/recurring/${payload.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: payload.title,
          amount: payload.amount,
          nextExecutionDate: payload.nextExecutionDate,
          paymentSourceType: payload.paymentSourceType,
          paymentSourceId: payload.paymentSourceId || undefined,
        }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["recurring"] }),
  });
}

export function useDeleteRecurring() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetcher(`/api/recurring/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["recurring"] }),
  });
}

export function useRunRecurring() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => fetcher("/api/recurring/run", { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring"] });
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useGoals() {
  return useQuery({
    queryKey: ["goals"],
    queryFn: () => fetcher<{ data: GoalRow[] }>("/api/goals"),
    select: (response) => response.data,
  });
}

export function useCreateGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      fetcher("/api/goals", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["goals"] }),
  });
}

export function useDeposits() {
  return useQuery({
    queryKey: ["deposits"],
    queryFn: () => fetcher<{ data: DepositRow[] }>("/api/deposits"),
    select: (response) => response.data,
  });
}

export function useCreateDeposit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      fetcher("/api/deposits", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deposits"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useCreateAdjustment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      fetcher("/api/adjustments", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["pockets"] });
    },
  });
}

type NamedEntity = { id: string; name: string };
type PurchaseRow = {
  id: string;
  title: string;
  amount: number;
  purchaseDate: string;
  categoryName: string | null;
  userName: string | null;
  paymentSourceType: "account" | "pocket" | "card";
  installmentNumber: number;
  installmentCount: number;
  tags: string[];
  tagIds?: string[];
};
type PocketRow = { id: string; name: string; description: string | null; balance: number };
type CardRow = {
  id: string;
  name: string;
  creditLimit: number;
  closingDay: number;
  dueDay: number;
  usedLimit: number;
};
type RecurringRow = {
  id: string;
  title: string;
  amount: number;
  nextExecutionDate: string;
  paymentSourceType: string;
};
type GoalRow = {
  id: string;
  title: string;
  targetAmount: number;
  pocketId: string;
  pocketName: string;
  deadline: string | null;
  progressAmount: number;
};
type DepositRow = {
  id: string;
  title: string;
  amount: number;
  depositDate: string;
};
type DashboardData = {
  totalBalance: number;
  checkingBalance: number;
  monthlyExpenses: number;
  pocketBalances: PocketRow[];
  expensesByCategory: Array<{ name: string; total: number }>;
  balanceEvolution: Array<{ date: string; balance: number }>;
  biggestExpenses: Array<{ title: string; amount: number; purchaseDate: string }>;
  upcomingInstallments: Array<{
    title: string;
    amount: number;
    installmentNumber: number;
    installmentCount: number;
    purchaseDate: string;
    cardName: string | null;
  }>;
  upcomingRecurring: Array<{ title: string; amount: number; nextExecutionDate: string }>;
  cardUsage: Array<{ cardId: string; cardName: string; creditLimit: number; used: number }>;
};
