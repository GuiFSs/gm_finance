import { format } from "date-fns";
import { NextRequest } from "next/server";

import { db, schema } from "@/db";
import { jsonError, parseBody } from "@/shared/lib/api";
import { requireApiSession } from "@/shared/lib/api-auth";
import { getPocketBalances } from "@/shared/lib/finance-service";
import { createPocketSchema } from "@/shared/lib/schemas";

export async function GET() {
  const session = await requireApiSession();
  if (!session) return jsonError("Unauthorized", 401);

  const data = await getPocketBalances();
  return Response.json({ data });
}

export async function POST(request: NextRequest) {
  const session = await requireApiSession();
  if (!session) return jsonError("Unauthorized", 401);

  try {
    const body = parseBody(createPocketSchema, await request.json());
    const pocketId = crypto.randomUUID();
    const today = format(new Date(), "yyyy-MM-dd");

    const [created] = await db
      .insert(schema.pockets)
      .values({
        id: pocketId,
        name: body.name,
        description: body.description,
        createdByUserId: body.createdByUserId,
      })
      .returning();

    const initialAmount = Number(body.initialAmount ?? 0);
    if (initialAmount > 0) {
      await db.insert(schema.pocketEntries).values({
        id: crypto.randomUUID(),
        pocketId,
        amount: initialAmount,
        entryType: "transfer_in",
        referenceType: "pocket_initial",
        referenceId: pocketId,
        createdByUserId: body.createdByUserId,
        occurredAt: today,
      });
    }

    return Response.json({ data: created });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unexpected error");
  }
}
