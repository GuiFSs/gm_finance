import { asc, eq, sql } from "drizzle-orm";
import { NextRequest } from "next/server";

import { db, schema } from "@/db";
import { jsonError, parseBody } from "@/shared/lib/api";
import { requireApiSession } from "@/shared/lib/api-auth";
import { ledgerBalanceCutoffDate } from "@/shared/lib/finance-service";
import { createGoalSchema } from "@/shared/lib/schemas";

export async function GET() {
  const session = await requireApiSession();
  if (!session) return jsonError("Unauthorized", 401);

  const cutoff = ledgerBalanceCutoffDate();
  const data = await db
    .select({
      id: schema.goals.id,
      title: schema.goals.title,
      targetAmount: schema.goals.targetAmount,
      pocketId: schema.goals.pocketId,
      pocketName: schema.pockets.name,
      deadline: schema.goals.deadline,
      progressAmount: sql<number>`coalesce(sum(case when ${schema.pocketEntries.referenceType} = 'purchase' and ${schema.pocketEntries.occurredAt} > ${cutoff} then 0 else ${schema.pocketEntries.amount} end), 0)`,
    })
    .from(schema.goals)
    .innerJoin(schema.pockets, eq(schema.pockets.id, schema.goals.pocketId))
    .leftJoin(schema.pocketEntries, eq(schema.pocketEntries.pocketId, schema.pockets.id))
    .groupBy(schema.goals.id)
    .orderBy(asc(schema.goals.title));

  return Response.json({ data });
}

export async function POST(request: NextRequest) {
  const session = await requireApiSession();
  if (!session) return jsonError("Unauthorized", 401);
  try {
    const body = parseBody(createGoalSchema, await request.json());
    const [created] = await db.insert(schema.goals).values({ id: crypto.randomUUID(), ...body }).returning();
    return Response.json({ data: created });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unexpected error");
  }
}
