"use client";

import Orb, { orbHueForStatus } from "@/components/Orb";
import { ResearchProgress } from "@/components/ResearchProgress";
import type { IdeaEvaluation } from "@/lib/evaluation";
import type { VoiceOrbStatus } from "@/lib/voice";
import { ArrowRight, Keyboard } from "lucide-react";
import Link from "next/link";

type VoiceInterviewViewProps = {
  status: VoiceOrbStatus;
  statusLabel: string;
  currentQuestion: string;
  validatedCount: number;
  totalQuestions: number;
  phase: "interview" | "complete" | "researching" | "verdict";
  loading: boolean;
  error: string;
  researchStep: number;
  evaluation: IdeaEvaluation | null;
  brainstormText: string;
  showCorrection: boolean;
  correctionText: string;
  onCorrectionChange: (value: string) => void;
  onCorrectionSubmit: () => void;
  onRetry: () => void;
  onBrainstormChange: (value: string) => void;
  onBrainstormSubmit: () => void;
  onAcceptPivot: () => void;
  onProceedAnyway: () => void;
  onOpenWorkspace: () => void;
  onViewResearch: () => void;
};

export function VoiceInterviewView({
  status,
  statusLabel,
  currentQuestion,
  phase,
  loading,
  error,
  researchStep,
  evaluation,
  brainstormText,
  showCorrection,
  correctionText,
  onCorrectionChange,
  onCorrectionSubmit,
  onRetry,
  onBrainstormChange,
  onBrainstormSubmit,
  onAcceptPivot,
  onProceedAnyway,
  onOpenWorkspace,
  onViewResearch,
}: VoiceInterviewViewProps) {
  const showResearch = phase === "researching" || phase === "verdict" || phase === "complete";
  const orbActive = status === "listening" || status === "thinking" || status === "speaking";

  return (
    <div className="flex min-h-[calc(100vh-220px)] flex-col items-center justify-center">
      <div className="mb-5 flex w-full max-w-2xl justify-end px-2">
        <Link
          href="/interview?mode=chat"
          className="btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"
        >
          <Keyboard className="h-3.5 w-3.5" />
          Switch to text
        </Link>
      </div>

      {!showResearch ? (
        <>
          <div className="relative mx-auto mt-4 h-[min(52vw,320px)] w-[min(52vw,320px)] max-h-[320px] max-w-[320px]">
            <Orb
              hue={orbHueForStatus(status)}
              hoverIntensity={status === "listening" ? 2.2 : status === "thinking" ? 1.8 : 1.4}
              rotateOnHover={status !== "idle"}
              forceHoverState={orbActive}
              backgroundColor="#0a0a0b"
              className="rounded-full"
            />
          </div>

          <p className="mt-6 text-center text-sm font-semibold text-stone-100" aria-live="polite">
            {error ? "AI interview error" : loading ? "Preparing..." : statusLabel}
          </p>

          {error ? (
            <div className="mt-3 max-w-md text-center text-sm leading-6 text-red-300" aria-live="polite">
              <p>{error}</p>
              <button className="btn-primary mt-3 px-4 py-2 text-xs" onClick={onRetry}>
                Retry
              </button>
            </div>
          ) : currentQuestion && phase === "interview" ? (
            <p className="mt-3 max-w-md text-center text-sm leading-6 text-lp-muted" aria-live="polite">
              {currentQuestion}
            </p>
          ) : null}

          {showCorrection && (
            <div className="mt-6 w-full max-w-md border-t border-white/10 pt-4">
              <p className="text-xs font-medium text-lp-muted">Didn&apos;t catch that? Edit and resubmit:</p>
              <div className="mt-2 flex gap-2">
                <input
                  className="input-field min-w-0 flex-1 px-3 py-2 text-sm"
                  value={correctionText}
                  onChange={(e) => onCorrectionChange(e.target.value)}
                />
                <button
                  className="btn-primary px-4 py-2 text-xs"
                  onClick={onCorrectionSubmit}
                  disabled={!correctionText.trim()}
                >
                  Send
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="mt-4 flex w-full max-w-2xl flex-col items-center">
          {phase === "researching" ? (
            <>
              <div className="relative mx-auto h-[min(48vw,300px)] w-[min(48vw,300px)] max-h-[300px] max-w-[300px]">
                <Orb
                  hue={orbHueForStatus("thinking")}
                  hoverIntensity={2}
                  rotateOnHover
                  forceHoverState
                  backgroundColor="#0a0a0b"
                  className="rounded-full"
                />
              </div>
              <p className="mt-5 text-center text-sm text-lp-muted" aria-live="polite">
                Evaluating your startup idea...
              </p>
            </>
          ) : (
            <ResearchProgress activeStep={researchStep} done={phase === "verdict"} evaluation={evaluation} />
          )}
          {phase === "verdict" && evaluation && (
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {evaluation.verdict === "continue" && (
                <button
                  className="btn-accent inline-flex items-center gap-2 px-5 py-3 text-sm"
                  onClick={onOpenWorkspace}
                >
                  Open workspace <ArrowRight className="h-4 w-4" />
                </button>
              )}
              {evaluation.suggestedPivot && evaluation.verdict !== "continue" && (
                <button className="btn-primary px-5 py-3 text-sm" onClick={onAcceptPivot}>
                  Accept pivot
                </button>
              )}
              {evaluation.verdict !== "continue" && (
                <button className="btn-secondary px-5 py-3 text-sm" onClick={onProceedAnyway}>
                  Proceed anyway
                </button>
              )}
              <button className="btn-secondary px-5 py-3 text-sm" onClick={onViewResearch}>
                View full research
              </button>
              {evaluation.verdict !== "continue" && (
                <div className="mt-3 flex w-full max-w-xl gap-2">
                  <input
                    className="input-field min-w-0 flex-1 px-4 py-3 text-sm"
                    value={brainstormText}
                    onChange={(event) => onBrainstormChange(event.target.value)}
                    placeholder="Revised idea to research"
                  />
                  <button
                    className="btn-primary px-5 py-3 text-sm disabled:opacity-50"
                    disabled={!brainstormText.trim()}
                    onClick={onBrainstormSubmit}
                  >
                    Research
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
