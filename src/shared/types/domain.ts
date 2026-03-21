export type PaymentSourceType = "account" | "pocket" | "card";
export type AdjustmentTargetType = "account" | "pocket";
export type AppUserName = "Guilherme" | "Maryane";

export type AppSession = {
  userId: string;
  name: AppUserName;
  exp: number;
};
