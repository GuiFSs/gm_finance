import { NextRequest } from "next/server";

import { jsonError } from "@/shared/lib/api";
import { requireApiSession } from "@/shared/lib/api-auth";
import { computeSourcesSummary, getDashboardData, getMonthMovements } from "@/shared/lib/finance-service";

export async function GET(request: NextRequest) {
  const session = await requireApiSession();
  if (!session) return jsonError("Unauthorized", 401);

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");
  const now = new Date();
  const year = now.getFullYear();
  const m = now.getMonth() + 1;
  const monthParam = month ?? `${year}-${String(m).padStart(2, "0")}`;

  const [data, dashboard] = await Promise.all([
    getMonthMovements(monthParam),
    getDashboardData(),
  ]);
  const sourcesSummary = computeSourcesSummary(data, {
    checkingBalance: dashboard.checkingBalance,
    pocketBalances: dashboard.pocketBalances,
    cardUsage: dashboard.cardUsage.map((c) => ({
      cardId: c.cardId,
      cardName: c.cardName,
      creditLimit: c.creditLimit,
      used: c.used,
    })),
  });
  return Response.json({ data, sourcesSummary });
}
