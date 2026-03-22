import { asc, desc, eq, inArray } from "drizzle-orm";
import { NextRequest } from "next/server";

import { db, schema } from "@/db";
import { jsonError, parseBody } from "@/shared/lib/api";
import { requireApiSession } from "@/shared/lib/api-auth";
import { createDeposit } from "@/shared/lib/finance-service";
import { createDepositSchema } from "@/shared/lib/schemas";

export async function GET() {
  const session = await requireApiSession();
  if (!session) return jsonError("Unauthorized", 401);
  const rows = await db
    .select({
      id: schema.deposits.id,
      title: schema.deposits.title,
      amount: schema.deposits.amount,
      depositDate: schema.deposits.depositDate,
      recurringDepositId: schema.deposits.recurringDepositId,
      createdByUserId: schema.deposits.createdByUserId,
      createdAt: schema.deposits.createdAt,
    })
    .from(schema.deposits)
    .orderBy(desc(schema.deposits.depositDate));

  const ids = rows.map((r) => r.id);
  const splitRows =
    ids.length > 0
      ? await db
          .select({
            id: schema.depositSplits.id,
            depositId: schema.depositSplits.depositId,
            targetType: schema.depositSplits.targetType,
            pocketId: schema.depositSplits.pocketId,
            amount: schema.depositSplits.amount,
            sortOrder: schema.depositSplits.sortOrder,
            pocketName: schema.pockets.name,
          })
          .from(schema.depositSplits)
          .leftJoin(schema.pockets, eq(schema.pockets.id, schema.depositSplits.pocketId))
          .where(inArray(schema.depositSplits.depositId, ids))
          .orderBy(asc(schema.depositSplits.sortOrder))
      : [];

  const splitsByDeposit = new Map<string, typeof splitRows>();
  for (const s of splitRows) {
    const list = splitsByDeposit.get(s.depositId) ?? [];
    list.push(s);
    splitsByDeposit.set(s.depositId, list);
  }

  const data = rows.map((row) => ({
    ...row,
    splits: (splitsByDeposit.get(row.id) ?? []).map((s) => ({
      id: s.id,
      targetType: s.targetType,
      pocketId: s.pocketId,
      pocketName: s.pocketName,
      amount: s.amount,
      sortOrder: s.sortOrder,
    })),
  }));

  return Response.json({ data });
}

export async function POST(request: NextRequest) {
  const session = await requireApiSession();
  if (!session) return jsonError("Unauthorized", 401);

  try {
    const body = parseBody(createDepositSchema, await request.json());
    await createDeposit(body);
    return Response.json({ data: { success: true } });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unexpected error");
  }
}
