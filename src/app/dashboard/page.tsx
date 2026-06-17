"use client";

import { LaunchBriefView } from "@/components/LaunchBriefView";
import { Nav } from "@/components/Nav";
import { generateLaunchBrief } from "@/lib/agents";
import { demoProfile } from "@/lib/seed";
import type { LaunchBrief } from "@/lib/types";
import { useEffect, useState } from "react";

export default function DashboardPage() {
  const [brief, setBrief] = useState<LaunchBrief | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => {
      const saved = localStorage.getItem("launchpilot-brief");
      if (saved) {
        setBrief(JSON.parse(saved));
        return;
      }
      const generated = generateLaunchBrief(demoProfile);
      localStorage.setItem("launchpilot-brief", JSON.stringify(generated));
      setBrief(generated);
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <main className="shell-bg min-h-screen">
      <Nav />
      <section className="mx-auto max-w-7xl px-5 pb-10">
        {brief ? (
          <>
            <div className="mb-5 glass rounded-[28px] p-6">
              <p className="mono-label">Finalized startup workspace</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-50">
                {brief.profile.startupName && brief.profile.startupName !== "Untitled startup"
                  ? brief.profile.startupName
                  : brief.refinedIdea.split(".")[0]}
              </h1>
              <p className="mt-3 text-sm leading-6 text-lp-muted">
                Agents initialized: Lead Research, Competitor, Pain Point, Opportunity, Skill Gap, and Source Quality.
              </p>
            </div>
            <LaunchBriefView brief={brief} />
          </>
        ) : (
          <div className="glass rounded-[28px] p-6">
            <p className="mono-label">Launch Brief Workspace</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-50">Preparing your founder workspace...</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-lp-muted">
              Loading saved context, agent outputs, sources, roadmap, and responsible AI notes.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
