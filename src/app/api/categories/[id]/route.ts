import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";

import { db, schema } from "@/db";
import { jsonError, parseBody } from "@/shared/lib/api";
import { requireApiSession } from "@/shared/lib/api-auth";
import { updateCategorySchema } from "@/shared/lib/schemas";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await requireApiSession();
  if (!session) return jsonError("Unauthorized", 401);

  try {
    const { id } = await params;
    const body = parseBody(updateCategorySchema, await request.json());

    const [updated] = await db
      .update(schema.categories)
      .set({ name: body.name })
      .where(eq(schema.categories.id, id))
      .returning();

    if (!updated) return jsonError("Categoria não encontrada", 404);
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

    const deleted = await db.transaction(async (tx) => {
      await tx.update(schema.purchases).set({ categoryId: null }).where(eq(schema.purchases.categoryId, id));
      await tx
        .update(schema.recurringExpenses)
        .set({ categoryId: null })
        .where(eq(schema.recurringExpenses.categoryId, id));

      const [row] = await tx.delete(schema.categories).where(eq(schema.categories.id, id)).returning();
      return row;
    });

    if (!deleted) return jsonError("Categoria não encontrada", 404);
    return Response.json({ data: { id: deleted.id } });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unexpected error");
  }
}
