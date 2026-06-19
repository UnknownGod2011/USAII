import { NextRequest, NextResponse } from "next/server";
import { readSessionToken, SESSION_COOKIE } from "./lib/session";

const protectedPrefixes = ["/start", "/interview", "/research", "/dashboard", "/profile", "/settings"];

export function proxy(request: NextRequest) {
  const protectedRoute = protectedPrefixes.some((prefix) => request.nextUrl.pathname.startsWith(prefix));
  if (!protectedRoute) return NextResponse.next();
  if (readSessionToken(request.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();
  const login = new URL("/login", request.url);
  login.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/start/:path*", "/interview/:path*", "/interview-chat/:path*", "/interview-voice/:path*", "/research/:path*", "/dashboard/:path*", "/profile/:path*", "/settings/:path*"],
};
