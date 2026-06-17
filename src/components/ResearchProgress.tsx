"use client";

import { Badge } from "@/components/Badge";
import { RESEARCH_PROGRESS_STEPS } from "@/lib/intake-questions";
import type { IdeaEvaluation } from "@/lib/evaluation";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";

type ResearchProgressProps = {
  activeStep: number;
  done: boolean;
  evaluation: IdeaEvaluation | null;
};

export function ResearchProgress({ activeStep, done, evaluation }: ResearchProgressProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-lp-surface p-4">
        <p className="text-sm font-semibold text-stone-100">Research pass in progress</p>
        <ul className="mt-4 space-y-3">
          {RESEARCH_PROGRESS_STEPS.map((step, index) => {
            const complete = done || index < activeStep;
            const active = !done && index === activeStep;
            return (
              <li key={step} className="flex items-start gap-3 text-sm text-lp-muted">
                {complete ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                ) : active ? (
                  <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-lp-accent" />
                ) : (
                  <Circle className="mt-0.5 h-4 w-4 shrink-0 text-lp-subtle" />
                )}
                <span className={active ? "font-medium text-stone-100" : ""}>{step}</span>
              </li>
            );
          })}
        </ul>
      </div>

      {evaluation && done && (
        <div className="verdict-card rounded-[24px] p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              label={
                evaluation.label === "fallback"
                  ? "Fallback analysis"
                  : evaluation.label === "live"
                    ? "Live research"
                    : "Hybrid research"
              }
            />
            <Badge
              label={
                evaluation.verdict === "continue"
                  ? "Continue"
                  : evaluation.verdict === "modify"
                    ? "Needs modification"
                    : "Brainstorm further"
              }
            />
            <Badge label={`Score ${evaluation.score}/100`} />
            <Badge label={evaluation.rating} />
          </div>
          <h3 className="mt-4 text-xl font-semibold">{evaluation.headline}</h3>
          <p className="mt-3 text-sm leading-6 text-lp-muted">{evaluation.summary}</p>
          {evaluation.suggestedPivot && evaluation.verdict !== "continue" && (
            <p className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-sm leading-6 text-stone-200">
              Suggested pivot: {evaluation.suggestedPivot}
            </p>
          )}
          {evaluation.strengths.length > 0 && (
            <div className="mt-4">
              <p className="mono-label text-lp-subtle">Strengths</p>
              <ul className="mt-2 space-y-1 text-sm text-stone-200">
                {evaluation.strengths.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </div>
          )}
          {evaluation.concerns.length > 0 && (
            <div className="mt-4">
              <p className="mono-label text-lp-subtle">Concerns</p>
              <ul className="mt-2 space-y-1 text-sm text-stone-200">
                {evaluation.concerns.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </div>
          )}
          {(evaluation.modifications.length > 0 || evaluation.brainstormDirections.length > 0) && (
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="mono-label text-lp-subtle">Recommended next move</p>
              <ul className="mt-2 space-y-1 text-sm text-stone-200">
                {(evaluation.modifications.length ? evaluation.modifications : evaluation.brainstormDirections).map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="mt-4 text-xs leading-5 text-lp-subtle">
            LaunchPilot does not predict startup success or funding. This verdict is evidence-based guidance, not a guarantee.
          </p>
        </div>
      )}
    </div>
  );
}
