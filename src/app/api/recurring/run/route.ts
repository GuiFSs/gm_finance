import { jsonError } from "@/shared/lib/api";
import { requireApiSession } from "@/shared/lib/api-auth";
import { runRecurringExpenses } from "@/shared/lib/finance-service";

export async function POST() {
  const session = await requireApiSession();
  if (!session) return jsonError("Unauthorized", 401);

  const processed = await runRecurringExpenses();
  return Response.json({ data: { processed } });
}
