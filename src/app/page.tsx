import { AgentPipelineBento } from "@/components/AgentPipelineBento";
import { IconCluster } from "@/components/IconCluster";
import { Nav } from "@/components/Nav";
import { ArrowUp, CheckCircle2, FileText, Lock, Search, ShieldCheck, Sparkles, Target } from "lucide-react";
import Link from "next/link";

const stepCards = [
  {
    title: "Clarify your idea",
    body: "A warm interview turns scattered context into a founder snapshot, assumptions, and a sharper problem.",
    wide: true,
    nodes: [
      { icon: Sparkles, x: 50, y: 50, center: true, accent: true },
      { icon: Target, x: 22, y: 30 },
      { icon: FileText, x: 78, y: 35 },
      { icon: CheckCircle2, x: 30, y: 75 },
      { icon: Search, x: 72, y: 78 },
    ],
  },
  {
    title: "Research market reality",
    body: "Visible agents label competitors, opportunities, confidence, and what still needs human validation.",
    wide: false,
    nodes: [
      { icon: Search, x: 50, y: 50, center: true, accent: true },
      { icon: Target, x: 25, y: 35 },
      { icon: FileText, x: 75, y: 40 },
      { icon: ShieldCheck, x: 50, y: 80 },
    ],
  },
  {
    title: "Create your first real step",
    body: "LaunchPilot finds the current bottleneck and writes a practical 24-hour and 7-day validation plan.",
    wide: false,
    nodes: [
      { icon: CheckCircle2, x: 50, y: 50, center: true, accent: true },
      { icon: Target, x: 28, y: 68 },
      { icon: Sparkles, x: 72, y: 32 },
    ],
  },
];

export default function Home() {
  return (
    <main className="shell-bg min-h-screen">
      <Nav />

      {/* Hero */}
      <section className="mx-auto max-w-7xl px-5 pb-16 pt-8">
        <div className="mx-auto max-w-4xl text-center">
          <span className="mono-label inline-flex rounded-full border border-white/10 bg-lp-surface px-4 py-2">
            Built for student founders who need clarity before they build
          </span>
          <h1 className="mx-auto mt-7 max-w-4xl text-balance text-5xl font-semibold tracking-tight text-stone-50 md:text-7xl">
            Turn your vague idea into a real execution plan.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-xl leading-8 text-lp-muted">
            LaunchPilot AI interviews you, researches your market, maps risks, finds opportunities, and builds a practical MVP roadmap with evidence and human control.
          </p>
          <div className="mx-auto mt-9 flex max-w-3xl items-center gap-3 rounded-[28px] border border-white/10 bg-lp-surface p-3">
            <div className="min-h-24 flex-1 px-5 py-4 text-left text-lg text-lp-subtle">
              I want to validate an AI study planner for first-year engineering students...
            </div>
            <Link
              className="btn-accent flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl p-0"
              href="/login"
              aria-label="Start Founder Interview"
            >
              <ArrowUp className="h-6 w-6" />
            </Link>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link className="btn-accent" href="/login">
              Start Founder Interview <Sparkles className="h-4 w-4" />
            </Link>
            <Link className="btn-secondary" href="/dashboard?demo=1">
              Try Demo User
            </Link>
            <span className="inline-flex items-center gap-2 rounded-full px-3 py-2 font-mono text-xs uppercase tracking-wide text-lp-subtle">
              <Lock className="h-3.5 w-3.5" /> Privacy mode available
            </span>
          </div>
        </div>
      </section>

      {/* Bento grid */}
      <section className="mx-auto max-w-7xl px-5 pb-20">
        <p className="mono-label mb-6 text-center">What&apos;s inside</p>
        <div className="grid gap-4 md:grid-cols-3">
          {stepCards.map((card) => (
            <div
              key={card.title}
              className={`bento-card flex flex-col ${card.wide ? "md:col-span-2" : ""}`}
            >
              <IconCluster nodes={card.nodes} className="mb-5 min-h-[140px] flex-1" />
              <h2 className="text-lg font-semibold text-stone-100">{card.title}</h2>
              <p className="mt-2 text-sm leading-6 text-lp-muted">{card.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="bento-card md:col-span-1">
            <IconCluster
              className="mb-5 min-h-[120px]"
              nodes={[
                { icon: ShieldCheck, x: 50, y: 50, center: true, accent: true },
                { icon: Lock, x: 28, y: 35 },
                { icon: FileText, x: 72, y: 38 },
                { icon: CheckCircle2, x: 50, y: 82 },
              ]}
            />
            <p className="mono-label">Responsible AI</p>
            <h3 className="mt-2 text-lg font-semibold text-stone-100">Evidence labels, not hype</h3>
            <p className="mt-2 text-sm leading-6 text-lp-muted">
              Every claim is tagged — verified, inferred, approximate, or needs validation. No funding predictions.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {["Verified", "Inferred", "Needs validation", "Human control"].map((label) => (
                <span
                  key={label}
                  className="rounded-full border border-white/10 bg-lp-elevated px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide text-lp-subtle"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>

          <div className="md:col-span-2">
            <AgentPipelineBento />
          </div>
        </div>
      </section>
    </main>
  );
}
