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
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">Launch Brief Workspace</p>
              <h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight text-stone-950 md:text-5xl">
                {brief.currentBottleneck}
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-stone-600">{brief.nextValidationTask}</p>
            </div>
            <Badge label={brief.readinessLabel} />
          </div>
          <div className="mt-6 grid gap-6 md:grid-cols-[180px_1fr]">
            <div className="rounded-full border border-stone-200 bg-white/75 p-5 text-center">
              <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Founder fit</p>
              <p className="mt-2 text-5xl font-semibold tracking-tight text-stone-950">{brief.founderScore.overall}</p>
              <p className="mt-1 text-xs text-stone-500">coaching score</p>
            </div>
            <div className="space-y-3 text-sm leading-6 text-stone-700">
              <p><strong className="text-stone-950">Strongest point:</strong> {brief.strongestPoint}</p>
              <p><strong className="text-stone-950">Weakest point:</strong> {brief.weakestPoint}</p>
              <p><strong className="text-stone-950">Do not do yet:</strong> Do not chase VC outreach, hiring, or dropout decisions before validation.</p>
              <p className="text-xs text-stone-500">{brief.founderScore.notes.join(" ")}</p>
            </div>
          </div>
        </section>

        <section className="glass rounded-[28px] p-6">
          <div className="grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
            <article>
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-emerald-600" />
              <h2 className="font-semibold text-stone-950">First real step</h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-stone-600">{brief.nextValidationTask}</p>
            <div className="mt-4 grid gap-2">
              {brief.roadmap[0]?.actions.map((action) => (
                <div key={action} className="rounded-2xl bg-stone-50 px-4 py-3 text-sm text-stone-700">
                  {action}
                </div>
              ))}
            </div>
          </article>
          <article className="rounded-[24px] bg-amber-100/80 p-5 shadow-sm">
            <h2 className="font-semibold text-stone-950">Founder Reality Check</h2>
            <p className="mt-3 text-sm leading-6 text-stone-700">
              Readiness: {brief.readinessLabel}. This is a stage label, not a success score or funding prediction.
            </p>
            <p className="mt-3 text-sm leading-6 text-stone-700">Next validation task: {brief.nextValidationTask}</p>
          </article>
          </div>
        </section>

        <section className="glass rounded-[28px] p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">Agent work</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">Research agents and generated plans</h2>
          <div className="mt-4 divide-y divide-stone-200">
          {brief.agents.map((agent) => (
            <details key={agent.name} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-stone-950">{agent.name}</h2>
                  <p className="text-sm text-stone-500">{agent.role}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge label={agent.label} />
                  <ChevronDown className="h-4 w-4 text-stone-400 transition group-open:rotate-180" />
                </div>
              </summary>
              <p className="mt-4 text-sm leading-6 text-stone-700">{agent.finding}</p>
              <div className="mt-4 rounded-2xl bg-white/70 p-4 text-sm text-stone-600">
                <p className="font-medium text-stone-900">Recommendation: {agent.reasoning.recommendation}</p>
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
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">Operating memo</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">Vague idea {"->"} structured plan {"->"} first real step</h2>
          <div className="mt-4 divide-y divide-stone-200">
          {brief.workspace.map((item) => (
            <details key={item.id} className="group py-4" open={["bottleneck", "roadmap", "reality"].includes(item.id)}>
              <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">{item.type}</p>
                  <h3 className="mt-2 font-semibold text-stone-950">{item.title}</h3>
                </div>
                <div className="flex items-center gap-2">
                  <Badge label={item.label} />
                  <ChevronDown className="h-4 w-4 text-stone-400 transition group-open:rotate-180" />
                </div>
              </summary>
              <p className="mt-3 whitespace-pre-line text-sm leading-6 text-stone-600">{item.content}</p>
            </details>
          ))}
          </div>
        </section>
      </main>

      <aside className="space-y-5 lg:sticky lg:top-5 lg:self-start">
        <section className="glass rounded-[28px] p-5">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-stone-700" />
            <h2 className="font-semibold text-stone-950">Context Copilot</h2>
          </div>
          <p className="mt-3 text-sm leading-6 text-stone-600">
            I use your saved profile, bottleneck, roadmap, opportunities, and reality check. I will push back when the plan is skipping validation.
          </p>
          <textarea
            className="mt-4 min-h-24 w-full rounded-2xl border border-stone-200 bg-white p-3 text-sm outline-none focus:border-stone-400 focus:ring-4 focus:ring-stone-200"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
          />
          <button
            className="mt-3 w-full rounded-full bg-stone-950 px-4 py-3 text-sm font-semibold text-white hover:bg-stone-800"
            onClick={() => setAnswer(copilotReply(question, brief))}
          >
            Ask with context
          </button>
          <div className="mt-4 rounded-2xl bg-stone-50 p-4 text-sm leading-6 text-stone-700">{answer}</div>
        </section>

        <section className="premium-card rounded-[28px] p-5">
          <div className="flex items-center gap-2">
            <Download className="h-4 w-4 text-stone-700" />
            <h2 className="font-semibold text-stone-950">Export</h2>
          </div>
          <div className="mt-4 grid gap-2">
            <button className="rounded-full border border-stone-200 px-4 py-3 text-sm font-medium hover:bg-stone-50" onClick={() => navigator.clipboard.writeText(markdown)}>
              Copy Launch Brief
            </button>
            <button className="rounded-full border border-stone-200 px-4 py-3 text-sm font-medium hover:bg-stone-50" onClick={() => downloadFile("launch-brief.md", markdown, "text/markdown")}>
              Download Markdown
            </button>
            <button className="rounded-full border border-stone-200 px-4 py-3 text-sm font-medium hover:bg-stone-50" onClick={() => downloadFile("launch-brief.json", JSON.stringify(brief, null, 2), "application/json")}>
              Download JSON
            </button>
          </div>
        </section>

        <section className="premium-card rounded-[28px] p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <h2 className="font-semibold text-stone-950">Responsible AI</h2>
          </div>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-stone-600">
            {brief.responsibleAINotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </section>

        <section className="premium-card rounded-[28px] p-5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-600" />
            <h2 className="font-semibold text-stone-950">Pitch Assets</h2>
          </div>
          <p className="mt-3 text-sm leading-6 text-stone-700">{brief.pitchAssets.oneLinePitch}</p>
          <ol className="mt-4 space-y-2 text-sm text-stone-600">
            {brief.pitchAssets.deckOutline.map((slide, index) => (
              <li key={slide}>{index + 1}. {slide}</li>
            ))}
          </ol>
        </section>

        <section className="premium-card rounded-[28px] p-5">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-stone-700" />
            <h2 className="font-semibold text-stone-950">Sources</h2>
          </div>
          <div className="mt-4 space-y-3">
            {brief.sources.map((source) => (
              <a key={source.id} className="block rounded-2xl bg-stone-50 p-3 text-sm text-stone-700 hover:bg-stone-100" href={source.url} target="_blank" rel="noreferrer">
                <span className="font-medium">{source.title}</span>
                <span className="mt-1 block text-xs text-stone-500">{source.type} - {source.label}</span>
              </a>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}
