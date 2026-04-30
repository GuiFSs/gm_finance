import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db, schema } from "@/db";
import { createSessionToken, setSessionCookie } from "@/shared/lib/auth";
import { jsonError, parseBody } from "@/shared/lib/api";
import {
  runRecurringDeposits,
  runRecurringExpenses,
  seedInitialUsers,
} from "@/shared/lib/finance-service";
import { loginSchema } from "@/shared/lib/schemas";

export async function POST(request: NextRequest) {
  try {
    await seedInitialUsers();
    const body = parseBody(loginSchema, await request.json());
    const loginPin = process.env.LOGIN_PIN;

    if (!loginPin) {
      return jsonError("LOGIN_PIN is not configured", 500);
    }

    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, body.userId),
    });

    if (!user || body.pin !== loginPin) {
      return jsonError("Invalid credentials", 401);
    }

    await Promise.all([runRecurringExpenses(), runRecurringDeposits()]);

    const token = await createSessionToken({ userId: user.id, name: user.name as "Guilherme" | "Maryane" });
    const response = NextResponse.json({ data: { userId: user.id, name: user.name } });
    setSessionCookie(response, token);
    return response;
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unexpected error");
  }
}
