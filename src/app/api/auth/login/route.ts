import { createSessionToken, getOrCreateUser, getOrCreateUserWithId, SESSION_COOKIE } from "@/lib/auth";
import { NextResponse } from "next/server";
import { z } from "zod";
const LoginSchema = z.object({
  name: z.string().trim().max(80).optional(),
  email: z.string().trim().email().optional(),
  idToken: z.string().min(20).optional(),
});

async function verifyFirebaseIdToken(idToken: string) {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) throw new Error("Firebase authentication is not configured.");
  const signal = AbortSignal.timeout(10_000);
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
    signal,
  });
  if (!response.ok) throw new Error("Firebase session could not be verified.");
  const data = await response.json() as { users?: Array<{ localId?: string; email?: string; displayName?: string; photoUrl?: string }> };
  const record = data.users?.[0];
  if (!record?.localId || !record.email) throw new Error("Firebase session did not include a verified user.");
  return { id: `firebase_${record.localId}`, email: record.email.toLowerCase(), name: record.displayName || record.email.split("@")[0], avatarUrl: record.photoUrl };
}

export async function POST(request: Request) {
  try {
    const parsed = LoginSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "Enter a valid email address or use Google sign-in." }, { status: 400 });
    const firebaseUser = parsed.data.idToken ? await verifyFirebaseIdToken(parsed.data.idToken) : null;
    const firebaseConfigured = Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY);
    const demoLoginAllowed = process.env.ALLOW_DEMO_LOGIN === "true" || !firebaseConfigured;
    if (!firebaseUser && (!parsed.data.email || !demoLoginAllowed)) {
      return NextResponse.json({ error: "Use Firebase sign-in to continue." }, { status: 401 });
    }
    const user = firebaseUser ? await getOrCreateUserWithId(firebaseUser) : await getOrCreateUser(parsed.data.name, parsed.data.email);
    const response = NextResponse.json({ user: { id: user.id, name: user.name, email: user.email, avatarUrl: firebaseUser?.avatarUrl } });
    response.cookies.set(SESSION_COOKIE, createSessionToken(user.id, user), { httpOnly: true, sameSite: "lax", secure: new URL(request.url).protocol === "https:", path: "/", maxAge: 604_800 });
    return response;
  } catch (error) {
    const message = error instanceof Error && error.name === "TimeoutError"
      ? "Firebase session verification timed out. Please try again."
      : error instanceof Error
        ? error.message
        : "Could not start your session.";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
