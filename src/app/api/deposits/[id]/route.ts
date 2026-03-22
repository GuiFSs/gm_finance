import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";

import { db, schema } from "@/db";
import { jsonError, parseBody } from "@/shared/lib/api";
import { requireApiSession } from "@/shared/lib/api-auth";
import { deleteDeposit, updateDeposit } from "@/shared/lib/finance-service";
import { updateDepositSchema } from "@/shared/lib/schemas";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await requireApiSession();
  if (!session) return jsonError("Unauthorized", 401);

  try {
    const { id } = await params;
    const body = parseBody(updateDepositSchema, await request.json());

    const [row] = await db.select().from(schema.deposits).where(eq(schema.deposits.id, id));
    if (!row) return jsonError("Depósito não encontrado", 404);
    if (row.createdByUserId !== session.userId) return jsonError("Sem permissão", 403);

    await updateDeposit(id, {
      title: body.title,
      amount: body.amount,
      depositDate: body.depositDate,
      createdByUserId: row.createdByUserId,
      splits: body.splits,
    });
    return Response.json({ data: { success: true } });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unexpected error");
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const session = await requireApiSession();
  if (!session) return jsonError("Unauthorized", 401);

  try {
    const { id } = await params;

    const [row] = await db.select().from(schema.deposits).where(eq(schema.deposits.id, id));
    if (!row) return jsonError("Depósito não encontrado", 404);
    if (row.createdByUserId !== session.userId) return jsonError("Sem permissão", 403);

    await deleteDeposit(id);
    return Response.json({ data: { success: true } });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unexpected error");
  }
}
