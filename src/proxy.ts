import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "launchpilot_session";

const protectedPrefixes = [
  "/start",
  "/interview",
  "/interview-chat",
  "/interview-voice",
  "/validation",
  "/dashboard",
  "/profile",
  "/projects",
  "/settings",
  "/research",
  "/scoring",
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  if (!isProtected || request.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
