import { getVapidPublicKey } from "@/shared/lib/web-push";
import { jsonError } from "@/shared/lib/api";

export async function GET() {
  const publicKey = getVapidPublicKey();
  if (!publicKey) {
    return jsonError("VAPID public key not configured", 503);
  }
  return Response.json({ data: { publicKey } });
}
