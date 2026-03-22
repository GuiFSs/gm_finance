import { asc, eq, inArray } from "drizzle-orm";
import { NextRequest } from "next/server";

import { db, schema } from "@/db";
import { jsonError, parseBody } from "@/shared/lib/api";
import { requireApiSession } from "@/shared/lib/api-auth";
import { createRecurringDepositSchema } from "@/shared/lib/schemas";

export async function GET() {
  const session = await requireApiSession();
  if (!session) return jsonError("Unauthorized", 401);

  const rows = await db
    .select({
      id: schema.recurringDeposits.id,
      title: schema.recurringDeposits.title,
      amount: schema.recurringDeposits.amount,
      recurrenceType: schema.recurringDeposits.recurrenceType,
      nextExecutionDate: schema.recurringDeposits.nextExecutionDate,
      createdByUserId: schema.recurringDeposits.createdByUserId,
      isActive: schema.recurringDeposits.isActive,
    })
    .from(schema.recurringDeposits)
    .where(eq(schema.recurringDeposits.isActive, true))
    .orderBy(asc(schema.recurringDeposits.nextExecutionDate));

  const ids = rows.map((r) => r.id);
  const splitRowsAll =
    ids.length > 0
      ? await db
          .select({
            id: schema.recurringDepositSplits.id,
            recurringDepositId: schema.recurringDepositSplits.recurringDepositId,
            targetType: schema.recurringDepositSplits.targetType,
            pocketId: schema.recurringDepositSplits.pocketId,
            percent: schema.recurringDepositSplits.percent,
            sortOrder: schema.recurringDepositSplits.sortOrder,
            pocketName: schema.pockets.name,
          })
          .from(schema.recurringDepositSplits)
          .leftJoin(schema.pockets, eq(schema.pockets.id, schema.recurringDepositSplits.pocketId))
          .where(inArray(schema.recurringDepositSplits.recurringDepositId, ids))
          .orderBy(asc(schema.recurringDepositSplits.sortOrder))
      : [];

  const splitsByRecurring = new Map<string, typeof splitRowsAll>();
  for (const s of splitRowsAll) {
    const list = splitsByRecurring.get(s.recurringDepositId) ?? [];
    list.push(s);
    splitsByRecurring.set(s.recurringDepositId, list);
  }

  const data = rows.map((row) => ({
    ...row,
    splits: (splitsByRecurring.get(row.id) ?? []).map((s) => ({
      id: s.id,
      targetType: s.targetType,
      pocketId: s.pocketId,
      pocketName: s.pocketName,
      percent: s.percent,
      sortOrder: s.sortOrder,
    })),
  }));

  return Response.json({ data });
}

export async function POST(request: NextRequest) {
  const session = await requireApiSession();
  if (!session) return jsonError("Unauthorized", 401);

  try {
    const body = parseBody(createRecurringDepositSchema, await request.json());
    const id = crypto.randomUUID();
    await db.transaction(async (tx) => {
      await tx.insert(schema.recurringDeposits).values({
        id,
        title: body.title,
        amount: body.amount,
        recurrenceType: body.recurrenceType,
        nextExecutionDate: body.nextExecutionDate,
        targetType: null,
        pocketId: null,
        createdByUserId: body.createdByUserId,
      });
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
    });
    const [created] = await db.select().from(schema.recurringDeposits).where(eq(schema.recurringDeposits.id, id));
    return Response.json({ data: created });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unexpected error");
  }
}
