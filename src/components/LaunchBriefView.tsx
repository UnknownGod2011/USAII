"use client";

import { Badge } from "@/components/Badge";
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

## Finalized Idea
${brief.refinedIdea}

## Problem
${brief.problem}

## Target User
${brief.targetUser}

## Evidence Score
${brief.evidenceScore?.score ?? brief.founderScore.overall}/100 - ${brief.evidenceScore?.verdict || brief.founderScore.label}

Strongest signal: ${brief.strongestPoint}

Weakest signal: ${brief.weakestPoint}

Current bottleneck: ${brief.currentBottleneck}

First validation step: ${brief.nextValidationTask}

## Market Reality
${brief.competitors.length ? brief.competitors.map((item) => `- ${item}`).join("\n") : "- No sufficiently verified competitor was retained."}

## Opportunities
${brief.opportunities.map((item) => `- ${item}`).join("\n")}

## Assumptions
${brief.assumptions.map((item) => `- ${item}`).join("\n")}

## Risks
${brief.risks.map((item) => `- ${item}`).join("\n")}

## MVP Scope
${brief.mvpScope.map((item) => `- ${item}`).join("\n")}

### Do Not Build Yet
- Billing, team administration, broad automation, and advanced analytics unless the first pilot proves they are required.

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

Landing headline: ${brief.pitchAssets.landingHeadline}

User interview message: ${brief.pitchAssets.interviewMessage}

### Six-slide outline
${brief.pitchAssets.deckOutline.map((item, index) => `${index + 1}. ${item}`).join("\n")}

## Responsible AI Notes
${brief.responsibleAINotes.map((item) => `- ${item}`).join("\n")}

