import { jsonError } from "@/shared/lib/api";
import { requireApiSession } from "@/shared/lib/api-auth";
import { runRecurringDeposits, runRecurringExpenses } from "@/shared/lib/finance-service";

export async function POST() {
  const session = await requireApiSession();
  if (!session) return jsonError("Unauthorized", 401);

  const [processedExpenses, processedDeposits] = await Promise.all([
    runRecurringExpenses(),
    runRecurringDeposits(),
  ]);
  return Response.json({
    data: { processedExpenses, processedDeposits, processed: processedExpenses + processedDeposits },
  });
}
