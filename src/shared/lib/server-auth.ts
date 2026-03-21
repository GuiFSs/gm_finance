import { redirect } from "next/navigation";

import { getSessionFromCookies } from "@/shared/lib/auth";

export async function requireSession() {
  const session = await getSessionFromCookies();
  if (!session) {
    redirect("/login");
  }
  return session;
}
