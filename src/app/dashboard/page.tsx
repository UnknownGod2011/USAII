"use client";

import { briefToMarkdown, LaunchBriefView } from "@/components/LaunchBriefView";
import { Nav } from "@/components/Nav";
import type { EvidenceScore } from "@/lib/intake/schema";
import type { LaunchBrief } from "@/lib/types";
import { Download } from "lucide-react";
import { useEffect, useState } from "react";

type WorkspaceResponse = {
  idea: { name: string; finalizedIdea: string };
  brief: LaunchBrief;
  evidence: EvidenceScore;
};

export default function DashboardPage() {
  const [workspace, setWorkspace] = useState<WorkspaceResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/workspace")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setWorkspace(data);
      })
      .catch((reason) => setError(reason.message));
  }, []);

  function markdown() {
    return workspace ? briefToMarkdown(workspace.brief) : "";
  }

  function download(name: string, content: string, type: string) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = name; anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="shell-bg min-h-screen overflow-x-hidden">
      <Nav />
      <section className="mx-auto min-w-0 max-w-7xl px-5 pb-10">
        {error ? (
          <div className="glass rounded-[28px] p-8"><h1 className="text-3xl font-semibold">No approved direction yet.</h1><p className="mt-3 text-stone-600">{error} Return to the interview and complete the evidence gate.</p></div>
        ) : !workspace ? (
          <div className="glass rounded-[28px] p-8">Loading your approved Launch Brief...</div>
        ) : (
          <>
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">Approved for first-step validation</p>
                <h1 className="mt-2 text-4xl font-semibold text-stone-950">{workspace.idea.name}</h1>
                <p className="mt-2 max-w-3xl text-sm text-stone-600">LaunchPilot has approved this direction for first-step validation, not as a guarantee of success.</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => navigator.clipboard.writeText(markdown())} className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-semibold">Copy Launch Brief</button>
                <button onClick={() => download("launch-brief.md", markdown(), "text/markdown")} className="inline-flex items-center gap-2 rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white"><Download className="h-4 w-4" /> Markdown</button>
                <button onClick={() => download("launch-brief.json", JSON.stringify(workspace, null, 2), "application/json")} className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-semibold">JSON</button>
              </div>
            </div>
            <LaunchBriefView brief={workspace.brief} />
          </>
        )}
      </section>
    </main>
  );
}
