import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { z } from "zod";

import { db, schema } from "@/db";
import { jsonError, parseBody } from "@/shared/lib/api";
import { requireApiSession } from "@/shared/lib/api-auth";

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export async function POST(request: NextRequest) {
  const session = await requireApiSession();
  if (!session) return jsonError("Unauthorized", 401);

  try {
    const body = parseBody(subscribeSchema, await request.json());
    const now = new Date();
    const userAgent = request.headers.get("user-agent")?.slice(0, 512) ?? null;

    const existing = await db
      .select({ endpoint: schema.pushSubscriptions.endpoint })
      .from(schema.pushSubscriptions)
      .where(eq(schema.pushSubscriptions.endpoint, body.endpoint))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(schema.pushSubscriptions)
        .set({
          userId: session.userId,
          p256dh: body.keys.p256dh,
          auth: body.keys.auth,
          userAgent,
          updatedAt: now,
        })
        .where(eq(schema.pushSubscriptions.endpoint, body.endpoint));
    } else {
      await db.insert(schema.pushSubscriptions).values({
        endpoint: body.endpoint,
        userId: session.userId,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
        userAgent,
        createdAt: now,
        updatedAt: now,
      });
    }

    return Response.json({ data: { ok: true } });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unexpected error");
  }
}

export async function DELETE(request: NextRequest) {
  const session = await requireApiSession();
  if (!session) return jsonError("Unauthorized", 401);

  try {
    const body = parseBody(
      z.object({ endpoint: z.string().url() }),
      await request.json(),
    );
    await db
      .delete(schema.pushSubscriptions)
      .where(eq(schema.pushSubscriptions.endpoint, body.endpoint));
    return Response.json({ data: { ok: true } });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unexpected error");
  }
}
