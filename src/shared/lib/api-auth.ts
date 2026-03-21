import { getSessionFromCookies } from "@/shared/lib/auth";

export async function requireApiSession() {
  const session = await getSessionFromCookies();
  if (!session) {
    return null;
  }
  return session;
}
