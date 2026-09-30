import webpush from "web-push";

import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

export type PushSubscriptionRecord = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type PushPayload = {
  title: string;
  message: string;
  url?: string;
};

function getVapidConfig() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim() || "mailto:admin@localhost";
  if (!publicKey || !privateKey) {
    throw new Error("VAPID keys missing: set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY");
  }
  return { publicKey, privateKey, subject };
}

export function getVapidPublicKey(): string | null {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() || null;
}

let vapidConfigured = false;

function ensureVapid() {
  if (vapidConfigured) return;
  const { publicKey, privateKey, subject } = getVapidConfig();
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
}

export async function sendWebPush(
  subscription: PushSubscriptionRecord,
  payload: PushPayload,
): Promise<"ok" | "gone" | "error"> {
  ensureVapid();
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      },
      JSON.stringify({
        title: payload.title,
        message: payload.message,
        url: payload.url ?? "/movements",
      }),
    );
    return "ok";
  } catch (error) {
    const statusCode =
      error && typeof error === "object" && "statusCode" in error
        ? Number((error as { statusCode?: number }).statusCode)
        : undefined;
    if (statusCode === 404 || statusCode === 410) {
      await db
        .delete(schema.pushSubscriptions)
        .where(eq(schema.pushSubscriptions.endpoint, subscription.endpoint));
      return "gone";
    }
    console.error("web-push send failed", error);
    return "error";
  }
}

export async function listPushSubscriptions(): Promise<PushSubscriptionRecord[]> {
  const rows = await db
    .select({
      endpoint: schema.pushSubscriptions.endpoint,
      p256dh: schema.pushSubscriptions.p256dh,
      auth: schema.pushSubscriptions.auth,
    })
    .from(schema.pushSubscriptions);
  return rows;
}
