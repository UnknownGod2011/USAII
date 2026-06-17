"use client";

import { Badge } from "@/components/Badge";
import { copilotReply } from "@/lib/agents";
import type { LaunchBrief } from "@/lib/types";
import { Download, FileText, MessageCircle, ShieldCheck, Sparkles, Target, ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";

function downloadFile(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function briefToMarkdown(brief: LaunchBrief) {
  return `# Launch Brief

## Founder Snapshot
${brief.profile.name} in ${brief.profile.location}. ${brief.profile.status}. ${brief.profile.hoursPerWeek} hours/week. Budget: ${brief.profile.budget}.

## Refined Idea
${brief.refinedIdea}

## Problem
${brief.problem}

## Target User
${brief.targetUser}

## Market Reality
Alternatives: ${brief.competitors.join("; ")}

## Opportunities
${brief.opportunities.map((item) => `- ${item}`).join("\n")}

## Assumptions
${brief.assumptions.map((item) => `- ${item}`).join("\n")}

## Risks
${brief.risks.map((item) => `- ${item}`).join("\n")}

## MVP Scope
${brief.mvpScope.map((item) => `- ${item}`).join("\n")}

## Current Bottleneck
${brief.currentBottleneck}

## Founder Reality Check
Readiness: ${brief.readinessLabel}
Strongest point: ${brief.strongestPoint}
Weakest point: ${brief.weakestPoint}
Next validation task: ${brief.nextValidationTask}

## Roadmap
${brief.roadmap.map((stage) => `### ${stage.horizon}\n${stage.actions.map((item) => `- ${item}`).join("\n")}`).join("\n\n")}

## Skill Gaps
${brief.skillGaps.map((item) => `- ${item}`).join("\n")}

## Pitch Assets
One-line pitch: ${brief.pitchAssets.oneLinePitch}
Elevator pitch: ${brief.pitchAssets.elevatorPitch}

## Responsible AI Notes
${brief.responsibleAINotes.map((item) => `- ${item}`).join("\n")}

## Sources
${brief.sources.map((source) => `- ${source.title}: ${source.url} (${source.label})`).join("\n")}
`;
}

export function LaunchBriefView({ brief }: { brief: LaunchBrief }) {
  const [question, setQuestion] = useState("Should I drop out?");
  const [answer, setAnswer] = useState(copilotReply("What should I do next?", brief));
  const markdown = useMemo(() => briefToMarkdown(brief), [brief]);

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <main className="space-y-5">
        <section className="glass rounded-[28px] p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="mono-label">Launch Brief Workspace</p>
              <h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight text-stone-100 md:text-5xl">
                {brief.currentBottleneck}
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-lp-muted">{brief.nextValidationTask}</p>
            </div>
            <Badge label={brief.readinessLabel} />
          </div>
          <div className="mt-6 grid gap-6 md:grid-cols-[180px_1fr]">
            <div className="rounded-full border border-white/10 bg-lp-elevated p-5 text-center">
              <p className="text-xs uppercase tracking-[0.18em] text-lp-subtle">Founder fit</p>
              <p className="mt-2 text-5xl font-semibold tracking-tight text-stone-100">{brief.founderScore.overall}</p>
              <p className="mt-1 text-xs text-lp-subtle">coaching score</p>
            </div>
            <div className="space-y-3 text-sm leading-6 text-lp-muted">
              <p><strong className="text-stone-100">Strongest point:</strong> {brief.strongestPoint}</p>
              <p><strong className="text-stone-100">Weakest point:</strong> {brief.weakestPoint}</p>
              <p><strong className="text-stone-100">Do not do yet:</strong> Do not chase VC outreach, hiring, or dropout decisions before validation.</p>
              <p className="text-xs text-lp-subtle">{brief.founderScore.notes.join(" ")}</p>
            </div>
          </div>
        </section>

        <section className="glass rounded-[28px] p-6">
          <div className="grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
            <article>
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-lp-accent" />
              <h2 className="font-semibold text-stone-100">First real step</h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-lp-muted">{brief.nextValidationTask}</p>
            <div className="mt-4 grid gap-2">
              {brief.roadmap[0]?.actions.map((action) => (
                <div key={action} className="rounded-2xl border border-white/10 bg-lp-surface px-4 py-3 text-sm text-lp-muted">
                  {action}
                </div>
              ))}
            </div>
          </article>
          <article className="insight-banner rounded-[24px] p-5">
            <h2 className="font-semibold text-stone-100">Founder Reality Check</h2>
            <p className="mt-3 text-sm leading-6 text-lp-muted">
              Readiness: {brief.readinessLabel}. This is a stage label, not a success score or funding prediction.
            </p>
            <p className="mt-3 text-sm leading-6 text-lp-muted">Next validation task: {brief.nextValidationTask}</p>
          </article>
          </div>
        </section>

        <section className="glass rounded-[28px] p-6">
          <p className="mono-label">Agent work</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-100">Research agents and generated plans</h2>
          <div className="mt-4 divide-y divide-white/10">
          {brief.agents.map((agent) => (
            <details key={agent.name} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-stone-100">{agent.name}</h2>
                  <p className="text-sm text-lp-subtle">{agent.role}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge label={agent.label} />
                  <ChevronDown className="h-4 w-4 text-lp-subtle transition group-open:rotate-180" />
                </div>
              </summary>
              <p className="mt-4 text-sm leading-6 text-lp-muted">{agent.finding}</p>
              <div className="mt-4 rounded-2xl border border-white/10 bg-lp-surface p-4 text-sm text-lp-muted">
                <p className="font-medium text-stone-100">Recommendation: {agent.reasoning.recommendation}</p>
                <p className="mt-2">Why: {agent.reasoning.why}</p>
                <p className="mt-2">Evidence used: {agent.reasoning.evidenceUsed.join("; ")}</p>
                <p className="mt-2">Assumptions: {agent.reasoning.assumptions.join("; ")}</p>
                <p className="mt-2">Confidence: {agent.reasoning.confidence}</p>
                <p className="mt-2">What could be wrong: {agent.reasoning.whatCouldBeWrong}</p>
                <p className="mt-2">How to validate: {agent.reasoning.howToValidate}</p>
                {!!agent.plan?.length && (
                  <ol className="mt-3 space-y-1">
                    {agent.plan.map((item, index) => <li key={item}>{index + 1}. {item}</li>)}
                  </ol>
                )}
              </div>
            </details>
          ))}
          </div>
        </section>

        <section className="glass rounded-[28px] p-6">
          <p className="mono-label">Operating memo</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-100">Vague idea {"->"} structured plan {"->"} first real step</h2>
          <div className="mt-4 divide-y divide-white/10">
          {brief.workspace.map((item) => (
            <details key={item.id} className="group py-4" open={["bottleneck", "roadmap", "reality"].includes(item.id)}>
              <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
                <div>
                  <p className="mono-label text-lp-subtle">{item.type}</p>
                  <h3 className="mt-2 font-semibold text-stone-100">{item.title}</h3>
                </div>
                <div className="flex items-center gap-2">
                  <Badge label={item.label} />
                  <ChevronDown className="h-4 w-4 text-lp-subtle transition group-open:rotate-180" />
                </div>
              </summary>
              <p className="mt-3 whitespace-pre-line text-sm leading-6 text-lp-muted">{item.content}</p>
            </details>
          ))}
          </div>
        </section>
      </main>

      <aside className="space-y-5 lg:sticky lg:top-5 lg:self-start">
        <section className="glass rounded-[28px] p-5">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-lp-muted" />
            <h2 className="font-semibold text-stone-100">Context Copilot</h2>
          </div>
          <p className="mt-3 text-sm leading-6 text-lp-muted">
            I use your saved profile, bottleneck, roadmap, opportunities, and reality check. I will push back when the plan is skipping validation.
          </p>
          <textarea
            className="input-field-rect mt-4 min-h-24 w-full p-3 text-sm"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
          />
          <button
            className="btn-primary mt-3 w-full px-4 py-3 text-sm"
            onClick={() => setAnswer(copilotReply(question, brief))}
          >
            Ask with context
          </button>
          <div className="mt-4 rounded-2xl border border-white/10 bg-lp-surface p-4 text-sm leading-6 text-lp-muted">{answer}</div>
        </section>

        <section className="bento-card rounded-[28px] p-5">
          <div className="flex items-center gap-2">
            <Download className="h-4 w-4 text-lp-muted" />
            <h2 className="font-semibold text-stone-100">Export</h2>
          </div>
          <div className="mt-4 grid gap-2">
            <button className="btn-secondary w-full px-4 py-3 text-sm font-medium" onClick={() => navigator.clipboard.writeText(markdown)}>
              Copy Launch Brief
            </button>
            <button className="btn-secondary w-full px-4 py-3 text-sm font-medium" onClick={() => downloadFile("launch-brief.md", markdown, "text/markdown")}>
              Download Markdown
            </button>
            <button className="btn-secondary w-full px-4 py-3 text-sm font-medium" onClick={() => downloadFile("launch-brief.json", JSON.stringify(brief, null, 2), "application/json")}>
              Download JSON
            </button>
          </div>
        </section>

        <section className="bento-card rounded-[28px] p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-lp-accent" />
            <h2 className="font-semibold text-stone-100">Responsible AI</h2>
          </div>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-lp-muted">
            {brief.responsibleAINotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </section>

        <section className="bento-card rounded-[28px] p-5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-lp-accent" />
            <h2 className="font-semibold text-stone-100">Pitch Assets</h2>
          </div>
          <p className="mt-3 text-sm leading-6 text-lp-muted">{brief.pitchAssets.oneLinePitch}</p>
          <ol className="mt-4 space-y-2 text-sm text-lp-muted">
            {brief.pitchAssets.deckOutline.map((slide, index) => (
              <li key={slide}>{index + 1}. {slide}</li>
            ))}
          </ol>
        </section>

        <section className="bento-card rounded-[28px] p-5">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-lp-muted" />
            <h2 className="font-semibold text-stone-100">Sources</h2>
          </div>
          <div className="mt-4 space-y-3">
            {brief.sources.map((source) => (
              <a key={source.id} className="block rounded-2xl border border-white/10 bg-lp-surface p-3 text-sm text-lp-muted hover:border-white/20" href={source.url} target="_blank" rel="noreferrer">
                <span className="font-medium">{source.title}</span>
                <span className="mt-1 block text-xs text-lp-subtle">{source.type} - {source.label}</span>
              </a>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}
