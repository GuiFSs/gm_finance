import { errorMessageForClient, jsonError, parseBody } from "@/shared/lib/api";
import { requireApiSession } from "@/shared/lib/api-auth";
import { setCardStatementPaid } from "@/shared/lib/finance-service";
import { setCardStatementPaidSchema } from "@/shared/lib/schemas";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: RouteContext) {
  const session = await requireApiSession();
  if (!session) return jsonError("Unauthorized", 401);

  const { id } = await context.params;
  try {
    const body = parseBody(setCardStatementPaidSchema, await request.json());
    const ok = await setCardStatementPaid(id, session.userId, body.statementMonth, body.paid);
    if (!ok) return jsonError("Cartão não encontrado", 404);
    return Response.json({ data: { success: true, paid: body.paid } });
  } catch (error) {
    return jsonError(errorMessageForClient(error));
  }
}
