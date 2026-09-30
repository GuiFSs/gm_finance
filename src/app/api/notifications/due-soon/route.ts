import { NextRequest } from "next/server";

import { jsonError } from "@/shared/lib/api";
import {
  buildDueSoonDigest,
  hasDueSoonSendForDate,
  recordDueSoonSend,
} from "@/shared/lib/due-soon-digest";
import { listPushSubscriptions, sendWebPush } from "@/shared/lib/web-push";

function authorizeCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return false;
  return header.slice("Bearer ".length) === secret;
}

export async function POST(request: NextRequest) {
  if (!authorizeCron(request)) {
    return jsonError("Unauthorized", 401);
  }

  try {
    const force = request.nextUrl.searchParams.get("force") === "1";
    const digest = await buildDueSoonDigest();

    if (digest.items.length === 0) {
      return Response.json({
        data: { sent: false, reason: "empty", today: digest.today, itemCount: 0 },
      });
    }

    if (!force && (await hasDueSoonSendForDate(digest.today))) {
      return Response.json({
        data: { sent: false, reason: "already_sent", today: digest.today, itemCount: digest.items.length },
      });
    }

    const subscriptions = await listPushSubscriptions();
    if (subscriptions.length === 0) {
      return Response.json({
        data: { sent: false, reason: "no_subscriptions", today: digest.today, itemCount: digest.items.length },
      });
    }

    let ok = 0;
    let gone = 0;
    let failed = 0;
    for (const sub of subscriptions) {
      const result = await sendWebPush(sub, {
        title: digest.title,
        message: digest.body,
        url: "/movements",
      });
      if (result === "ok") ok += 1;
      else if (result === "gone") gone += 1;
      else failed += 1;
    }

    if (ok > 0 && !force) {
      await recordDueSoonSend(digest.today, digest.hash);
    } else if (ok > 0 && force) {
      // force re-send: still record if not already
      if (!(await hasDueSoonSendForDate(digest.today))) {
        await recordDueSoonSend(digest.today, digest.hash);
      }
    }

    return Response.json({
      data: {
        sent: ok > 0,
        today: digest.today,
        itemCount: digest.items.length,
        title: digest.title,
        results: { ok, gone, failed },
      },
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unexpected error", 500);
  }
}
