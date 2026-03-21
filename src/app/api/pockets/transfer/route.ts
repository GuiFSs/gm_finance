import { NextRequest } from "next/server";

import { jsonError, parseBody } from "@/shared/lib/api";
import { requireApiSession } from "@/shared/lib/api-auth";
import { createTransfer } from "@/shared/lib/finance-service";
import { transferToPocketSchema } from "@/shared/lib/schemas";

export async function POST(request: NextRequest) {
  const session = await requireApiSession();
  if (!session) return jsonError("Unauthorized", 401);

  try {
    const body = parseBody(transferToPocketSchema, await request.json());
    await createTransfer(body);
    return Response.json({ data: { success: true } });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unexpected error");
  }
}
