import { errorMessageForClient, jsonError, parseBody } from "@/shared/lib/api";
import { requireApiSession } from "@/shared/lib/api-auth";
import { setPurchasePaid } from "@/shared/lib/finance-service";
import { setPurchasePaidSchema } from "@/shared/lib/schemas";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const session = await requireApiSession();
  if (!session) return jsonError("Unauthorized", 401);

  const { id } = await context.params;
  try {
    const body = parseBody(setPurchasePaidSchema, await request.json());
    const ok = await setPurchasePaid(id, session.userId, body.paid);
    if (!ok) return jsonError("Não encontrado", 404);
    return Response.json({ data: { success: true, paid: body.paid } });
  } catch (error) {
    return jsonError(errorMessageForClient(error));
  }
}
