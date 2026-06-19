import { cookies } from "next/headers";
import { getDb } from "./db";
import { readSessionToken, SESSION_COOKIE } from "./session";
export { createSessionToken, SESSION_COOKIE } from "./session";
export async function getSessionUser() {
  const session = readSessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  return session ? getDb().user.findUnique({ where: { id: session.userId } }) : null;
}
export async function requireSessionUser() {
  const user = await getSessionUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}
export async function getOrCreateUser(name?: string, email?: string) {
  const safeEmail = email?.trim().toLowerCase() || "founder@launchpilot.local";
  return getDb().user.upsert({ where: { email: safeEmail }, update: { name: name?.trim() || "Founder" }, create: { name: name?.trim() || "Founder", email: safeEmail } });
}
