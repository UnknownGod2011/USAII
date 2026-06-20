import { createHmac, timingSafeEqual } from "node:crypto";
export const SESSION_COOKIE = "launchpilot_session";
const secret = () => process.env.AUTH_SECRET || "launchpilot-local-secret";
const sign = (value: string) => createHmac("sha256", secret()).update(value).digest("base64url");
export type LaunchPilotSession = { userId: string; email?: string; name?: string; expiresAt: number };
export function createSessionToken(userId: string, user?: { email?: string | null; name?: string | null }) {
  const payload = Buffer.from(JSON.stringify({
    userId,
    email: user?.email || undefined,
    name: user?.name || undefined,
    expiresAt: Date.now() + 604_800_000,
  })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}
export function readSessionToken(token?: string | null) {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload);
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as LaunchPilotSession;
    return parsed.expiresAt > Date.now() ? parsed : null;
  } catch { return null; }
}
