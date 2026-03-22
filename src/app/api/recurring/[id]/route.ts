import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";

import { db, schema } from "@/db";
import { jsonError, parseBody } from "@/shared/lib/api";
import { requireApiSession } from "@/shared/lib/api-auth";
import { updateRecurringSchema } from "@/shared/lib/schemas";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await requireApiSession();
  if (!session) return jsonError("Unauthorized", 401);

  try {
    const { id } = await params;
    const body = parseBody(updateRecurringSchema, await request.json());
    const tagIds = [...new Set(body.tagIds ?? [])];

    const updated = await db.transaction(async (tx) => {
      const [u] = await tx
        .update(schema.recurringExpenses)
        .set({
          title: body.title,
          amount: body.amount,
          nextExecutionDate: body.nextExecutionDate,
          paymentSourceType: body.paymentSourceType,
          paymentSourceId: body.paymentSourceId ?? null,
          categoryId: body.categoryId?.trim() || null,
        })
        .where(eq(schema.recurringExpenses.id, id))
        .returning();

      if (!u) return null;

      await tx.delete(schema.recurringExpenseTags).where(eq(schema.recurringExpenseTags.recurringExpenseId, id));
      for (const tagId of tagIds) {
        await tx.insert(schema.recurringExpenseTags).values({
          recurringExpenseId: id,
          tagId,
        });
      }
      return u;
    });

    if (!updated) return jsonError("Despesa recorrente não encontrada", 404);
    return Response.json({ data: updated });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unexpected error");
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const session = await requireApiSession();
  if (!session) return jsonError("Unauthorized", 401);

  try {
    const { id } = await params;

    const [updated] = await db
      .update(schema.recurringExpenses)
      .set({ isActive: false })
      .where(eq(schema.recurringExpenses.id, id))
      .returning();

    if (!updated) return jsonError("Despesa recorrente não encontrada", 404);
    return Response.json({ data: { success: true } });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unexpected error");
  }
}
