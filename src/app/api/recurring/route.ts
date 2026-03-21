import { asc, eq } from "drizzle-orm";
import { NextRequest } from "next/server";

import { db, schema } from "@/db";
import { jsonError, parseBody } from "@/shared/lib/api";
import { requireApiSession } from "@/shared/lib/api-auth";
import { createRecurringSchema } from "@/shared/lib/schemas";

export async function GET() {
  const session = await requireApiSession();
  if (!session) return jsonError("Unauthorized", 401);
  const data = await db
    .select()
    .from(schema.recurringExpenses)
    .where(eq(schema.recurringExpenses.isActive, true))
    .orderBy(asc(schema.recurringExpenses.nextExecutionDate));
  return Response.json({ data });
}

export async function POST(request: NextRequest) {
  const session = await requireApiSession();
  if (!session) return jsonError("Unauthorized", 401);

  try {
    const body = parseBody(createRecurringSchema, await request.json());
    const [created] = await db
      .insert(schema.recurringExpenses)
      .values({
        id: crypto.randomUUID(),
        title: body.title,
        amount: body.amount,
        recurrenceType: body.recurrenceType,
        nextExecutionDate: body.nextExecutionDate,
        paymentSourceType: body.paymentSourceType,
        paymentSourceId: body.paymentSourceId,
        createdByUserId: body.createdByUserId,
      })
      .returning();
    return Response.json({ data: created });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unexpected error");
  }
}
