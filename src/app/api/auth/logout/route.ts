import { NextResponse } from "next/server";

import { clearSessionCookie } from "@/shared/lib/auth";

export async function POST() {
  const response = NextResponse.json({ data: { success: true } });
  clearSessionCookie(response);
  return response;
}
