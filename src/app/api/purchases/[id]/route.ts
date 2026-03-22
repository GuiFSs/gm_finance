import { jsonError, parseBody } from "@/shared/lib/api";
import { requireApiSession } from "@/shared/lib/api-auth";
import {
  deletePurchaseGroup,
  getPurchaseDetailById,
  updatePurchaseGroup,
} from "@/shared/lib/finance-service";
import { updatePurchaseSchema } from "@/shared/lib/schemas";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const session = await requireApiSession();
  if (!session) return jsonError("Unauthorized", 401);

  const { id } = await context.params;
  const data = await getPurchaseDetailById(id, session.userId);
  if (!data) return jsonError("Não encontrado", 404);
  return Response.json({ data });
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await requireApiSession();
  if (!session) return jsonError("Unauthorized", 401);

  const { id } = await context.params;
  try {
    const body = parseBody(updatePurchaseSchema, await request.json());
    const ok = await updatePurchaseGroup(id, session.userId, {
      ...body,
      createdByUserId: session.userId,
      tagIds: body.tagIds ?? [],
    });
    if (!ok) return jsonError("Não encontrado", 404);
    return Response.json({ data: { success: true } });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Erro inesperado");
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await requireApiSession();
  if (!session) return jsonError("Unauthorized", 401);

  const { id } = await context.params;
  const ok = await deletePurchaseGroup(id, session.userId);
  if (!ok) return jsonError("Não encontrado", 404);
  return Response.json({ data: { success: true } });
}
