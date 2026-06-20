export type DemoUser = {
  id?: string;
  email?: string;
  name?: string;
  avatarUrl?: string | null;
  mode?: string;
};

export function getStoredUser(): DemoUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("launchpilot-user");
    if (!raw) return null;
    return JSON.parse(raw) as DemoUser;
  } catch {
    return null;
  }
}

export function getUserId(user?: DemoUser | null): string | null {
  const email = user?.email?.trim().toLowerCase();
  if (!email) return null;
  return email.replace(/@/g, "_at_").replace(/\./g, "_");
}

export function getCurrentUserId(): string | null {
  return getUserId(getStoredUser());
}

export function getUserLabel(user: DemoUser): string {
  if (user.name?.trim()) return user.name.trim();
  if (user.email?.trim()) return user.email.split("@")[0];
  return "Founder";
}

export function getUserEmail(user: DemoUser): string {
  return user.email?.trim() || "founder@demo.local";
}

export function clearStoredUser(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("launchpilot-user");
}

const LOCAL_DATA_KEYS = [
  "launchpilot-user",
  "launchpilot-profile",
  "launchpilot-brief",
  "launchpilot-interview",
  "launchpilot-interview-state",
] as const;

export function clearLaunchPilotLocalData(): void {
  if (typeof window === "undefined") return;
  for (const key of LOCAL_DATA_KEYS) {
    localStorage.removeItem(key);
  }
}

export function updateStoredUserName(name: string): void {
  if (typeof window === "undefined") return;
  const user = getStoredUser();
  if (!user) return;
  localStorage.setItem("launchpilot-user", JSON.stringify({ ...user, name: name.trim() }));
  window.dispatchEvent(new Event("launchpilot-auth-change"));
}
