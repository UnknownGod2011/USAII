import Link from "next/link";
import { Compass } from "lucide-react";

export function Nav() {
  return (
    <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-4">
      <Link href="/" className="flex items-center gap-3 text-sm font-semibold tracking-wide text-stone-100">
        <span className="orb flex h-9 w-9 items-center justify-center rounded-full">
          <Compass className="h-4 w-4 text-white" />
        </span>
        <span className="text-2xl font-semibold tracking-tight">LaunchPilot</span>
      </Link>
      <nav className="hidden items-center gap-1 font-mono text-xs uppercase tracking-wider text-lp-muted md:flex">
        <Link className="rounded-full px-3 py-2 hover:bg-white/5 hover:text-stone-200" href="/dashboard">
          Workspace
        </Link>
        <Link className="rounded-full px-3 py-2 hover:bg-white/5 hover:text-stone-200" href="/profile">
          Profile
        </Link>
        <Link className="rounded-full px-3 py-2 hover:bg-white/5 hover:text-stone-200" href="/settings">
          Privacy
        </Link>
        <Link className="btn-accent ml-2 px-4 py-2 text-xs" href="/login">
          Sign in
        </Link>
      </nav>
    </header>
  );
}
