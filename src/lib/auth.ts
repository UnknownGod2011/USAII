import { cookies } from "next/headers";
import { getDb } from "./db";
import { readSessionToken, SESSION_COOKIE } from "./session";
export { createSessionToken, SESSION_COOKIE } from "./session";

export type SessionUser = { id: string; name: string; email: string };

export async function getSessionUser() {
  const session = readSessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) return null;
  try {
    const user = await getDb().user.findUnique({ where: { id: session.userId } });
    if (user) return user;
  } catch {
    // Production deployments may use Blob persistence instead of Prisma.
  }
  return {
    id: session.userId,
    name: session.name || session.email?.split("@")[0] || "Founder",
    email: session.email || `${session.userId}@launchpilot.local`,
  } satisfies SessionUser;
}
export async function requireSessionUser() {
  const user = await getSessionUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}
export async function getOrCreateUser(name?: string, email?: string) {
  const safeEmail = email?.trim().toLowerCase() || "founder@launchpilot.local";
  const safeName = name?.trim() || safeEmail.split("@")[0] || "Founder";
  try {
    return await getDb().user.upsert({ where: { email: safeEmail }, update: { name: safeName }, create: { name: safeName, email: safeEmail } });
  } catch {
    return { id: safeEmail.replace(/[^a-z0-9]+/gi, "_").toLowerCase(), name: safeName, email: safeEmail } satisfies SessionUser;
  }
}

export async function getOrCreateUserWithId(user: SessionUser) {
  try {
    const existing = await getDb().user.findUnique({ where: { email: user.email } });
    if (existing) return getDb().user.update({ where: { id: existing.id }, data: { name: user.name } });
    return await getDb().user.create({ data: { id: user.id, name: user.name, email: user.email } });
  } catch {
    return user;
  }
}
