import { createSessionToken, getOrCreateDemoUser, SESSION_COOKIE } from "@/lib/auth";
import { NextResponse } from "next/server";
import { z } from "zod";

const LoginSchema = z.object({
  name: z.string().trim().max(80).optional(),
  email: z.string().trim().email().optional().or(z.literal("")),
});

export async function POST(request: Request) {
  const parsed = LoginSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  const user = await getOrCreateDemoUser(parsed.data.name, parsed.data.email);
  const response = NextResponse.json({ user: { id: user.id, name: user.name, email: user.email } });
  const forwardedProtocol = request.headers.get("x-forwarded-proto");
  const secure = forwardedProtocol ? forwardedProtocol === "https" : new URL(request.url).protocol === "https:";
  response.cookies.set(SESSION_COOKIE, createSessionToken(user.id), {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });
  return response;
}
