"use client";

import { Nav } from "@/components/Nav";
import { UserAvatar } from "@/components/profile/UserAvatar";
import { clearStoredUser } from "@/lib/auth-session";
import { firebaseAuth } from "@/lib/firebase";
import type { NormalizedFounderBrief } from "@/lib/brief/normalize";
import { signOut } from "firebase/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type ProfileData = {
  user?: { name: string; email: string };
  hasProfile: boolean;
  message?: string;
  founder?: {
    name: string;
    location: string;
    status: string;
    hoursPerWeek: number;
    budget: string;
    skills: string[];
    teamStatus: string;
    stage: string;
    evidenceLevel: string;
    alternatives: string;
    thirtyDayGoal: string;
    openToModification: boolean;
  };
  idea?: {
    id: string;
    status: string;
    rawIdea: string;
    finalizedIdea: string;
    targetUser: string;
    problemStatement: string;
    workspaceHref: string;
    validationHref: string;
  };
  validation?: {
    status: string;
    evidenceScore: number;
    verdict: string;
    strongestSignal: string;
    weakestSignal: string;
    currentBottleneck: string;
    nextValidationStep: string;
    updatedAt: string;
  };
  normalizedBrief?: NormalizedFounderBrief;
  workspaceReady?: boolean;
};

function Field({ label, value }: { label: string; value?: string | number | boolean | string[] }) {
  const display = Array.isArray(value) ? value.join(", ") : typeof value === "boolean" ? (value ? "Yes" : "No") : value;
  return (
    <div className="border border-white/10 bg-white/[0.025] p-4">
      <p className="mono-label">{label}</p>
      <p className="mt-2 text-sm leading-6 text-white">{display || "Not captured yet"}</p>
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const [data, setData] = useState<ProfileData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/profile");
        const profile = await response.json();
        if (!response.ok) throw new Error(profile.error || "Could not load profile.");
        if (!cancelled) setData(profile);
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Could not load profile.");
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  async function handleSignOut() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    await signOut(firebaseAuth).catch(() => undefined);
    clearStoredUser();
    window.dispatchEvent(new Event("launchpilot-auth-change"));
    router.push("/login");
  }

  const workspaceStateTitle = data?.workspaceReady
    ? "Launch Brief is ready"
    : data?.idea && ["approved", "approved_building"].includes(data.idea.status)
      ? "Agents are preparing the Launch Brief"
      : data?.validation
        ? "Validation complete; workspace not started yet"
        : "Interview saved; validation not complete yet";

  return (
    <main className="shell-bg min-h-screen text-white">
      <Nav />
      <section className="mx-auto max-w-6xl px-5 py-8 pb-16">
        {!data && !error && (
          <div className="terminal-card p-8">
            <p className="mono-label">Founder profile</p>
            <h1 className="mt-3 text-3xl font-semibold">Loading your Founder Snapshot.</h1>
          </div>
        )}

        {error && (
          <div className="terminal-card mx-auto max-w-xl p-8 text-center">
            <h1 className="text-2xl font-semibold">Profile unavailable</h1>
            <p className="mt-3 text-sm text-lp-muted">{error}</p>
            <Link href="/login" className="btn-primary mt-6">Sign in</Link>
          </div>
        )}

        {data && !data.hasProfile && (
          <div className="terminal-card mx-auto max-w-2xl p-8">
            <p className="mono-label">Founder Snapshot</p>
            <h1 className="mt-3 text-3xl font-semibold">No interview data yet.</h1>
            <p className="mt-3 text-sm leading-6 text-lp-muted">{data.message}</p>
            <Link href="/start" className="btn-primary mt-6">Start interview</Link>
          </div>
        )}

        {data?.hasProfile && data.founder && data.normalizedBrief && (
          <div className="space-y-6">
            <header className="terminal-card p-6 md:p-8">
              <div className="flex flex-wrap items-start justify-between gap-6">
                <div className="flex items-center gap-4">
                  <UserAvatar name={data.founder.name || data.user?.name || "Founder"} avatarUrl={undefined} />
                  <div>
                    <p className="mono-label">Founder Snapshot</p>
                    <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-5xl">{data.founder.name}</h1>
                    <p className="mt-2 text-sm text-lp-muted">{data.user?.email}</p>
                  </div>
                </div>
                <button type="button" className="btn-secondary text-xs" onClick={handleSignOut}>Sign out</button>
              </div>
              <div className="mt-8 grid gap-4 md:grid-cols-4">
                <Field label="Location" value={data.founder.location} />
                <Field label="Status" value={data.founder.status} />
                <Field label="Hours / week" value={data.founder.hoursPerWeek} />
                <Field label="Budget" value={data.founder.budget} />
              </div>
            </header>

            <section className="terminal-card p-6 md:p-8">
              <p className="mono-label">Current direction</p>
              <div className="mt-4 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
                <div>
                  <h2 className="text-3xl font-semibold tracking-tight">{data.normalizedBrief.cleanStartupTitle}</h2>
                  <p className="mt-4 max-w-3xl text-base leading-7 text-lp-muted">{data.normalizedBrief.oneLineIdea}</p>
                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    <Field label="Raw idea captured" value={data.idea?.rawIdea} />
                    <Field label="Final / refined idea" value={data.normalizedBrief.refinedIdea} />
                    <Field label="Target user" value={data.normalizedBrief.targetUserSegment} />
                    <Field label="Problem statement" value={data.normalizedBrief.problemStatement} />
                  </div>
                </div>
                <div className="space-y-4">
                  <Field label="Stage" value={data.founder.stage} />
                  <Field label="Evidence / proof" value={data.founder.evidenceLevel} />
                  <Field label="Alternatives" value={data.founder.alternatives} />
                  <Field label="Open to modification" value={data.founder.openToModification} />
                </div>
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <div className="terminal-card p-6">
                <p className="mono-label">Validation state</p>
                {data.validation ? (
                  <div className="mt-4">
                    <div className="flex items-end justify-between gap-4">
                      <div>
                        <p className="text-5xl font-semibold">{data.validation.evidenceScore}</p>
                        <p className="mt-1 text-xs text-lp-subtle">Evidence Score</p>
                      </div>
                      <span className="rounded-full border border-white/15 px-3 py-1 font-mono text-[11px] uppercase text-lp-muted">{data.validation.verdict.replaceAll("_", " ")}</span>
                    </div>
                    <div className="mt-6 grid gap-4">
                      <Field label="Strongest signal" value={data.validation.strongestSignal} />
                      <Field label="Current bottleneck" value={data.validation.currentBottleneck} />
                      <Field label="Next validation step" value={data.normalizedBrief.nextBestAction || data.validation.nextValidationStep} />
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-sm leading-6 text-lp-muted">Validation has not run yet. Complete the evidence pass to update score, verdict, and bottleneck.</p>
                )}
              </div>

              <div className="terminal-card p-6">
                <p className="mono-label">Execution profile</p>
                <div className="mt-4 grid gap-4">
                  <Field label="Skills" value={data.founder.skills} />
                  <Field label="Team status" value={data.founder.teamStatus} />
                  <Field label="30-day goal" value={data.founder.thirtyDayGoal} />
                  <Field label="First validation step" value={data.normalizedBrief.firstValidationStep} />
                </div>
              </div>
            </section>

            <section className="terminal-card flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="mono-label">Workspace state</p>
                <h2 className="mt-2 text-2xl font-semibold">{workspaceStateTitle}</h2>
                <p className="mt-2 text-sm leading-6 text-lp-muted">Profile, dashboard, Copilot, and exports now read from the same persisted founder/research/workspace records.</p>
              </div>
              {data.idea && ["approved", "approved_building"].includes(data.idea.status) ? (
                <Link href={data.idea.workspaceHref} className="btn-primary shrink-0">Open workspace</Link>
              ) : data.idea ? (
                <Link href={data.idea.validationHref} className="btn-primary shrink-0">Return to validation</Link>
              ) : (
                <Link href="/start" className="btn-primary shrink-0">Start interview</Link>
              )}
            </section>
          </div>
        )}
      </section>
    </main>
  );
}
