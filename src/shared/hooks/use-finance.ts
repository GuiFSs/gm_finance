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

export type MonthMovementRow = {
  id: string;
  type: "in" | "out" | "future_out" | "future_in";
  date: string;
  title: string;
  amount: number;
  category?: string | null;
  source?: string | null;
  sourceType?: "account" | "pocket" | "card";
  sourceId?: string | null;
  extra?: string | null;
  purchaseId?: string;
  installmentNumber?: number;
  installmentCount?: number;
  statementMonth?: string;
  dueDate?: string | null;
  /** Plano de pagamento da fatura (conta + caixinhas), quando cadastrado para aquele mês de fatura. */
  cardFundingPlan?: string | null;
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

export type PurchaseDetailData = {
  id: string;
  title: string;
  description: string | null;
  categoryId: string | null;
  categoryName: string | null;
  paymentSourceType: string;
  paymentSourceId: string | null;
  cardName: string | null;
  pocketName: string | null;
  closingDay: number | null;
  dueDay: number | null;
  totalAmount: number;
  firstPurchaseDate: string;
  tagIds: string[];
  installments: Array<{
    id: string;
    purchaseDate: string;
    amount: number;
    installmentNumber: number;
    installmentCount: number;
    statementMonth: string | null;
    dueDate: string | null;
  }>;
};

export function usePurchaseDetail(purchaseId: string | null) {
  return useQuery({
    queryKey: ["purchase", purchaseId],
    queryFn: () => fetcher<{ data: PurchaseDetailData }>(`/api/purchases/${purchaseId}`),
    select: (response) => response.data,
    enabled: Boolean(purchaseId),
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
      queryClient.invalidateQueries({ queryKey: ["movements"] });
    },
  });
}

export function useUpdatePurchase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ purchaseId, ...body }: Record<string, unknown> & { purchaseId: string }) =>
      fetcher(`/api/purchases/${purchaseId}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["movements"] });
      queryClient.invalidateQueries({ queryKey: ["purchase", variables.purchaseId] });
    },
  });
}

export function useDeletePurchase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (purchaseId: string) =>
      fetcher<{ data: { success: boolean } }>(`/api/purchases/${purchaseId}`, { method: "DELETE" }),
    onSuccess: (_data, purchaseId) => {
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["movements"] });
      queryClient.removeQueries({ queryKey: ["purchase", purchaseId] });
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

export type CardStatementFundingMonthApi = {
  statementMonth: string;
  splits: Array<{
    id: string;
    targetType: "account" | "pocket";
    pocketId: string | null;
    pocketName: string | null;
    amount: number;
  }>;
};

function normalizeInvoiceTotal(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export type CardStatementInvoiceLineApi = {
  id: string;
  title: string;
  amount: number;
  purchaseDate: string;
  installmentNumber: number | null;
  installmentCount: number | null;
};

function normalizeInvoiceLines(value: unknown): CardStatementInvoiceLineApi[] | null {
  if (value === null || value === undefined) return null;
  if (!Array.isArray(value)) return null;
  return value.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: String(r.id ?? ""),
      title: String(r.title ?? ""),
      amount: (typeof r.amount === "number" ? r.amount : Number(r.amount)) || 0,
      purchaseDate: String(r.purchaseDate ?? ""),
      installmentNumber: r.installmentNumber == null ? null : Number(r.installmentNumber),
      installmentCount: r.installmentCount == null ? null : Number(r.installmentCount),
    };
  });
}

export function useCardStatementFunding(cardId: string | null, statementMonth?: string) {
  const monthKey = statementMonth?.trim() ?? "";
  return useQuery({
    queryKey: ["card-statement-funding", cardId, monthKey],
    queryFn: async ({ queryKey }) => {
      const [, id, sm] = queryKey as [string, string, string];
      const qs =
        sm && /^\d{4}-\d{2}$/.test(sm) ? `?statementMonth=${encodeURIComponent(sm)}` : "";
      const response = await fetcher<{
        data: CardStatementFundingMonthApi[];
        invoiceTotal: unknown;
        invoiceLines?: unknown;
      }>(`/api/cards/${id}/statement-funding${qs}`);
      return {
        plans: response.data,
        invoiceTotal: normalizeInvoiceTotal(response.invoiceTotal),
        invoiceLines: normalizeInvoiceLines(response.invoiceLines),
      };
    },
    enabled: Boolean(cardId),
  });
}

export function useReplaceCardStatementFunding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      cardId: string;
      statementMonth: string;
      splits: Array<{ targetType: "account" | "pocket"; pocketId?: string; amount: number }>;
    }) =>
      fetcher(`/api/cards/${payload.cardId}/statement-funding`, {
        method: "PUT",
        body: JSON.stringify({ statementMonth: payload.statementMonth, splits: payload.splits }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["card-statement-funding"] });
      queryClient.invalidateQueries({ queryKey: ["movements"] });
    },
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
      fetcher<{ data: NamedEntity }>("/api/categories", { method: "POST", body: JSON.stringify(payload) }),
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
    mutationFn: (payload: {
      id: string;
      title: string;
      amount: number;
      nextExecutionDate: string;
      paymentSourceType: string;
      paymentSourceId?: string;
      categoryId?: string;
      tagIds?: string[];
    }) =>
      fetcher(`/api/recurring/${payload.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: payload.title,
          amount: payload.amount,
          nextExecutionDate: payload.nextExecutionDate,
          paymentSourceType: payload.paymentSourceType,
          paymentSourceId: payload.paymentSourceId || undefined,
          categoryId: payload.categoryId || undefined,
          tagIds: payload.tagIds ?? [],
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
      queryClient.invalidateQueries({ queryKey: ["recurring-deposits"] });
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["deposits"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["movements"] });
      queryClient.invalidateQueries({ queryKey: ["pockets"] });
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
      queryClient.invalidateQueries({ queryKey: ["movements"] });
      queryClient.invalidateQueries({ queryKey: ["pockets"] });
      queryClient.invalidateQueries({ queryKey: ["goals"] });
    },
  });
}

