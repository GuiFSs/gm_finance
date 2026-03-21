import { db, schema } from "@/db";
import { seedInitialUsers } from "@/shared/lib/finance-service";

export async function GET() {
  await seedInitialUsers();
  const users = await db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users);
  return Response.json({ data: users });
}
