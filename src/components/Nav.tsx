"use client";

import Link from "next/link";
import { Compass } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function Nav() {
  const router = useRouter();
  const [user, setUser] = useState<{ name: string } | null>(null);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((response) => response.json())
      .then((data) => setUser(data.user))
      .catch(() => setUser(null));
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    localStorage.removeItem("launchpilot-user");
    setUser(null);
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-4">
      <Link href="/" className="flex items-center gap-3 text-sm font-semibold tracking-wide text-stone-950">
        <span className="orb flex h-9 w-9 items-center justify-center rounded-full">
          <Compass className="h-4 w-4 text-white" />
        </span>
        <span className="text-2xl font-semibold tracking-tight">LaunchPilot</span>
      </Link>
      <nav className="hidden items-center gap-2 text-sm text-stone-700 md:flex">
        <Link className="rounded-full px-3 py-2 hover:bg-white/80" href="/dashboard">
          Workspace
        </Link>
        <Link className="rounded-full px-3 py-2 hover:bg-white/80" href="/profile">
          Profile
        </Link>
        <Link className="rounded-full px-3 py-2 hover:bg-white/80" href="/settings">
          Privacy
        </Link>
        {user ? (
          <button className="rounded-full border border-stone-200 bg-white/70 px-4 py-2 font-medium shadow-sm hover:bg-white" onClick={logout}>
            Log out
          </button>
        ) : (
          <Link className="rounded-full border border-stone-200 bg-white/70 px-4 py-2 font-medium shadow-sm hover:bg-white" href="/login">
            Sign in
          </Link>
        )}
      </nav>
    </header>
  );
}
