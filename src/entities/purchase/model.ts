export type Purchase = {
  id: string;
  title: string;
  description?: string | null;
  amount: number;
  purchaseDate: string;
  categoryId?: string | null;
  createdByUserId: string;
  paymentSourceType: "account" | "pocket" | "card";
  paymentSourceId?: string | null;
  installmentCount: number;
  installmentNumber: number;
};
