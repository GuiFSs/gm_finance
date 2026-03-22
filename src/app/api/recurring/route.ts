import { asc, eq, inArray } from "drizzle-orm";
import { NextRequest } from "next/server";

import { db, schema } from "@/db";
import { jsonError, parseBody } from "@/shared/lib/api";
import { requireApiSession } from "@/shared/lib/api-auth";
import { createRecurringSchema } from "@/shared/lib/schemas";

export async function GET() {
  const session = await requireApiSession();
  if (!session) return jsonError("Unauthorized", 401);
  const rows = await db
    .select({
      id: schema.recurringExpenses.id,
      title: schema.recurringExpenses.title,
      amount: schema.recurringExpenses.amount,
      recurrenceType: schema.recurringExpenses.recurrenceType,
      nextExecutionDate: schema.recurringExpenses.nextExecutionDate,
      paymentSourceType: schema.recurringExpenses.paymentSourceType,
      paymentSourceId: schema.recurringExpenses.paymentSourceId,
      categoryId: schema.recurringExpenses.categoryId,
      categoryName: schema.categories.name,
      createdByUserId: schema.recurringExpenses.createdByUserId,
      isActive: schema.recurringExpenses.isActive,
      createdAt: schema.recurringExpenses.createdAt,
    })
    .from(schema.recurringExpenses)
    .leftJoin(schema.categories, eq(schema.categories.id, schema.recurringExpenses.categoryId))
    .where(eq(schema.recurringExpenses.isActive, true))
    .orderBy(asc(schema.recurringExpenses.nextExecutionDate));

  const ids = rows.map((r) => r.id);
  const tagRows =
    ids.length > 0
      ? await db
          .select({
            recurringId: schema.recurringExpenseTags.recurringExpenseId,
            tagId: schema.tags.id,
            tagName: schema.tags.name,
          })
          .from(schema.recurringExpenseTags)
          .innerJoin(schema.tags, eq(schema.tags.id, schema.recurringExpenseTags.tagId))
          .where(inArray(schema.recurringExpenseTags.recurringExpenseId, ids))
          .orderBy(asc(schema.tags.name))
      : [];

  const tagsByRecurring = new Map<string, Array<{ id: string; name: string }>>();
  for (const t of tagRows) {
    const list = tagsByRecurring.get(t.recurringId) ?? [];
    list.push({ id: t.tagId, name: t.tagName });
    tagsByRecurring.set(t.recurringId, list);
  }

  const data = rows.map((row) => ({
    ...row,
    tags: tagsByRecurring.get(row.id) ?? [],
  }));

  return Response.json({ data });
}

export async function POST(request: NextRequest) {
  const session = await requireApiSession();
  if (!session) return jsonError("Unauthorized", 401);

  try {
    const body = parseBody(createRecurringSchema, await request.json());
    const id = crypto.randomUUID();
    const tagIds = [...new Set(body.tagIds ?? [])];

    await db.transaction(async (tx) => {
      await tx.insert(schema.recurringExpenses).values({
        id,
        title: body.title,
        amount: body.amount,
        recurrenceType: body.recurrenceType,
        nextExecutionDate: body.nextExecutionDate,
        paymentSourceType: body.paymentSourceType,
        paymentSourceId: body.paymentSourceId,
        categoryId: body.categoryId?.trim() || null,
        createdByUserId: body.createdByUserId,
      });
      for (const tagId of tagIds) {
        await tx.insert(schema.recurringExpenseTags).values({
          recurringExpenseId: id,
          tagId,
        });
      }
    });

    const [created] = await db.select().from(schema.recurringExpenses).where(eq(schema.recurringExpenses.id, id));
    return Response.json({ data: created });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unexpected error");
  }
}
