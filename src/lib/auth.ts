import { cookies } from "next/headers";
import { getDb } from "./db";
import { readSessionToken, SESSION_COOKIE } from "./session";
export { createSessionToken, readSessionToken, SESSION_COOKIE } from "./session";
const DEMO_EMAIL = "demo@launchpilot.local";

export async function getSessionUser() {
  const store = await cookies();
  const session = readSessionToken(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  return getDb().user.findUnique({ where: { id: session.userId } });
}

export async function requireSessionUser() {
  const user = await getSessionUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}

export async function getOrCreateDemoUser(name?: string, email?: string) {
  const safeEmail = email?.trim().toLowerCase() || DEMO_EMAIL;
  return getDb().user.upsert({
    where: { email: safeEmail },
    update: { name: name?.trim() || "Demo Founder" },
    create: { name: name?.trim() || "Demo Founder", email: safeEmail },
  });
}
