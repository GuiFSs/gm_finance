import { NextRequest, NextResponse } from "next/server";

import { verifySessionToken } from "@/shared/lib/auth";
import { SESSION_COOKIE_NAME } from "@/shared/lib/constants";

const PUBLIC_ROUTES = ["/login", "/api/auth/login", "/api/auth/users"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    return NextResponse.next();
  }

  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const session = await verifySessionToken(token);
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/auth/logout).*)"],
};
