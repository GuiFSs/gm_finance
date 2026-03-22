import { z } from "zod";

export const loginSchema = z.object({
  userId: z.string().min(1),
  pin: z.string().min(1),
});

export const createPurchaseSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  amount: z.coerce.number().positive(),
  purchaseDate: z.string().min(1),
  categoryId: z.string().optional(),
  createdByUserId: z.string().min(1),
  paymentSourceType: z.enum(["account", "pocket", "card"]),
  paymentSourceId: z.string().optional(),
  installmentCount: z.coerce.number().int().min(1).max(48).default(1),
  recurringOriginId: z.string().optional(),
  tagIds: z.array(z.string()).default([]),
});

/** Mesmos campos do POST, sem createdByUserId (vem da sessão no PATCH). */
export const updatePurchaseSchema = createPurchaseSchema.omit({ createdByUserId: true });

export const createPocketSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  initialAmount: z.coerce.number().min(0).optional().default(0),
  createdByUserId: z.string().min(1),
});

export const updatePocketSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
});

const transferSourceSchema = z.object({
  fromType: z.enum(["account", "pocket"]),
  fromPocketId: z.string().optional(),
  toType: z.enum(["account", "pocket"]),
  toPocketId: z.string().optional(),
  amount: z.coerce.number().positive(),
  transferDate: z.string().min(1),
  createdByUserId: z.string().min(1),
});

export const transferToPocketSchema = transferSourceSchema
  .refine((data) => data.fromType !== "pocket" || (data.fromPocketId && data.fromPocketId.length > 0), {
    message: "Selecione a caixinha de origem",
    path: ["fromPocketId"],
  })
  .refine((data) => data.toType !== "pocket" || (data.toPocketId && data.toPocketId.length > 0), {
    message: "Selecione a caixinha de destino",
    path: ["toPocketId"],
  })
  .refine(
    (data) => {
      const sameOrigin = data.fromType === "account" && data.toType === "account";
      const samePocket = data.fromType === "pocket" && data.toType === "pocket" && data.fromPocketId === data.toPocketId;
      return !sameOrigin && !samePocket;
    },
    { message: "Origem e destino devem ser diferentes", path: ["toType"] }
  );

export const createCardSchema = z.object({
  name: z.string().min(1),
  creditLimit: z.coerce.number().positive(),
  closingDay: z.coerce.number().int().min(1).max(31),
  dueDay: z.coerce.number().int().min(1).max(31),
  createdByUserId: z.string().min(1),
});

export const updateCardSchema = z.object({
  name: z.string().min(1),
  creditLimit: z.coerce.number().positive(),
  closingDay: z.coerce.number().int().min(1).max(31),
  dueDay: z.coerce.number().int().min(1).max(31),
});

export const createCategorySchema = z.object({
  name: z.string().min(1),
  createdByUserId: z.string().min(1),
});

export const createTagSchema = z.object({
  name: z.string().min(1),
  createdByUserId: z.string().min(1),
});

export const createRecurringSchema = z.object({
  title: z.string().min(1),
  amount: z.coerce.number().positive(),
  recurrenceType: z.literal("monthly").default("monthly"),
  nextExecutionDate: z.string().min(1),
  paymentSourceType: z.enum(["account", "pocket", "card"]),
  paymentSourceId: z.string().optional(),
  categoryId: z.string().optional(),
  tagIds: z.array(z.string()).optional(),
  createdByUserId: z.string().min(1),
});

export const updateRecurringSchema = z.object({
  title: z.string().min(1),
  amount: z.coerce.number().positive(),
  nextExecutionDate: z.string().min(1),
  paymentSourceType: z.enum(["account", "pocket", "card"]),
  paymentSourceId: z.string().optional(),
  categoryId: z.string().optional(),
  tagIds: z.array(z.string()).optional(),
});

export const createGoalSchema = z.object({
  title: z.string().min(1),
  targetAmount: z.coerce.number().positive(),
  pocketId: z.string().min(1),
  createdByUserId: z.string().min(1),
  deadline: z.string().optional(),
});

export const depositSplitInputSchema = z.object({
  targetType: z.enum(["account", "pocket"]),
  pocketId: z.string().optional(),
  amount: z.coerce.number().positive(),
});

export const createDepositSchema = z
  .object({
    title: z.string().min(1),
    amount: z.coerce.number().positive(),
    depositDate: z.string().min(1),
    createdByUserId: z.string().min(1),
    splits: z.array(depositSplitInputSchema).min(1),
  })
  .superRefine((data, ctx) => {
    const sum = data.splits.reduce((a, s) => a + s.amount, 0);
    if (Math.abs(sum - data.amount) > 0.02) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A soma das partes deve ser igual ao valor total.",
        path: ["splits"],
      });
    }
    data.splits.forEach((s, i) => {
      if (s.targetType === "pocket" && !s.pocketId?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Selecione a caixinha",
          path: ["splits", i, "pocketId"],
        });
      }
    });
  });

export const updateDepositSchema = z
  .object({
    title: z.string().min(1),
    amount: z.coerce.number().positive(),
    depositDate: z.string().min(1),
    splits: z.array(depositSplitInputSchema).min(1),
  })
  .superRefine((data, ctx) => {
    const sum = data.splits.reduce((a, s) => a + s.amount, 0);
    if (Math.abs(sum - data.amount) > 0.02) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A soma das partes deve ser igual ao valor total.",
        path: ["splits"],
      });
    }
    data.splits.forEach((s, i) => {
      if (s.targetType === "pocket" && !s.pocketId?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Selecione a caixinha",
          path: ["splits", i, "pocketId"],
        });
      }
    });
  });

export const recurringDepositSplitInputSchema = z.object({
  targetType: z.enum(["account", "pocket"]),
  pocketId: z.string().optional(),
  percent: z.coerce.number().positive(),
});

export const createRecurringDepositSchema = z
  .object({
    title: z.string().min(1),
    amount: z.coerce.number().positive(),
    recurrenceType: z.literal("monthly").default("monthly"),
    nextExecutionDate: z.string().min(1),
    createdByUserId: z.string().min(1),
    splits: z.array(recurringDepositSplitInputSchema).min(1),
  })
  .superRefine((data, ctx) => {
    const sum = data.splits.reduce((a, s) => a + s.percent, 0);
    if (Math.abs(sum - 100) > 0.05) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "As porcentagens devem somar 100%.",
        path: ["splits"],
      });
    }
    data.splits.forEach((s, i) => {
      if (s.targetType === "pocket" && !s.pocketId?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Selecione a caixinha",
          path: ["splits", i, "pocketId"],
        });
      }
    });
  });

export const updateRecurringDepositSchema = z
  .object({
    title: z.string().min(1),
    amount: z.coerce.number().positive(),
    nextExecutionDate: z.string().min(1),
    splits: z.array(recurringDepositSplitInputSchema).min(1),
  })
  .superRefine((data, ctx) => {
    const sum = data.splits.reduce((a, s) => a + s.percent, 0);
    if (Math.abs(sum - 100) > 0.05) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "As porcentagens devem somar 100%.",
        path: ["splits"],
      });
    }
    data.splits.forEach((s, i) => {
      if (s.targetType === "pocket" && !s.pocketId?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Selecione a caixinha",
          path: ["splits", i, "pocketId"],
        });
      }
    });
  });

export const createAdjustmentSchema = z.object({
  targetType: z.enum(["account", "pocket"]),
  targetId: z.string().optional(),
  amount: z.coerce.number(),
  reason: z.string().min(1),
  adjustmentDate: z.string().min(1),
  createdByUserId: z.string().min(1),
});
