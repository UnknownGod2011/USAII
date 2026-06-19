"use client";

import type { AgentOutput, LaunchBrief } from "@/lib/types";
import { Check, Clipboard, Download, FileJson, MessageCircle, Send, ShieldCheck, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";

function downloadFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function copyText(content: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(content);
      return;
    } catch {
      // Clipboard permissions vary in embedded and local browsers.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = content;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("Clipboard unavailable");
}

const tone: Record<string, string> = {
  High: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  Medium: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  Low: "border-red-400/30 bg-red-400/10 text-red-200",
  Verified: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  "Needs validation": "border-amber-400/30 bg-amber-400/10 text-amber-200",
  Complete: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  Working: "border-white/40 bg-white/10 text-white",
  Queued: "border-white/15 bg-white/[0.03] text-lp-subtle",
};

const AGENT_ORDER = [
  "Market Reality Agent",
  "Assumption & Risk Agent",
  "MVP Scope Agent",
  "Roadmap Agent",
  "Opportunity Agent",
  "Pitch & Communication Agent",
] as const;

function orderAgents(agents: AgentOutput[]) {
  return [...agents].sort((left, right) => {
    const leftIndex = AGENT_ORDER.indexOf(left.name as (typeof AGENT_ORDER)[number]);
    const rightIndex = AGENT_ORDER.indexOf(right.name as (typeof AGENT_ORDER)[number]);
    return (leftIndex === -1 ? AGENT_ORDER.length : leftIndex) - (rightIndex === -1 ? AGENT_ORDER.length : rightIndex);
  });
}

function Pill({ value }: { value: string }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider ${tone[value] || "border-white/15 text-lp-muted"}`}>{value === "Working" ? <span className="shiny-copy">{value}</span> : value}</span>;
}

function Section({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section className="terminal-card p-6 md:p-8">
      <p className="mono-label">{eyebrow}</p>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">{title}</h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function scoreDimensions(brief: LaunchBrief) {
  const breakdown = brief.evidenceScore?.breakdown;
  if (!breakdown) return [];
  return [
    ["Problem clarity", breakdown.problemPainClarity, 20],
    ["Target user", breakdown.targetUserSharpness, 15],
    ["Demand evidence", breakdown.demandEvidence, 20],
    ["Competitor evidence", breakdown.competitorGap, 15],
    ["Feasibility", breakdown.feasibility, 15],
    ["Founder fit", breakdown.founderMarketFit, 10],
  ] as const;
}

function statusFor(agent: AgentOutput, activeAgent?: string | null) {
  if (activeAgent === agent.name) return "Working";
  const lower = agent.status.toLowerCase();
  if (lower === "complete") return "Complete";
  if (lower === "working" || lower === "running") return "Working";
  return "Queued";
}

function AgentProgress({ agents, activeAgent, building }: { agents: AgentOutput[]; activeAgent?: string | null; building?: boolean }) {
  const orderedAgents = orderAgents(agents);
  const completeCount = orderedAgents.filter((agent) => statusFor(agent, activeAgent) === "Complete").length;
  return (
    <Section eyebrow="Agent progress" title={building ? "Agents are building your Launch Brief" : "Six-agent research workspace"}>
      <div className="mb-6 flex flex-col gap-3 border-b border-white/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <p className="max-w-2xl text-sm leading-6 text-lp-muted">
          Each specialist reads the same persisted founder brief, evidence verdict, source ledger, and constraints before saving its output.
        </p>
        <div className="min-w-44">
          <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-wider text-lp-subtle">
            <span>{building ? activeAgent || "Building workspace" : "Research complete"}</span>
            <span>{completeCount}/{orderedAgents.length}</span>
          </div>
          <div className="mt-2 h-1 overflow-hidden bg-white/10">
            <div className="h-full bg-emerald-300/80 transition-all" style={{ width: `${orderedAgents.length ? (completeCount / orderedAgents.length) * 100 : 0}%` }} />
          </div>
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {orderedAgents.map((agent, index) => {
          const status = statusFor(agent, activeAgent);
          return (
            <article key={agent.name} className="border border-white/10 bg-white/[0.025] p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-[11px] text-lp-subtle">Agent {index + 1}</p>
                  <h3 className="mt-1 font-semibold">{agent.name}</h3>
                  <p className="mt-1 text-xs leading-5 text-lp-muted">{agent.role}</p>
                </div>
                <Pill value={status} />
              </div>
              <div className="mt-5 space-y-2">
                {(agent.liveSteps || []).slice(0, 4).map((line, lineIndex) => (
                  <div key={line} className="flex gap-3 text-xs leading-5 text-lp-muted">
                    <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${status === "Queued" && lineIndex > 0 ? "bg-white/20" : "bg-white/70"}`} />
                    <span>{line}</span>
                  </div>
                ))}
              </div>
              {status === "Complete" && (
                <div className="mt-5 border-t border-white/10 pt-4">
                  <p className="text-sm leading-6 text-white">{agent.finding}</p>
                  <p className="mt-2 text-xs leading-5 text-lp-muted">{agent.whyItMatters}</p>
                  <div className="mt-4 border-l border-white/20 pl-3">
                    <p className="mono-label">Recommended move</p>
                    <p className="mt-2 text-xs leading-5 text-white/90">{agent.reasoning.recommendation}</p>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2 text-[10px] text-lp-subtle">
                    <Pill value={agent.confidence} />
                    <span>{agent.sources?.length || 0} linked source{agent.sources?.length === 1 ? "" : "s"}</span>
                    <span>·</span>
                    <span>{agent.label}</span>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </Section>
  );
}

