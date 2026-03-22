import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";

import { db, schema } from "@/db";
import { jsonError, parseBody } from "@/shared/lib/api";
import { requireApiSession } from "@/shared/lib/api-auth";
import { updateRecurringDepositSchema } from "@/shared/lib/schemas";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await requireApiSession();
  if (!session) return jsonError("Unauthorized", 401);

  try {
    const { id } = await params;
    const body = parseBody(updateRecurringDepositSchema, await request.json());

    const updated = await db.transaction(async (tx) => {
      const [u] = await tx
        .update(schema.recurringDeposits)
        .set({
          title: body.title,
          amount: body.amount,
          nextExecutionDate: body.nextExecutionDate,
          targetType: null,
          pocketId: null,
        })
        .where(eq(schema.recurringDeposits.id, id))
        .returning();
      if (!u) return null;

      await tx.delete(schema.recurringDepositSplits).where(eq(schema.recurringDepositSplits.recurringDepositId, id));
      for (let i = 0; i < body.splits.length; i++) {
        const s = body.splits[i]!;
        await tx.insert(schema.recurringDepositSplits).values({
          id: crypto.randomUUID(),
          recurringDepositId: id,
          targetType: s.targetType,
          pocketId: s.targetType === "pocket" ? s.pocketId!.trim() : null,
          percent: s.percent,
          sortOrder: i,
        });
      }
      return u;
    });

    if (!updated) return jsonError("Depósito recorrente não encontrado", 404);
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
      .update(schema.recurringDeposits)
      .set({ isActive: false })
      .where(eq(schema.recurringDeposits.id, id))
      .returning();

    if (!updated) return jsonError("Depósito recorrente não encontrado", 404);
    return Response.json({ data: { success: true } });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unexpected error");
  }
}
