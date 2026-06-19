import { createSessionToken, getOrCreateUser, SESSION_COOKIE } from "@/lib/auth";
import { NextResponse } from "next/server";
import { z } from "zod";
const LoginSchema = z.object({ name: z.string().trim().max(80).optional(), email: z.string().trim().email() });
export async function POST(request: Request) {
  const parsed = LoginSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  const user = await getOrCreateUser(parsed.data.name, parsed.data.email);
  const response = NextResponse.json({ user: { id: user.id, name: user.name, email: user.email } });
  response.cookies.set(SESSION_COOKIE, createSessionToken(user.id), { httpOnly: true, sameSite: "lax", secure: new URL(request.url).protocol === "https:", path: "/", maxAge: 604_800 });
  return response;
}