export function useUpdateDeposit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown> & { id: string }) =>
      fetcher(`/api/deposits/${payload.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: payload.title,
          amount: payload.amount,
          depositDate: payload.depositDate,
          splits: payload.splits,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deposits"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["movements"] });
      queryClient.invalidateQueries({ queryKey: ["pockets"] });
      queryClient.invalidateQueries({ queryKey: ["goals"] });
    },
  });
}

export function useDeleteDeposit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fetcher(`/api/deposits/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deposits"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["movements"] });
      queryClient.invalidateQueries({ queryKey: ["pockets"] });
      queryClient.invalidateQueries({ queryKey: ["goals"] });
    },
  });
}

export function useRecurringDeposits() {
  return useQuery({
    queryKey: ["recurring-deposits"],
    queryFn: () => fetcher<{ data: RecurringDepositRow[] }>("/api/recurring-deposits"),
    select: (response) => response.data,
  });
}

export function useCreateRecurringDeposit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      fetcher("/api/recurring-deposits", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring-deposits"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useUpdateRecurringDeposit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      id: string;
      title: string;
      amount: number;
      nextExecutionDate: string;
      splits: Array<{ targetType: "account" | "pocket"; pocketId?: string; percent: number }>;
    }) =>
      fetcher(`/api/recurring-deposits/${payload.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: payload.title,
          amount: payload.amount,
          nextExecutionDate: payload.nextExecutionDate,
          splits: payload.splits,
        }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["recurring-deposits"] }),
  });
}

export function useDeleteRecurringDeposit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fetcher(`/api/recurring-deposits/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["recurring-deposits"] }),
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
export type PurchaseRow = {
  id: string;
  title: string;
  amount: number;
  purchaseDate: string;
  categoryName: string | null;
  userName: string | null;
  paymentSourceType: "account" | "pocket" | "card";
  paymentSourceId: string | null;
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
export type RecurringRow = {
  id: string;
  title: string;
  amount: number;
  nextExecutionDate: string;
  paymentSourceType: string;
  paymentSourceId: string | null;
  categoryId: string | null;
  categoryName: string | null;
  tags: Array<{ id: string; name: string }>;
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
export type DepositSplitRow = {
  id: string;
  targetType: "account" | "pocket";
  pocketId: string | null;
  pocketName: string | null;
  amount: number;
  sortOrder: number;
};

export type DepositRow = {
  id: string;
  title: string;
  amount: number;
  depositDate: string;
  recurringDepositId: string | null;
  createdByUserId: string;
  createdAt: number;
  splits: DepositSplitRow[];
};

export type RecurringDepositSplitRow = {
  id: string;
  targetType: "account" | "pocket";
  pocketId: string | null;
  pocketName: string | null;
  percent: number;
  sortOrder: number;
};

export type RecurringDepositRow = {
  id: string;
  title: string;
  amount: number;
  recurrenceType: string;
  nextExecutionDate: string;
  createdByUserId: string;
  isActive: boolean;
  splits: RecurringDepositSplitRow[];
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
  upcomingRecurringDeposits: Array<{
    title: string;
    amount: number;
    nextExecutionDate: string;
    destinationSummary: string;
  }>;
  cardUsage: Array<{ cardId: string; cardName: string; creditLimit: number; used: number }>;
};
