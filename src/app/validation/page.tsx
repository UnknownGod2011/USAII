"use client";

import { DotFieldBackground } from "@/components/animations/DotFieldBackground";
import { Nav } from "@/components/Nav";
import type { EvidenceScore, FounderIntake, IdeaRevision } from "@/lib/intake/schema";
import { ArrowRight, Check, RefreshCw, ShieldAlert, Sparkles } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

const stages = ["Researching live sources", "Reviewing search results", "Checking competitor pages", "Evaluating evidence", "Mapping risks", "Preparing your Launch Brief"];
const verdictLabel: Record<EvidenceScore["verdict"], string> = {
  strong: "Strong enough for a focused pilot",
  promising_needs_modification: "Promising with a sharper first version",
  weak: "Weak in its current form",
  reject: "Do not build this version yet",
};

function ValidationContent() {
  const router = useRouter();
  const params = useSearchParams();
  const ideaId = params.get("ideaId") || "";
  const [intake, setIntake] = useState<FounderIntake | null>(null);
  const [evidence, setEvidence] = useState<EvidenceScore | null>(null);
  const [revisions, setRevisions] = useState<IdeaRevision[]>([]);
  const [stage, setStage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState("");
  const [customIdea, setCustomIdea] = useState("");
  const [customUser, setCustomUser] = useState("");
  const [customProblem, setCustomProblem] = useState("");

  async function research(nextIntake: FounderIntake) {
    setLoading(true); setEvidence(null); setError(""); setStage(0);
    const timer = window.setInterval(() => setStage((value) => Math.min(stages.length - 1, value + 1)), 1100);
    try {
      const response = await fetch("/api/research", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ intake: nextIntake, startupIdeaId: ideaId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Validation failed.");
      setIntake(nextIntake); setEvidence(data.evidence); setRevisions(data.revisions || []);
      setCustomIdea(nextIntake.rawIdea); setCustomUser(nextIntake.targetUser); setCustomProblem(nextIntake.problem);
      localStorage.setItem("launchpilot-intake", JSON.stringify(nextIntake));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Validation failed. Please retry.");
    } finally {
      window.clearInterval(timer); setStage(stages.length - 1); setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      async function restoreValidation() {
        if (!ideaId) {
          setError("Your saved interview could not be found. Please complete the interview again.");
          setLoading(false);
          return;
        }
        const saved = localStorage.getItem("launchpilot-intake");
        if (saved) {
          const parsed = JSON.parse(saved) as FounderIntake;
          setIntake(parsed);
          await research(parsed);
          return;
        }
        const response = await fetch(`/api/projects/${encodeURIComponent(ideaId)}`);
        const data = await response.json();
        if (!response.ok || !data.intake) {
          setError(data.error || "Your saved interview could not be found. Please complete the interview again.");
          setLoading(false);
          return;
        }
        const restored = data.intake as FounderIntake;
        setIntake(restored);
        setCustomIdea(restored.rawIdea);
        setCustomUser(restored.targetUser);
        setCustomProblem(restored.problem);
        localStorage.setItem("launchpilot-intake", JSON.stringify(restored));
        if (data.evidence) {
          setEvidence(data.evidence as EvidenceScore);
          setRevisions(data.revisions || []);
          setStage(stages.length - 1);
          setLoading(false);
          return;
        }
        await research(restored);
      }
      void restoreValidation().catch(() => {
        setError("Your saved interview could not be found. Please complete the interview again.");
        setLoading(false);
      });
    }, 0);
    return () => window.clearTimeout(timer);
    // research intentionally runs once for the saved interview on entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ideaId]);

  async function applyRevision(revision: IdeaRevision) {
    if (!intake) return;
    await research({ ...intake, rawIdea: revision.improvedIdea, targetUser: revision.targetUser, problem: revision.problem });
  }
  async function useCustom() {
    if (!intake || customIdea.trim().length < 12 || customUser.trim().length < 4 || customProblem.trim().length < 10) {
      setError("Add a clear idea, specific first user, and concrete problem before validating this refinement.");
      return;
    }
    await research({ ...intake, rawIdea: customIdea.trim(), targetUser: customUser.trim(), problem: customProblem.trim() });
  }
  async function approve() {
    if (!evidence || !intake) return;
    setApproving(true); setError("");
    const response = await fetch("/api/research/approve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ startupIdeaId: ideaId, confirmed: true }) });
    const data = await response.json();
    if (!response.ok) { setError(data.error || "Could not prepare your workspace."); setApproving(false); return; }
    router.push(`/dashboard?projectId=${encodeURIComponent(ideaId)}`);
  }
  const weak = evidence && evidence.verdict !== "strong";
  const canProceedDirectly = Boolean(evidence && evidence.score >= 70);
  const dimensions = useMemo(() => evidence ? [
    ["Problem clarity", evidence.breakdown.problemPainClarity, 20],
    ["Target user", evidence.breakdown.targetUserSharpness, 15],
    ["Demand evidence", evidence.breakdown.demandEvidence, 20],
    ["Competitor evidence", evidence.breakdown.competitorGap, 15],
    ["Feasibility", evidence.breakdown.feasibility, 15],
  ] as const : [], [evidence]);

  return (
    <main className="relative min-h-screen bg-black text-white">
      <DotFieldBackground variant="calm" bulgeStrength={30} />
      <div className="page-content relative z-10"><Nav />
        <section className="mx-auto max-w-6xl px-5 pb-16 pt-6">
          {loading ? (
            <div className="mx-auto max-w-3xl terminal-card p-7 md:p-10">
              <p className="mono-label">Idea validation</p>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight">Validating your direction</h1>
              <p className="mt-3 text-sm leading-6 text-lp-muted">LaunchPilot is checking the idea against live evidence, founder constraints, and the strength of your current proof.</p>
              <div className="mt-8 space-y-4">
                {stages.map((label, index) => <div key={label} className="flex items-center gap-3 border-b border-white/10 pb-4">
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs ${index < stage ? "border-emerald-400/60 bg-emerald-400/10 text-emerald-300" : index === stage ? "border-white/70 text-white" : "border-white/15 text-white/30"}`}>{index < stage ? <Check className="h-3.5 w-3.5" /> : index + 1}</span>
                  <span className={index <= stage ? "text-white" : "text-white/35"}>{label}</span>
                </div>)}
              </div>
            </div>
          ) : error && !evidence ? (
            <div className="mx-auto max-w-xl terminal-card p-8 text-center"><ShieldAlert className="mx-auto h-7 w-7 text-amber-300" /><h1 className="mt-4 text-2xl font-semibold">Validation needs another pass</h1><p className="mt-3 text-sm text-lp-muted">{error}</p><button onClick={() => intake && research(intake)} className="btn-primary mt-6"><RefreshCw className="h-4 w-4" /> Retry validation</button></div>
          ) : evidence && intake ? (
            <div className="space-y-6">
              <header className="grid gap-6 lg:grid-cols-[1fr_260px]">
                <div><p className="mono-label">Evidence verdict</p><h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight md:text-5xl">{verdictLabel[evidence.verdict]}</h1><p className="mt-4 max-w-3xl text-base leading-7 text-lp-muted">{evidence.reasoning}</p></div>
                <div className="terminal-card flex items-center justify-center p-7 text-center"><div><p className="mono-label">Evidence score</p><p className="mt-2 text-6xl font-semibold">{evidence.score}</p><p className="mt-1 text-xs text-lp-subtle">out of 100</p></div></div>
              </header>
              <section className="terminal-card grid gap-6 p-6 lg:grid-cols-2">
                <div><p className="mono-label">Final direction under review</p><h2 className="mt-3 text-xl font-semibold">{intake.rawIdea}</h2><p className="mt-4 text-sm leading-6 text-lp-muted"><span className="text-white">First user:</span> {intake.targetUser}</p><p className="mt-2 text-sm leading-6 text-lp-muted"><span className="text-white">Problem:</span> {intake.problem}</p></div>
                <div className="space-y-4"><div><p className="mono-label">Strongest signal</p><p className="mt-2 text-sm leading-6 text-white">{evidence.strongestSignal}</p></div><div><p className="mono-label">Weakest signal</p><p className="mt-2 text-sm leading-6 text-white">{evidence.weakestSignal}</p></div><div><p className="mono-label">Next validation step</p><p className="mt-2 text-sm leading-6 text-white">{evidence.nextValidationStep}</p></div></div>
              </section>
              <section className="terminal-card p-6"><p className="mono-label">Scoring dimensions</p><div className="mt-5 grid gap-4 md:grid-cols-2">{dimensions.map(([label, value, max]) => <div key={label}><div className="flex justify-between text-sm"><span>{label}</span><span className="text-lp-muted">{value}/{max}</span></div><div className="mt-2 h-1.5 bg-white/10"><div className="h-full bg-white/75" style={{ width: `${value / max * 100}%` }} /></div></div>)}</div>{evidence.scoreCapReason && <p className="mt-5 text-xs leading-5 text-amber-200/80">{evidence.scoreCapReason}</p>}</section>
              <section className="terminal-card flex flex-col items-start justify-between gap-5 p-6 md:flex-row md:items-center">
                <div>
                  <p className="mono-label">Ready for the workspace</p>
                  <h2 className="mt-2 text-xl font-semibold">
                    {canProceedDirectly
                      ? "This direction has enough evidence to continue into in-depth market research."
                      : "You can continue with the current direction while keeping its unresolved risks visible."}
                  </h2>
                  {!canProceedDirectly && <p className="mt-2 max-w-2xl text-sm leading-6 text-amber-200/80">The score is below 70. Continue only if you are comfortable validating the weakest assumptions before investing heavily.</p>}
                  {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
                </div>
                <button onClick={approve} disabled={approving} className="btn-primary shrink-0">
                  {approving ? "Preparing Launch Brief…" : canProceedDirectly ? "Run In-Depth Market Research" : "Continue with current idea anyway"} <ArrowRight className="h-4 w-4" />
                </button>
              </section>
              {weak && <section className="terminal-card p-6"><div className="flex items-center gap-2"><Sparkles className="h-5 w-5" /><h2 className="text-xl font-semibold">Optional sharper directions</h2></div><p className="mt-2 text-sm text-lp-muted">These refinements may improve focus, but they are optional. You can use one, edit your own, or continue with the current validated direction above.</p><div className="mt-5 divide-y divide-white/10">{revisions.map((revision) => <article key={revision.improvedIdea} className="py-5"><h3 className="font-semibold">{revision.improvedIdea}</h3><div className="mt-3 grid gap-3 text-sm text-lp-muted md:grid-cols-2"><p><span className="text-white">Refined user:</span> {revision.targetUser}</p><p><span className="text-white">Refined problem:</span> {revision.problem}</p><p><span className="text-white">Why stronger:</span> {revision.whyStronger}</p><p><span className="text-white">Remaining risk:</span> {revision.remainingRisk}</p></div><button onClick={() => applyRevision(revision)} className="btn-secondary mt-4">Use and validate this refinement</button></article>)}</div>
                <div className="mt-6 border-t border-white/10 pt-6"><p className="mono-label">Refine it yourself</p><div className="mt-4 grid gap-3"><textarea className="input-field min-h-24" value={customIdea} onChange={(event) => setCustomIdea(event.target.value)} aria-label="Refined idea" /><input className="input-field" value={customUser} onChange={(event) => setCustomUser(event.target.value)} aria-label="Refined target user" /><textarea className="input-field min-h-20" value={customProblem} onChange={(event) => setCustomProblem(event.target.value)} aria-label="Refined problem" /></div><button onClick={useCustom} className="btn-secondary mt-4">Validate my refinement</button></div>
              </section>}
              <section className="terminal-card p-6"><p className="mono-label">Source confidence</p><div className="mt-4 grid gap-3 md:grid-cols-2">{evidence.sources.slice(0, 10).map((source) => source.url ? <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="border border-white/10 p-4 hover:border-white/30"><div className="flex justify-between gap-3"><span className="text-sm font-medium">{source.title}</span><span className="font-mono text-[10px] uppercase text-lp-subtle">{source.confidence}</span></div><p className="mt-2 text-xs leading-5 text-lp-muted">{source.limitation}</p></a> : <div key={source.title} className="border border-white/10 p-4"><p className="text-sm">{source.snippet}</p></div>)}</div></section>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
export default function ValidationPage() {
  return <Suspense fallback={<main className="min-h-screen bg-black" />}><ValidationContent /></Suspense>;
}
