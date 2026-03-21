import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";

import { db, schema } from "@/db";
import { jsonError, parseBody } from "@/shared/lib/api";
import { requireApiSession } from "@/shared/lib/api-auth";
import { updatePocketSchema } from "@/shared/lib/schemas";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await requireApiSession();
  if (!session) return jsonError("Unauthorized", 401);

  try {
    const { id } = await params;
    const body = parseBody(updatePocketSchema, await request.json());

    const [updated] = await db
      .update(schema.pockets)
      .set({
        name: body.name,
        description: body.description ?? null,
      })
      .where(eq(schema.pockets.id, id))
      .returning();

    if (!updated) return jsonError("Caixinha não encontrada", 404);
    return Response.json({ data: updated });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unexpected error");
  }
}
