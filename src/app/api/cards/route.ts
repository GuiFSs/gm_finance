import { and, asc, eq, sql } from "drizzle-orm";
import { NextRequest } from "next/server";

import { db, schema } from "@/db";
import { jsonError, parseBody } from "@/shared/lib/api";
import { requireApiSession } from "@/shared/lib/api-auth";
import { createCardSchema } from "@/shared/lib/schemas";

export async function GET() {
  const session = await requireApiSession();
  if (!session) return jsonError("Unauthorized", 401);

  const data = await db
    .select({
      id: schema.cards.id,
      name: schema.cards.name,
      creditLimit: schema.cards.creditLimit,
      closingDay: schema.cards.closingDay,
      dueDay: schema.cards.dueDay,
      usedLimit: sql<number>`coalesce(sum(${schema.purchases.amount}), 0)`,
    })
    .from(schema.cards)
    .leftJoin(
      schema.purchases,
      and(eq(schema.purchases.paymentSourceType, "card"), eq(schema.purchases.paymentSourceId, schema.cards.id)),
    )
    .groupBy(schema.cards.id)
    .orderBy(asc(schema.cards.name));

  return Response.json({ data });
}

export async function POST(request: NextRequest) {
  const session = await requireApiSession();
  if (!session) return jsonError("Unauthorized", 401);

  try {
    const body = parseBody(createCardSchema, await request.json());
    const [created] = await db
      .insert(schema.cards)
      .values({
        id: crypto.randomUUID(),
        name: body.name,
        creditLimit: body.creditLimit,
        closingDay: body.closingDay,
        dueDay: body.dueDay,
        createdByUserId: body.createdByUserId,
      })
      .returning();

    return Response.json({ data: created });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unexpected error");
  }
}