## Sources
${brief.sources.map((source, index) => `- [${index + 1}] ${source.title}: ${source.url || "No live URL"} (${source.label}). Limitation: ${source.limitation || "Validate before relying on this source."}`).join("\n")}
`;
}

export function LaunchBriefView({ brief }: { brief: LaunchBrief }) {
  const [question, setQuestion] = useState("Should I drop out?");
  const [answer, setAnswer] = useState(`Your current bottleneck is ${brief.currentBottleneck.toLowerCase()}. ${brief.nextValidationTask}`);
  const [references, setReferences] = useState<{ id: string; label: string; kind: string; url?: string }[]>([]);
  const markdown = useMemo(() => briefToMarkdown(brief), [brief]);
  const marketAgent = brief.agents.find((agent) => agent.name === "Market Reality Agent");
  const evidenceDimensions = brief.evidenceScore ? [
    ["Problem clarity", brief.evidenceScore.breakdown.problemPainClarity, 20],
    ["Target sharpness", brief.evidenceScore.breakdown.targetUserSharpness, 15],
    ["Demand evidence", brief.evidenceScore.breakdown.demandEvidence, 20],
    ["Competitor gap", brief.evidenceScore.breakdown.competitorGap, 15],
    ["Feasibility", brief.evidenceScore.breakdown.feasibility, 15],
    ["Founder fit", brief.evidenceScore.breakdown.founderMarketFit, 10],
    ["Risk control", brief.evidenceScore.breakdown.riskLevel, 5],
  ] as const : [];
  async function askCopilot() {
    const response = await fetch("/api/copilot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });
    const data = await response.json();
    setAnswer(data.answer || data.error || "Copilot could not answer.");
    setReferences(data.references || []);
  }

  return (
    <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <main className="min-w-0 space-y-5">
        <section className="glass rounded-[28px] p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">Launch Brief Workspace</p>
              <h1 className="mt-2 max-w-3xl break-words text-3xl font-semibold tracking-tight text-stone-950 md:text-5xl">
                {brief.currentBottleneck}
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-stone-600">{brief.nextValidationTask}</p>
            </div>
            <Badge label={brief.readinessLabel} />
          </div>
          <div className="mt-6 grid gap-6 md:grid-cols-[180px_1fr]">
            <div className="rounded-full border border-stone-200 bg-white/75 p-5 text-center">
              <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Evidence readiness</p>
              <p className="mt-2 text-5xl font-semibold tracking-tight text-stone-950">{brief.founderScore.overall}</p>
              <p className="mt-1 text-xs text-stone-500">not a success prediction</p>
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

        {!!evidenceDimensions.length && (
          <section className="glass rounded-[28px] p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">Evidence profile</p>
            <div className="mt-5 grid gap-x-8 gap-y-4 md:grid-cols-2">
              {evidenceDimensions.map(([label, value, maximum]) => (
                <div key={label}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-stone-800">{label}</span>
                    <span className="text-stone-500">{value}/{maximum}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-200">
                    <div
                      className={`h-full rounded-full ${value / maximum >= 0.7 ? "bg-emerald-600" : value / maximum >= 0.45 ? "bg-amber-500" : "bg-rose-500"}`}
                      style={{ width: `${Math.round((value / maximum) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-5 text-xs leading-5 text-stone-500">These bars show evidence coverage against LaunchPilot&apos;s validation rubric. They do not predict company success.</p>
          </section>
        )}

        <section className="glass overflow-hidden rounded-[28px]">
          <div className="border-b border-stone-200 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">Market reality</p>
            <h2 className="mt-2 text-2xl font-semibold text-stone-950">Alternatives and positioning evidence</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">{marketAgent?.finding || "The competitor picture remains incomplete and needs direct user confirmation."}</p>
          </div>
          <div className="max-w-full overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="bg-stone-50 text-xs uppercase tracking-[0.14em] text-stone-500">
                <tr><th className="px-6 py-4">Alternative</th><th className="px-6 py-4">Classification</th><th className="px-6 py-4">Evidence</th><th className="px-6 py-4">Confidence</th></tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {brief.competitors.length ? brief.competitors.map((competitor) => {
                  const source = marketAgent?.sources?.find((item) => item.title.toLowerCase().includes(competitor.toLowerCase()) || competitor.toLowerCase().includes(item.title.toLowerCase()));
                  return (
                    <tr key={competitor} className="align-top">
                      <td className="px-6 py-4 font-medium text-stone-950">{competitor}</td>
                      <td className="px-6 py-4 text-stone-600">{source?.type === "competitor" ? "Direct product" : "Alternative to verify"}</td>
                      <td className="px-6 py-4 text-stone-600">{source?.url ? <a className="underline decoration-stone-300 underline-offset-4" href={source.url} target="_blank" rel="noreferrer">{source.title}</a> : "Founder or research context; verify with users"}</td>
                      <td className="px-6 py-4"><Badge label={source?.label || "Needs validation"} /></td>
                    </tr>
                  );
                }) : (
                  <tr><td className="px-6 py-5 text-stone-600" colSpan={4}>No sufficiently relevant market competitor was verified. Ask target users what they use today before claiming a gap.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="border-t border-stone-200 bg-stone-50/70 px-6 py-4 text-sm text-stone-600">
            <strong className="text-stone-900">Positioning gap:</strong> {marketAgent?.reasoning.recommendation || "Define the gap only after users confirm current behavior and switching costs."}
          </div>
        </section>

        <section className="glass rounded-[28px] p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">Assumption and risk register</p>
          <div className="mt-5 max-w-full overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-stone-200 text-xs uppercase tracking-[0.14em] text-stone-500">
                <tr><th className="pb-3 pr-5">Assumption</th><th className="pb-3 pr-5">Risk</th><th className="pb-3 pr-5">Test method</th><th className="pb-3">Success signal</th></tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {brief.assumptions.map((assumption, index) => (
                  <tr key={assumption} className="align-top">
                    <td className="py-4 pr-5 font-medium text-stone-900">{assumption}</td>
                    <td className="py-4 pr-5 text-stone-600"><span className={`mr-2 inline-block h-2.5 w-2.5 rounded-full ${index === 0 ? "bg-rose-500" : index === 1 ? "bg-amber-500" : "bg-emerald-500"}`} />{brief.risks[index] || "Evidence may not generalize to the first segment."}</td>
                    <td className="py-4 pr-5 text-stone-600">{index === 0 ? brief.nextValidationTask : index === 1 ? "Ask each interviewee what they use now, why, and what switching would cost." : "Run the smallest pilot inside the stated weekly time and budget."}</td>
                    <td className="py-4 text-stone-600">{index === 0 ? "Repeated recent examples plus a commitment of time, data, or money." : index === 1 ? "A specific recurring gap users confirm without prompting." : "A usable pilot delivered without expanding scope."}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="glass rounded-[28px] p-6">
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">MVP scope</p>
              <h2 className="mt-2 text-xl font-semibold text-stone-950">Must prove</h2>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-stone-700">
                {brief.mvpScope.map((item) => <li key={item} className="border-l-2 border-emerald-500 pl-4">{item}</li>)}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">Do not build yet</p>
              <h2 className="mt-2 text-xl font-semibold text-stone-950">Deferred until evidence improves</h2>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-stone-700">
                {["Complex automation", "Billing and subscription infrastructure", "Team administration", "Advanced analytics and broad integrations"].map((item) => <li key={item} className="border-l-2 border-stone-300 pl-4">{item}</li>)}
              </ul>
            </div>
          </div>
        </section>

        <section className="glass rounded-[28px] p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">Execution timeline</p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {brief.roadmap.map((stage, index) => (
              <article key={stage.horizon} className="relative rounded-[24px] border border-stone-200 bg-white/70 p-5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-950 text-xs font-semibold text-white">{index + 1}</span>
                <h3 className="mt-4 font-semibold text-stone-950">{stage.horizon}</h3>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-stone-600">{stage.actions.map((action) => <li key={action}>{action}</li>)}</ul>
              </article>
            ))}
          </div>
          <p className="mt-5 text-sm text-stone-600"><strong className="text-stone-900">Stop or pivot:</strong> if target users do not describe recent pain or commit meaningful time, data, repeated use, or money after the planned validation cycle.</p>
        </section>

        <section className="glass rounded-[28px] p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">Agent work</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">Research workstream audit</h2>
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

      <aside className="min-w-0 space-y-5 lg:sticky lg:top-5 lg:self-start">
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
            onClick={() => void askCopilot()}
          >
            Ask with context
          </button>
          <div className="mt-4 rounded-2xl bg-stone-50 p-4 text-sm leading-6 text-stone-700">{answer}</div>
          {!!references.length && (
            <div className="mt-3 flex flex-wrap gap-2">
              {references.map((reference) => reference.url ? (
                <a key={`${reference.kind}-${reference.id}`} href={reference.url} target="_blank" rel="noreferrer" className="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs text-stone-600">
                  {reference.label}
                </a>
              ) : (
                <span key={`${reference.kind}-${reference.id}`} className="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs text-stone-600">
                  {reference.label}
                </span>
              ))}
            </div>
          )}
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