function CopilotPanel({
  question,
  answer,
  references,
  asking,
  onQuestionChange,
  onAsk,
  className = "",
}: {
  question: string;
  answer: string;
  references: Array<{ id: string; label: string; url: string }>;
  asking: boolean;
  onQuestionChange: (value: string) => void;
  onAsk: (prompt?: string) => void;
  className?: string;
}) {
  return (
    <section className={`terminal-card star-panel p-5 ${className}`}>
      <div className="flex items-center gap-2"><MessageCircle className="h-4 w-4" /><h2 className="font-semibold">Context Copilot</h2></div>
      <p className="mt-3 text-sm leading-6 text-lp-muted">Answers use the persisted Launch Brief, founder constraints, evidence verdict, risks, roadmap, agent outputs, and source ledger.</p>
      <div className="mt-4 grid gap-2">
        {["What should I do today?", "What competitors did you find?", "Should I find investors?", "Should I drop out?", "What is an amethyst?"].map((prompt) => (
          <button key={prompt} onClick={() => onAsk(prompt)} className="border border-white/10 px-3 py-2 text-left text-[11px] text-lp-muted hover:border-white/30 hover:text-white">{prompt}</button>
        ))}
      </div>
      <textarea value={question} onChange={(event) => onQuestionChange(event.target.value)} className="input-field mt-4 min-h-24" aria-label="Ask LaunchPilot Copilot" />
      <button onClick={() => onAsk()} disabled={asking} className="btn-primary mt-3 w-full">{asking ? "Reading workspace..." : "Ask with context"} <Send className="h-4 w-4" /></button>
      <div className="mt-4 max-h-64 overflow-y-auto border border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-lp-muted" aria-live="polite">{answer}</div>
      {references.length > 0 && (
        <div className="mt-4">
          <p className="mono-label">Workspace references</p>
          <div className="mt-2 space-y-2">
            {references.map((reference) => (
              <a
                key={reference.id}
                href={reference.url}
                target="_blank"
                rel="noreferrer"
                className="block truncate border-b border-white/10 pb-2 text-xs text-lp-muted hover:text-white"
              >
                {reference.label}
              </a>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export function briefToExportJson(brief: LaunchBrief) {
  return {
    normalizedBrief: brief.normalizedBrief,
    evidenceScore: brief.evidenceScore && {
      score: brief.evidenceScore.score,
      verdict: brief.evidenceScore.verdict,
      strongestSignal: brief.evidenceScore.strongestSignal,
      weakestSignal: brief.evidenceScore.weakestSignal,
      whatCouldBeWrong: brief.evidenceScore.whatCouldBeWrong,
      breakdown: brief.evidenceScore.breakdown,
    },
    verdict: brief.evidenceScore?.verdict || brief.readinessLabel,
    agents: orderAgents(brief.agents).map((agent) => ({
      name: agent.name,
      status: agent.status,
      finding: agent.finding,
      recommendation: agent.reasoning.recommendation,
      confidence: agent.confidence,
      sources: agent.sources?.map((source) => ({ title: source.title, url: source.url })),
    })),
    risks: brief.riskRegister,
    mvp: brief.mvpPlan,
    roadmap: brief.roadmapPlan,
    opportunities: brief.opportunityLayer,
    pitchAssets: brief.pitchAssets,
    sources: brief.sources.map((source) => ({
      title: source.title,
      url: source.url,
      type: source.type,
      label: source.label,
      supports: source.query || source.type,
      limitation: source.limitation,
      confidence: source.qualityScore && source.qualityScore >= 0.7 ? "high" : source.qualityScore && source.qualityScore >= 0.4 ? "medium" : "low",
    })),
    responsibleAINote: brief.responsibleAINotes,
  };
}

export function briefToMarkdown(brief: LaunchBrief) {
  const normalized = brief.normalizedBrief;
  const alternatives = [...brief.marketReality.directCompetitors, ...brief.marketReality.indirectAlternatives];
  return `# ${normalized.cleanStartupTitle}

${normalized.oneLineIdea}

## Founder Snapshot
Founder: ${brief.profile.name}
Location: ${brief.profile.location}
Status: ${brief.profile.status}
Constraints: ${normalized.founderConstraints.join("; ")}

## Evidence Score
Score: ${brief.evidenceScore?.score ?? brief.founderScore.overall}/100
Verdict: ${brief.evidenceScore?.verdict.replaceAll("_", " ") ?? brief.readinessLabel}
Strongest signal: ${brief.strongestPoint}
Weakest signal: ${brief.weakestPoint}
Current bottleneck: ${brief.currentBottleneck}
Next best action: ${normalized.nextBestAction}

## Validated Direction
Original idea: ${normalized.originalIdeaSummary}
Refined idea: ${normalized.refinedIdea}
Target user: ${normalized.targetUserSegment}
Problem: ${normalized.problemStatement}
Value proposition: ${normalized.valueProposition}
Why this wedge is sharper: ${normalized.whyThisIsSharper}

## Market Reality
${brief.marketReality.noDirectCompetitorMessage ? `${brief.marketReality.noDirectCompetitorMessage}\n\n` : ""}${brief.marketReality.summary}
Positioning gap: ${brief.marketReality.positioningGap}

## Agent Findings
${orderAgents(brief.agents).map((agent) => `- ${agent.name}: ${agent.finding}\n  - Recommendation: ${agent.reasoning.recommendation}\n  - Confidence: ${agent.confidence}`).join("\n")}

## Competitor / Alternative Matrix
${alternatives.map((item) => `- ${item.name} (${item.type}) - Strength: ${item.strength} Gap: ${item.gap} Confidence: ${item.confidence}`).join("\n") || "- No exact direct competitor was verified in this run."}

## Risk Register
${brief.riskRegister.map((risk) => `- ${risk.riskLevel}: ${risk.assumption}\n  - Why it matters: ${risk.whyItMatters}\n  - Test: ${risk.test}\n  - Success signal: ${risk.successSignal}\n  - Stop/pivot trigger: ${risk.stopOrPivotTrigger}`).join("\n")}

## MVP Scope
Goal: ${brief.mvpPlan.goal}
Manual pilot: ${brief.mvpPlan.manualPilot}
Must-have:
${brief.mvpPlan.mustHave.map((item) => `- ${item}`).join("\n")}
Do not build yet:
${brief.mvpPlan.doNotBuildYet.map((item) => `- ${item}`).join("\n")}
Success metric: ${brief.mvpPlan.successMetric}

## Roadmap
### Next 24 hours
${brief.roadmapPlan.next24Hours.map((item) => `- ${item}`).join("\n")}
### 7-day sprint
${brief.roadmapPlan.sevenDaySprint.map((item) => `- ${item}`).join("\n")}
### 30-day pilot
${brief.roadmapPlan.thirtyDayPilot.map((item) => `- ${item}`).join("\n")}
### 60/90-day direction
${brief.roadmapPlan.sixtyNinetyDays.map((item) => `- ${item}`).join("\n")}
Stop/pivot criteria: ${brief.roadmapPlan.stopPivotCriteria}

## Opportunities
${brief.opportunityLayer.map((item) => `- ${item.name}: ${item.nextAction} (${item.eligibilityUncertainty})`).join("\n")}

## Pitch Assets
One-line pitch: ${brief.pitchAssets.oneLinePitch}
30-second pitch: ${brief.pitchAssets.elevatorPitch}
Landing headline: ${brief.pitchAssets.landingHeadline}
User interview message: ${brief.pitchAssets.interviewMessage}
Slide outline:
${brief.pitchAssets.deckOutline.map((item, index) => `${index + 1}. ${item}`).join("\n")}

## Responsible AI Notes
${brief.responsibleAINotes.map((item) => `- ${item}`).join("\n")}

## Sources
${brief.sources.map((source) => `- ${source.title}: ${source.url || "limited offline analysis"} (${source.label}; ${source.limitation || "review before relying on it"})`).join("\n")}
`;
}

export function LaunchBriefView({ brief, startupIdeaId, activeAgent, building }: { brief: LaunchBrief; startupIdeaId?: string | null; activeAgent?: string | null; building?: boolean }) {
  const normalized = brief.normalizedBrief;
  const [question, setQuestion] = useState("What should I do today?");
  const [answer, setAnswer] = useState("Ask a question and I will answer from your saved Launch Brief, risks, roadmap, sources, and founder constraints.");
  const [references, setReferences] = useState<Array<{ id: string; label: string; url: string }>>([]);
  const [asking, setAsking] = useState(false);
  const [copied, setCopied] = useState(false);
  const markdown = useMemo(() => briefToMarkdown(brief), [brief]);
  const exportJson = useMemo(() => JSON.stringify(briefToExportJson(brief), null, 2), [brief]);
  const score = brief.evidenceScore?.score ?? brief.founderScore.overall;
  const dimensions = scoreDimensions(brief);
  const alternatives = [...brief.marketReality.directCompetitors, ...brief.marketReality.indirectAlternatives];
  const verifiedSources = brief.sources.filter((source) => source.verified).length;
  const sourceTypes = [...new Set(brief.sources.map((source) => source.type))].filter(Boolean).slice(0, 4).join(", ") || "limited offline analysis";

  async function ask(prompt?: string) {
    const actualQuestion = (prompt || question).trim();
    if (!actualQuestion) return;
    setQuestion(actualQuestion);
    setAsking(true);
    try {
      const response = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: actualQuestion, startupIdeaId }),
      });
      const data = await response.json();
      setAnswer(data.answer || data.error || "Copilot could not answer from the workspace.");
      setReferences(Array.isArray(data.references) ? data.references.filter((reference: { url?: string }) => reference.url) : []);
    } finally {
      setAsking(false);
    }
  }

  async function copy() {
    try {
      await copyText(markdown);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setAnswer("Copy was blocked by this browser. Download the Markdown export instead.");
    }
  }

  return (
    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(300px,350px)] 2xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-6">
        <header className="terminal-card star-panel premium-report-grid overflow-hidden p-6 md:p-10">
          <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_190px]">
            <div className="min-w-0">
              <p className="mono-label">Launch Brief Workspace</p>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white md:text-6xl">{normalized.cleanStartupTitle}</h1>
              <p className="mt-5 max-w-3xl text-lg leading-8 text-lp-muted">{normalized.oneLineIdea}</p>
              <div className="mt-6 flex flex-wrap gap-2">
                <Pill value={normalized.primaryUser || normalized.targetUserSegment} />
                <Pill value={brief.evidenceScore?.verdict.replaceAll("_", " ") || brief.readinessLabel} />
                {building && <Pill value="Working" />}
              </div>
            </div>
            <div className="w-full border border-white/15 bg-black/30 p-6 text-center">
              <p className="mono-label">Evidence score</p>
              <p className="mt-3 text-6xl font-semibold">{score}</p>
              <p className="mt-1 text-xs text-lp-subtle">out of 100</p>
              <div className="mt-5 h-1 overflow-hidden bg-white/10">
                <div className="h-full bg-white/80" style={{ width: `${score}%` }} />
              </div>
              <div className="mt-4 flex justify-center">
                <Pill value={building ? "Working" : "Complete"} />
              </div>
              <p className="mt-3 text-[11px] leading-5 text-lp-subtle">{brief.sources.length} retained source records</p>
            </div>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <div className="border-t border-white/15 pt-5">
              <p className="mono-label">Current bottleneck</p>
              <p className="mt-2 text-sm leading-6 text-white">{brief.currentBottleneck}</p>
            </div>
            <div className="border-t border-white/15 pt-5">
              <p className="mono-label">Positioning</p>
              <p className="mt-2 text-sm leading-6 text-white">{normalized.positioning}</p>
            </div>
            <div className="border-t border-white/15 pt-5">
              <p className="mono-label">Next best action</p>
              <p className="mt-2 text-sm leading-6 text-white">{normalized.nextBestAction}</p>
            </div>
          </div>
        </header>

        <CopilotPanel
          className="xl:hidden"
          question={question}
          answer={answer}
          references={references}
          asking={asking}
          onQuestionChange={setQuestion}
          onAsk={(prompt) => void ask(prompt)}
        />

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            ["Founder constraints", normalized.founderConstraints.join("; ")],
            ["Evidence summary", normalized.evidenceSummary],
            ["Research focus", normalized.researchFocus],
            ["Source coverage", `${brief.sources.length} retained sources · ${verifiedSources} opened directly · ${sourceTypes}`],
          ].map(([label, value]) => (
            <article key={label} className="terminal-card p-4">
              <p className="mono-label">{label}</p>
              <p className="mt-2 text-xs leading-5 text-lp-muted">{value}</p>
            </article>
          ))}
        </section>

        <Section eyebrow="Founder Reality Check" title="Evidence, verdict, and immediate constraint">
          <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
            <div className="space-y-4">
              <div className="border border-white/10 bg-white/[0.025] p-5">
                <p className="mono-label">Strongest signal</p>
                <p className="mt-2 text-sm leading-6">{brief.strongestPoint}</p>
              </div>
              <div className="border border-white/10 bg-white/[0.025] p-5">
                <p className="mono-label">Weakest signal</p>
                <p className="mt-2 text-sm leading-6">{brief.weakestPoint}</p>
              </div>
              <div className="border border-amber-400/20 bg-amber-400/5 p-5">
                <p className="mono-label">What could be wrong</p>
                <p className="mt-2 text-sm leading-6 text-amber-100/90">{brief.evidenceScore?.whatCouldBeWrong || "The source set may not represent the exact first user segment."}</p>
              </div>
            </div>
            <div className="space-y-4">
              {dimensions.map(([label, value, max]) => (
                <div key={label}>
                  <div className="flex justify-between gap-4 text-xs">
                    <span className="text-lp-muted">{label}</span>
                    <span>{value}/{max}</span>
                  </div>
                  <div className="mt-2 h-1.5 bg-white/10">
                    <div className="h-full bg-white/75" style={{ width: `${(value / max) * 100}%` }} />
                  </div>
                </div>
              ))}
              {brief.evidenceScore?.scoreCapReason && <p className="pt-2 text-xs leading-5 text-amber-200/80">{brief.evidenceScore.scoreCapReason}</p>}
            </div>
          </div>
        </Section>

        <Section eyebrow="Validated direction" title="The clean business version">
          <div className="grid gap-4 md:grid-cols-2">
            {[
              ["Original idea", normalized.originalIdeaSummary],
              ["Refined idea", normalized.refinedIdea],
              ["Target user", normalized.targetUserSegment],
              ["Problem", normalized.problemStatement],
              ["Value proposition", normalized.valueProposition],
              ["Why this wedge is sharper", normalized.whyThisIsSharper],
            ].map(([label, value]) => (
              <div key={label} className="border border-white/10 bg-white/[0.025] p-5">
                <p className="mono-label">{label}</p>
                <p className="mt-2 text-sm leading-6 text-white">{value}</p>
              </div>
            ))}
          </div>
        </Section>

        <AgentProgress agents={brief.agents} activeAgent={activeAgent} building={building} />

        <Section eyebrow="Market reality" title="Competitors, alternatives, and the real gap">
          {brief.marketReality.noDirectCompetitorMessage && (
            <div className="mb-5 border border-amber-400/20 bg-amber-400/5 p-4 text-sm leading-6 text-amber-100/90">
              {brief.marketReality.noDirectCompetitorMessage}
            </div>
          )}
          <p className="max-w-4xl text-sm leading-7 text-lp-muted">{brief.marketReality.summary}</p>
          <p className="mt-4 text-sm leading-7 text-white"><span className="text-lp-muted">Positioning gap:</span> {brief.marketReality.positioningGap}</p>
          <p className="mt-6 font-mono text-[10px] uppercase tracking-wider text-lp-subtle md:hidden">Swipe horizontally to compare alternatives →</p>
          <div className="mt-7 overflow-x-auto">
            <table className="w-full min-w-[920px] border-collapse text-left text-sm">
              <thead className="text-lp-subtle">
                <tr>
                  {["Alternative", "Type", "What users use it for", "Strength", "Gap", "Confidence", "Source"].map((heading) => (
                    <th key={heading} className="border-b border-white/15 py-3 pr-5 font-mono text-[11px] uppercase tracking-wider">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(alternatives.length ? alternatives : [{ name: "No exact direct competitor verified", type: "Evidence gap", useCase: "Ask users what they use now.", strength: "Honest uncertainty.", gap: "Needs direct validation.", confidence: "Low" as const, sourceUrl: undefined }]).map((row) => (
                  <tr key={`${row.name}-${row.type}`}>
                    <td className="border-b border-white/10 py-4 pr-5 font-medium text-white">{row.name}</td>
                    <td className="border-b border-white/10 py-4 pr-5 text-lp-muted">{row.type}</td>
                    <td className="border-b border-white/10 py-4 pr-5 text-lp-muted">{row.useCase}</td>
                    <td className="border-b border-white/10 py-4 pr-5 text-lp-muted">{row.strength}</td>
                    <td className="border-b border-white/10 py-4 pr-5 text-lp-muted">{row.gap}</td>
                    <td className="border-b border-white/10 py-4 pr-5"><Pill value={row.confidence} /></td>
                    <td className="border-b border-white/10 py-4 text-lp-muted">{row.sourceUrl ? <a className="hover:text-white" href={row.sourceUrl} target="_blank" rel="noreferrer">Open</a> : "Founder input"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section eyebrow="Risk register" title="Assumptions converted into tests">
          <p className="mb-4 font-mono text-[10px] uppercase tracking-wider text-lp-subtle md:hidden">Swipe horizontally to review every test →</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-left text-sm">
              <thead className="text-lp-subtle">
                <tr>
                  {["Assumption", "Why it matters", "Risk", "Experiment", "Success signal", "Stop/pivot trigger"].map((heading) => (
                    <th key={heading} className="border-b border-white/15 py-3 pr-5 font-mono text-[11px] uppercase tracking-wider">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {brief.riskRegister.map((risk) => (
                  <tr key={risk.assumption}>
                    <td className="border-b border-white/10 py-4 pr-5 font-medium">{risk.assumption}</td>
                    <td className="border-b border-white/10 py-4 pr-5 text-lp-muted">{risk.whyItMatters}</td>
                    <td className="border-b border-white/10 py-4 pr-5"><Pill value={risk.riskLevel} /></td>
                    <td className="border-b border-white/10 py-4 pr-5 text-lp-muted">{risk.test}</td>
                    <td className="border-b border-white/10 py-4 pr-5 text-lp-muted">{risk.successSignal}</td>
                    <td className="border-b border-white/10 py-4 text-lp-muted">{risk.stopOrPivotTrigger}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <section className="grid gap-6 lg:grid-cols-2">
          <Section eyebrow="MVP scope" title="The narrow pilot">
            <p className="text-sm leading-7 text-lp-muted">{brief.mvpPlan.goal}</p>
            <div className="mt-5 border border-white/10 bg-white/[0.025] p-5">
              <p className="mono-label">Manual / concierge pilot</p>
              <p className="mt-2 text-sm leading-6">{brief.mvpPlan.manualPilot}</p>
            </div>
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <div>
                <p className="mono-label">Must have</p>
                <ul className="mt-3 space-y-2 text-sm text-lp-muted">{brief.mvpPlan.mustHave.map((item) => <li key={item} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />{item}</li>)}</ul>
              </div>
              <div>
                <p className="mono-label">Do not build yet</p>
                <ul className="mt-3 space-y-2 text-sm text-lp-muted">{brief.mvpPlan.doNotBuildYet.map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
            </div>
            <p className="mt-5 border-t border-white/10 pt-5 text-sm leading-6 text-white"><span className="text-lp-muted">Success metric:</span> {brief.mvpPlan.successMetric}</p>
          </Section>

          <Section eyebrow="Roadmap" title="Bottleneck-first timeline">
            <div className="space-y-5">
              {[
                ["Next 24 hours", brief.roadmapPlan.next24Hours],
                ["7-day sprint", brief.roadmapPlan.sevenDaySprint],
                ["30-day pilot", brief.roadmapPlan.thirtyDayPilot],
                ["60/90-day direction", brief.roadmapPlan.sixtyNinetyDays],
              ].map(([label, actions]) => (
                <div key={label as string} className="border-l border-white/20 pl-4">
                  <h3 className="font-semibold">{label as string}</h3>
                  <ul className="mt-2 space-y-2 text-sm leading-6 text-lp-muted">{(actions as string[]).map((item) => <li key={item}>{item}</li>)}</ul>
                </div>
              ))}
            </div>
            <p className="mt-5 border-t border-white/10 pt-5 text-sm leading-6 text-amber-100/90"><span className="text-lp-muted">Stop/pivot:</span> {brief.roadmapPlan.stopPivotCriteria}</p>
          </Section>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <Section eyebrow="Opportunity layer" title="Programs, communities, and support">
            <div className="space-y-4">
              {brief.opportunityLayer.map((item) => (
                <article key={item.name} className="border border-white/10 bg-white/[0.025] p-5">
                  <h3 className="font-semibold">{item.name}</h3>
                  <p className="mt-2 text-sm leading-6 text-lp-muted">{item.whyRelevant}</p>
                  <p className="mt-3 text-sm leading-6 text-white"><span className="text-lp-muted">Next action:</span> {item.nextAction}</p>
                  <p className="mt-2 text-xs leading-5 text-amber-200/80">{item.eligibilityUncertainty}</p>
                </article>
              ))}
            </div>
            <p className="mt-5 text-xs leading-5 text-lp-muted">Investor outreach is premature before direct validation, usage evidence, or repeated willingness to pay.</p>
          </Section>

          <Section eyebrow="Pitch assets" title="Evidence-safe messaging">
            <div className="space-y-5 text-sm leading-7">
              <div><p className="mono-label">One-line pitch</p><p className="mt-2 text-white">{brief.pitchAssets.oneLinePitch}</p></div>
              <div><p className="mono-label">30-second pitch</p><p className="mt-2 text-lp-muted">{brief.pitchAssets.elevatorPitch}</p></div>
              <div><p className="mono-label">Landing headline</p><p className="mt-2 text-white">{brief.pitchAssets.landingHeadline}</p></div>
              <div><p className="mono-label">User interview message</p><p className="mt-2 text-lp-muted">{brief.pitchAssets.interviewMessage}</p></div>
              <div>
                <p className="mono-label">6-slide outline</p>
                <ol className="mt-2 space-y-1 text-lp-muted">{brief.pitchAssets.deckOutline.map((item, index) => <li key={item}>{index + 1}. {item}</li>)}</ol>
              </div>
            </div>
          </Section>
        </section>

        <Section eyebrow="Source ledger" title={`${brief.sources.length} retained evidence sources`}>
          <div className="divide-y divide-white/10">
            {brief.sources.map((source) => (
              <div key={source.id} className="grid gap-3 py-5 md:grid-cols-[minmax(0,1fr)_auto]">
                <div className="min-w-0">
                  {source.url ? (
                    <a href={source.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-white hover:underline">{source.title}</a>
                  ) : (
                    <p className="text-sm font-medium text-white">{source.title}</p>
                  )}
                  <p className="mt-1 text-xs leading-5 text-lp-muted">{source.limitation || source.snippet || "Review this source before relying on it."}</p>
                </div>
                <div className="flex flex-wrap items-start gap-2">
                  <Pill value={source.label} />
                  <span className="rounded-full border border-white/15 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-lp-subtle">{source.type}</span>
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <aside className="min-w-0 space-y-6 xl:sticky xl:top-5 xl:max-h-[calc(100vh-2.5rem)] xl:self-start xl:overflow-y-auto xl:overscroll-contain xl:pr-1">
        <CopilotPanel
          className="hidden xl:block"
          question={question}
          answer={answer}
          references={references}
          asking={asking}
          onQuestionChange={setQuestion}
          onAsk={(prompt) => void ask(prompt)}
        />

        <section className="terminal-card star-panel p-5">
          <div className="flex items-center gap-2"><Download className="h-4 w-4" /><h2 className="font-semibold">Export Launch Brief</h2></div>
          <div className="mt-4 grid gap-2">
            <button className="btn-secondary w-full" onClick={copy}>{copied ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}{copied ? "Copied" : "Copy Launch Brief"}</button>
            <button className="btn-secondary w-full" onClick={() => downloadFile("launch-brief.md", markdown, "text/markdown")}><Download className="h-4 w-4" /> Download Markdown</button>
            <button className="btn-secondary w-full" onClick={() => downloadFile("launch-brief.json", exportJson, "application/json")}><FileJson className="h-4 w-4" /> Download JSON</button>
          </div>
        </section>

        <section className="terminal-card p-5">
          <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-300" /><h2 className="font-semibold">Responsible AI</h2></div>
          <ul className="mt-4 space-y-3 text-xs leading-5 text-lp-muted">{brief.responsibleAINotes.map((note) => <li key={note}>{note}</li>)}</ul>
        </section>

        <section className="terminal-card p-5">
          <div className="flex items-center gap-2"><Sparkles className="h-4 w-4" /><h2 className="font-semibold">Report quality</h2></div>
          <p className="mt-3 text-xs leading-5 text-lp-muted">The report uses cleaned founder language and retained sources. It does not claim startup success, active eligibility, traction, revenue, funding, or market size without evidence.</p>
        </section>
      </aside>
    </div>
  );
}
