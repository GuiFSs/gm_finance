import { db } from "@/db";
import { jsonError } from "@/shared/lib/api";
import { requireApiSession } from "@/shared/lib/api-auth";

export async function GET() {
  const session = await requireApiSession();
  if (!session) {
    return jsonError("Unauthorized", 401);
  }

  const user = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.id, session.userId),
    columns: { id: true, name: true },
  });

  if (!user) {
    return jsonError("Unauthorized", 401);
  }

  return Response.json({ data: user });
}
