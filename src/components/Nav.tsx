"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { NavUserMenu } from "@/components/profile/NavUserMenu";
import { getStoredUser } from "@/lib/auth-session";
import { useLayoutEffect, useState } from "react";

const SECTION_LINKS = [
  { label: "About", hash: "about" },
  { label: "How it works", hash: "how-it-works" },
  { label: "Safety", hash: "safety" },
] as const;

export function Nav() {
  const router = useRouter();
  const pathname = usePathname();
  const [signedIn, setSignedIn] = useState(false);
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const sync = () => {
      setSignedIn(!!getStoredUser());
      setReady(true);
    };

    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("launchpilot-auth-change", sync);
    window.addEventListener("launchpilot-profile-change", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("launchpilot-auth-change", sync);
      window.removeEventListener("launchpilot-profile-change", sync);
    };
  }, []);

  function handleSectionNav(hash: string) {
    if (pathname === "/") {
      const target = document.getElementById(hash);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        window.history.replaceState(null, "", `#${hash}`);
      }
      return;
    }
    router.push(`/#${hash}`);
  }

  const isLanding = pathname === "/";

  return (
    <header
      className={`z-50 mx-auto flex w-full max-w-7xl items-center justify-between border-b border-white/10 px-5 py-4 ${
        isLanding ? "sticky top-0 bg-black/90 backdrop-blur-md" : "relative"
      }`}
    >
      <Link href="/" className="nav-logo flex items-center gap-3 text-white no-underline">
        <Logo size={28} className="shrink-0" />
        <span className="font-mono text-sm font-medium tracking-wide">LaunchPilot AI</span>
      </Link>
      <nav className="flex items-center gap-1 font-mono text-xs uppercase tracking-wider text-lp-muted">
        <div className="hidden items-center gap-1 md:flex">
          {SECTION_LINKS.map(({ label, hash }) => (
            <button
              key={hash}
              type="button"
              className="px-3 py-2 hover:text-white"
              onClick={() => handleSectionNav(hash)}
            >
              {label}
            </button>
          ))}
          <Link className="px-3 py-2 hover:text-white" href="/dashboard">
            Workspace
          </Link>
          <Link className="px-3 py-2 hover:text-white" href="/projects">
            Projects
          </Link>
          <Link className="px-3 py-2 hover:text-white" href="/profile">
            Profile
          </Link>
          <Link className="px-3 py-2 hover:text-white" href="/settings">
            Privacy
          </Link>
        </div>
        {ready && signedIn ? (
          <NavUserMenu />
        ) : ready ? (
          <Link className="btn-secondary ml-2 px-4 py-2 text-xs" href="/login">
            Sign in
          </Link>
        ) : (
          <span className="btn-secondary ml-2 px-4 py-2 text-xs opacity-0" aria-hidden>
            Sign in
          </span>
        )}
      </nav>
    </header>
  );
}
