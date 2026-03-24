import { NextRequest } from "next/server";

import { errorMessageForClient, jsonError, parseBody } from "@/shared/lib/api";
import { requireApiSession } from "@/shared/lib/api-auth";
import {
  type CardStatementInvoiceLine,
  getCardStatementInvoiceDetail,
  listCardStatementFundingByCard,
  replaceCardStatementFunding,
} from "@/shared/lib/finance-service";
import { replaceCardStatementFundingSchema } from "@/shared/lib/schemas";

type RouteParams = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

const STATEMENT_MONTH_RE = /^\d{4}-\d{2}$/;

export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await requireApiSession();
  if (!session) return jsonError("Unauthorized", 401);

  try {
    const { id: cardId } = await params;
    const data = await listCardStatementFundingByCard(cardId, session.userId);
    if (data === null) return jsonError("Cartão não encontrado", 404);

    const monthParam = request.nextUrl.searchParams.get("statementMonth")?.trim() ?? "";
    let invoiceTotal: number | null = null;
    let invoiceLines: CardStatementInvoiceLine[] | null = null;
    if (monthParam && STATEMENT_MONTH_RE.test(monthParam)) {
      const detail = await getCardStatementInvoiceDetail(cardId, monthParam, session.userId);
      invoiceTotal = detail ? detail.total : null;
      invoiceLines = detail ? detail.lines : null;
    }

    return Response.json({ data, invoiceTotal, invoiceLines });
  } catch (error) {
    return jsonError(errorMessageForClient(error));
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const session = await requireApiSession();
  if (!session) return jsonError("Unauthorized", 401);

  try {
    const { id: cardId } = await params;
    const body = parseBody(replaceCardStatementFundingSchema, await request.json());
    await replaceCardStatementFunding(cardId, session.userId, body.statementMonth, body.splits);
    return Response.json({ data: { success: true } });
  } catch (error) {
    return jsonError(errorMessageForClient(error));
  }
}
