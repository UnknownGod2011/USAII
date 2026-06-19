"use client";

import SideRays from "@/components/animations/SideRays";
import { LaunchBriefView } from "@/components/LaunchBriefView";
import { Nav } from "@/components/Nav";
import type { LaunchBrief } from "@/lib/types";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

function DashboardContent() {
  const projectId = useSearchParams().get("projectId");
  const [brief, setBrief] = useState<LaunchBrief | null>(null);
  const [error, setError] = useState("");
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const url = projectId ? `/api/workspace?projectId=${encodeURIComponent(projectId)}` : "/api/workspace";
    async function loadAndBuild() {
      try {
        const response = await fetch(url);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load your workspace.");
        if (cancelled) return;
        setBrief(data.brief);
        const needsBuild = data.idea?.status === "approved_building" || data.brief?.agents?.some((agent: { status?: string }) => agent.status?.toLowerCase() !== "complete");
        if (!needsBuild) return;
        setBuilding(true);
        let currentBrief = data.brief as LaunchBrief;
        for (let index = 0; index < 8; index += 1) {
          if (cancelled) return;
          const nextAgent = currentBrief.agents.find((agent) => agent.status?.toLowerCase() !== "complete");
          setActiveAgent(nextAgent?.name || null);
          const buildResponse = await fetch("/api/workspace/build", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ projectId }),
          });
          const buildData = await buildResponse.json();
          if (!buildResponse.ok) throw new Error(buildData.error || "Could not build agent output.");
          currentBrief = buildData.brief;
          if (cancelled) return;
          setBrief(currentBrief);
          if (buildData.complete) break;
          await wait(1000);
        }
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Could not load your workspace.");
      } finally {
        if (!cancelled) {
          setActiveAgent(null);
          setBuilding(false);
        }
      }
    }
    void loadAndBuild();
    return () => { cancelled = true; };
  }, [projectId]);
  return (
    <main className="shell-bg relative min-h-screen text-white">
      <div className="absolute inset-0 -z-10"><SideRays rayColor1="#444441" rayColor2="#888780" origin="top-right" intensity={1.5} spread={2} opacity={0.5} /></div>
      <div className="relative z-[1]"><Nav />
        <section className="mx-auto max-w-[1500px] px-5 pb-16 pt-6">
          {!brief && !error && <div className="terminal-card mx-auto max-w-2xl p-8"><p className="mono-label">Preparing your Launch Brief</p><h1 className="mt-3 text-3xl font-semibold">Agents are assembling the evidence-backed workspace.</h1><div className="mt-6 space-y-3 font-mono text-xs text-lp-muted">{["Reading finalized founder context", "Loading completed research", "Mapping competitors and risks", "Building roadmap and pitch assets"].map((line) => <p key={line}>› {line}</p>)}</div></div>}
          {error && <div className="terminal-card mx-auto max-w-xl p-8 text-center"><h1 className="text-2xl font-semibold">Workspace unavailable</h1><p className="mt-3 text-sm text-lp-muted">{error}</p><Link href="/start" className="btn-primary mt-6 inline-flex">Start an interview</Link></div>}
          {brief && <LaunchBriefView brief={brief} startupIdeaId={projectId} activeAgent={activeAgent} building={building} />}
        </section>
      </div>
    </main>
  );
}
export default function DashboardPage() {
  return <Suspense fallback={<main className="min-h-screen bg-black" />}><DashboardContent /></Suspense>;
}
