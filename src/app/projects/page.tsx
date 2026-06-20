"use client";

import { Nav } from "@/components/Nav";
import Link from "next/link";
import { useEffect, useState } from "react";

type ProjectRow = {
  id: string;
  name: string;
  status: string;
  description: string;
  targetUser: string;
  updatedAt: string;
  href: string;
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/projects");
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load projects.");
        if (!cancelled) setProjects(data.projects || []);
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Could not load projects.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  return (
    <main className="shell-bg min-h-screen text-white">
      <Nav />
      <section className="mx-auto max-w-6xl px-5 py-8 pb-16">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mono-label">Idea portfolio</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">Manage your LaunchPilot projects</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-lp-muted">
              Keep multiple startup ideas in one account. Each idea has its own intake, validation, Launch Brief, agents, Copilot context, and exports.
            </p>
          </div>
          <Link href="/start" className="btn-primary shrink-0">Start new idea</Link>
        </div>

        {loading && <div className="terminal-card mt-8 p-8 text-sm text-lp-muted">Loading projects...</div>}
        {error && <div className="terminal-card mt-8 p-8 text-sm text-red-400">{error}</div>}

        {!loading && !error && projects.length === 0 && (
          <div className="terminal-card mt-8 p-8">
            <h2 className="text-2xl font-semibold">No ideas yet</h2>
            <p className="mt-3 text-sm leading-6 text-lp-muted">Start the founder interview to create your first evidence-scored direction.</p>
            <Link href="/start" className="btn-primary mt-6 inline-flex">Create first project</Link>
          </div>
        )}

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {projects.map((project) => (
            <Link key={project.id} href={project.href} className="terminal-card group p-6 transition hover:border-white/25 hover:bg-white/[0.04]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="mono-label">{project.status.replaceAll("_", " ")}</p>
                  <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">{project.name}</h2>
                </div>
                <span className="rounded-full border border-white/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-lp-subtle group-hover:text-white">
                  Open
                </span>
              </div>
              <p className="mt-4 line-clamp-3 text-sm leading-6 text-lp-muted">{project.description}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-lp-muted">{project.targetUser || "Target user pending"}</span>
                <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-lp-muted">
                  Updated {new Date(project.updatedAt).toLocaleDateString()}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
