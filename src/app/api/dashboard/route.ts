import { jsonError } from "@/shared/lib/api";
import { requireApiSession } from "@/shared/lib/api-auth";
import { getDashboardData } from "@/shared/lib/finance-service";

export async function GET() {
  const session = await requireApiSession();
  if (!session) return jsonError("Unauthorized", 401);

  const data = await getDashboardData();
  return Response.json({ data });
}
