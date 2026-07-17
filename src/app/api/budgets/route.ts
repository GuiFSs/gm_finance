import { NextRequest } from "next/server";

import { jsonError, parseBody, errorMessageForClient } from "@/shared/lib/api";
import { requireApiSession } from "@/shared/lib/api-auth";
import { copyMonthlyBudget, getMonthlyBudget, upsertMonthlyBudget } from "@/shared/lib/budget-service";
import { copyMonthlyBudgetSchema, upsertMonthlyBudgetSchema } from "@/shared/lib/schemas";

const MONTH_RE = /^\d{4}-\d{2}$/;

export async function GET(request: NextRequest) {
  const session = await requireApiSession();
  if (!session) return jsonError("Unauthorized", 401);

  try {
    const month = request.nextUrl.searchParams.get("month")?.trim() ?? "";
    if (!MONTH_RE.test(month)) {
      return jsonError("Informe o mês no formato yyyy-MM", 400);
    }
    const data = await getMonthlyBudget(month);
    return Response.json({ data });
  } catch (error) {
    return jsonError(errorMessageForClient(error));
  }
}

export async function PUT(request: NextRequest) {
  const session = await requireApiSession();
  if (!session) return jsonError("Unauthorized", 401);

  try {
    const body = parseBody(upsertMonthlyBudgetSchema, await request.json());
    const data = await upsertMonthlyBudget({
      month: body.month,
      incomeAmount: body.incomeAmount,
      allocations: body.allocations ?? [],
      userId: session.userId,
    });
    return Response.json({ data });
  } catch (error) {
    return jsonError(errorMessageForClient(error));
  }
}

export async function POST(request: NextRequest) {
  const session = await requireApiSession();
  if (!session) return jsonError("Unauthorized", 401);

  try {
    const body = parseBody(copyMonthlyBudgetSchema, await request.json());
    const data = await copyMonthlyBudget({
      fromMonth: body.fromMonth,
      toMonth: body.toMonth,
      userId: session.userId,
    });
    return Response.json({ data });
  } catch (error) {
    return jsonError(errorMessageForClient(error));
  }
}
