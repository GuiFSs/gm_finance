import { NextRequest } from "next/server";

import { jsonError, parseBody } from "@/shared/lib/api";
import { requireApiSession } from "@/shared/lib/api-auth";
import { createPurchase, getPurchases } from "@/shared/lib/finance-service";
import { createPurchaseSchema } from "@/shared/lib/schemas";

export async function GET(request: NextRequest) {
  const session = await requireApiSession();
  if (!session) return jsonError("Unauthorized", 401);

  const searchParams = request.nextUrl.searchParams;
  const data = await getPurchases({
    categoryId: searchParams.get("categoryId") ?? undefined,
    tagId: searchParams.get("tagId") ?? undefined,
    userId: searchParams.get("userId") ?? undefined,
    startDate: searchParams.get("startDate") ?? undefined,
    endDate: searchParams.get("endDate") ?? undefined,
  });
  return Response.json({ data });
}

export async function POST(request: NextRequest) {
  const session = await requireApiSession();
  if (!session) return jsonError("Unauthorized", 401);

  try {
    const body = parseBody(createPurchaseSchema, await request.json());
    await createPurchase(body);
    return Response.json({ data: { success: true } });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unexpected error");
  }
}
