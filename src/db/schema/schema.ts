import { relations, sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const paymentSourceTypeEnum = ["account", "pocket", "card"] as const;
export const adjustmentTargetTypeEnum = ["account", "pocket"] as const;
export const depositTargetTypeEnum = ["account", "pocket"] as const;

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  pin: text("pin").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const pockets = sqliteTable("pockets", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdByUserId: text("created_by_user_id")
    .notNull()
    .references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const cards = sqliteTable("cards", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  creditLimit: real("credit_limit").notNull(),
  closingDay: integer("closing_day").notNull(),
  dueDay: integer("due_day").notNull(),
  createdByUserId: text("created_by_user_id")
    .notNull()
    .references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const categories = sqliteTable("categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  createdByUserId: text("created_by_user_id")
    .notNull()
    .references(() => users.id),
});

export const tags = sqliteTable("tags", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  createdByUserId: text("created_by_user_id")
    .notNull()
    .references(() => users.id),
});

export const recurringDeposits = sqliteTable("recurring_deposits", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  amount: real("amount").notNull(),
  recurrenceType: text("recurrence_type").notNull().default("monthly"),
  nextExecutionDate: text("next_execution_date").notNull(),
  targetType: text("target_type", { enum: depositTargetTypeEnum }),
  pocketId: text("pocket_id").references(() => pockets.id),
  createdByUserId: text("created_by_user_id")
    .notNull()
    .references(() => users.id),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const recurringDepositSplits = sqliteTable("recurring_deposit_splits", {
  id: text("id").primaryKey(),
  recurringDepositId: text("recurring_deposit_id")
    .notNull()
    .references(() => recurringDeposits.id, { onDelete: "cascade" }),
  targetType: text("target_type", { enum: depositTargetTypeEnum }).notNull(),
  pocketId: text("pocket_id").references(() => pockets.id),
  percent: real("percent").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const recurringExpenses = sqliteTable("recurring_expenses", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  amount: real("amount").notNull(),
  recurrenceType: text("recurrence_type").notNull().default("monthly"),
  nextExecutionDate: text("next_execution_date").notNull(),
  paymentSourceType: text("payment_source_type", {
    enum: paymentSourceTypeEnum,
  }).notNull(),
  paymentSourceId: text("payment_source_id"),
  createdByUserId: text("created_by_user_id")
    .notNull()
    .references(() => users.id),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const purchases = sqliteTable("purchases", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  amount: real("amount").notNull(),
  purchaseDate: text("purchase_date").notNull(),
  categoryId: text("category_id").references(() => categories.id),
  createdByUserId: text("created_by_user_id")
    .notNull()
    .references(() => users.id),
  paymentSourceType: text("payment_source_type", {
    enum: paymentSourceTypeEnum,
  }).notNull(),
  paymentSourceId: text("payment_source_id"),
  installmentCount: integer("installment_count").notNull().default(1),
  installmentNumber: integer("installment_number").notNull().default(1),
  recurringOriginId: text("recurring_origin_id").references(() => recurringExpenses.id),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const purchaseTags = sqliteTable("purchase_tags", {
  purchaseId: text("purchase_id")
    .notNull()
    .references(() => purchases.id),
  tagId: text("tag_id")
    .notNull()
    .references(() => tags.id),
});

export const deposits = sqliteTable("deposits", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  amount: real("amount").notNull(),
  depositDate: text("deposit_date").notNull(),
  targetType: text("target_type", { enum: depositTargetTypeEnum }).default("account"),
  pocketId: text("pocket_id").references(() => pockets.id),
  recurringDepositId: text("recurring_deposit_id").references(() => recurringDeposits.id),
  createdByUserId: text("created_by_user_id")
    .notNull()
    .references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const depositSplits = sqliteTable("deposit_splits", {
  id: text("id").primaryKey(),
  depositId: text("deposit_id")
    .notNull()
    .references(() => deposits.id, { onDelete: "cascade" }),
  targetType: text("target_type", { enum: depositTargetTypeEnum }).notNull(),
  pocketId: text("pocket_id").references(() => pockets.id),
  amount: real("amount").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const accountEntries = sqliteTable("account_entries", {
  id: text("id").primaryKey(),
  amount: real("amount").notNull(),
  entryType: text("entry_type").notNull(),
  referenceType: text("reference_type").notNull(),
  referenceId: text("reference_id").notNull(),
  createdByUserId: text("created_by_user_id")
    .notNull()
    .references(() => users.id),
  occurredAt: text("occurred_at").notNull(),
});

export const pocketEntries = sqliteTable("pocket_entries", {
  id: text("id").primaryKey(),
  pocketId: text("pocket_id")
    .notNull()
    .references(() => pockets.id),
  amount: real("amount").notNull(),
  entryType: text("entry_type").notNull(),
  referenceType: text("reference_type").notNull(),
  referenceId: text("reference_id").notNull(),
  createdByUserId: text("created_by_user_id")
    .notNull()
    .references(() => users.id),
  occurredAt: text("occurred_at").notNull(),
});

export const balanceAdjustments = sqliteTable("balance_adjustments", {
  id: text("id").primaryKey(),
  targetType: text("target_type", { enum: adjustmentTargetTypeEnum }).notNull(),
  targetId: text("target_id"),
  amount: real("amount").notNull(),
  reason: text("reason").notNull(),
  adjustmentDate: text("adjustment_date").notNull(),
  createdByUserId: text("created_by_user_id")
    .notNull()
    .references(() => users.id),
});

export const goals = sqliteTable("goals", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  targetAmount: real("target_amount").notNull(),
  pocketId: text("pocket_id")
    .notNull()
    .references(() => pockets.id),
  createdByUserId: text("created_by_user_id")
    .notNull()
    .references(() => users.id),
  deadline: text("deadline"),
});

export const purchaseRelations = relations(purchases, ({ one, many }) => ({
  category: one(categories, {
    fields: [purchases.categoryId],
    references: [categories.id],
  }),
  user: one(users, { fields: [purchases.createdByUserId], references: [users.id] }),
  tags: many(purchaseTags),
}));
