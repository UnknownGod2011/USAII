"use client";

import type { IdeaEvaluation } from "@/lib/evaluation";
import { ArrowRight, Send } from "lucide-react";
import { Badge } from "@/components/Badge";
import { ResearchProgress } from "@/components/ResearchProgress";

export type ChatMessage = {
  id: string;
  role: "assistant" | "user" | "system" | "welcome";
  text: string;
  validationMode?: "gemini";
};

type ChatInterviewViewProps = {
  messages: ChatMessage[];
  currentQuestion: string;
  input: string;
  loading: boolean;
  submitting: boolean;
  phase: "interview" | "complete" | "researching" | "verdict";
  validatedCount: number;
  totalQuestions: number;
  geminiAvailable: boolean;
  error: string;
  behindScenes: string;
  researchStep: number;
  evaluation: IdeaEvaluation | null;
  brainstormText: string;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  onRetry: () => void;
  onBrainstormChange: (value: string) => void;
  onBrainstormSubmit: () => void;
  onAcceptPivot: () => void;
  onProceedAnyway: () => void;
  onOpenWorkspace: () => void;
  onViewResearch: () => void;
};

export function ChatInterviewView({
  messages,
  currentQuestion,
  input,
  loading,
  submitting,
  phase,
  validatedCount,
  totalQuestions,
  geminiAvailable,
  error,
  behindScenes,
  researchStep,
  evaluation,
  brainstormText,
  onInputChange,
  onSubmit,
  onRetry,
  onBrainstormChange,
  onBrainstormSubmit,
  onAcceptPivot,
  onProceedAnyway,
  onOpenWorkspace,
  onViewResearch,
}: ChatInterviewViewProps) {
  const progress = Math.min(100, Math.round((validatedCount / Math.max(totalQuestions, 1)) * 100));
  const showResearch = phase === "researching" || phase === "verdict" || phase === "complete";

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <div className="glass rounded-[32px] p-6">
        {error && (
          <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            <p className="font-semibold">AI interview error</p>
            <p className="mt-1 leading-6">{error}</p>
            <button className="btn-primary mt-3 bg-red-900 px-4 py-2 text-xs text-white" onClick={onRetry}>
              Retry
            </button>
          </div>
        )}

        {currentQuestion && phase === "interview" && (
          <div className="rounded-2xl border border-lp-accent/30 bg-lp-accent/10 px-4 py-3 text-sm leading-6 text-stone-100">
            {loading ? "Preparing first question..." : currentQuestion}
          </div>
        )}

        <div className="chat-scroll mt-5 max-h-[460px] space-y-3 overflow-y-auto rounded-[26px] p-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                message.role === "user"
                  ? "ml-auto border border-lp-accent/30 bg-lp-accent/15 text-stone-100"
                  : message.role === "system"
                    ? "border border-amber-500/30 bg-amber-500/10 text-amber-200"
                    : "border border-white/10 bg-lp-elevated text-lp-muted"
              }`}
            >
              {message.role === "assistant" && message.validationMode && (
                <div className="mb-2">
                  <Badge label="AI interview" />
                </div>
              )}
              {message.text}
            </div>
          ))}

          {showResearch && (
            <div className="pt-2">
              <ResearchProgress activeStep={researchStep} done={phase === "verdict"} evaluation={evaluation} />
            </div>
          )}
        </div>

        {phase === "interview" && (
          <div className="mt-4 flex gap-2">
            <input
              className="input-field min-w-0 flex-1 px-4 py-3"
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              placeholder={loading ? "Loading..." : currentQuestion || "Your answer"}
              disabled={loading || submitting}
              onKeyDown={(e) => e.key === "Enter" && onSubmit()}
            />
            <button
              className="btn-primary inline-flex items-center gap-2 px-5 py-3 text-sm disabled:opacity-60"
              onClick={onSubmit}
              disabled={loading || submitting || !input.trim()}
            >
              {submitting ? "..." : (
                <>
                  <Send className="h-4 w-4" /> Send
                </>
              )}
            </button>
          </div>
        )}

        {phase === "verdict" && evaluation && (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap gap-2">
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
                  Accept suggested pivot
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
            </div>
            {evaluation.verdict !== "continue" && (
              <div className="flex gap-2">
                <input
                  className="input-field min-w-0 flex-1 px-4 py-3 text-sm"
                  value={brainstormText}
                  onChange={(event) => onBrainstormChange(event.target.value)}
                  placeholder="Brainstorm or enter a revised idea to research"
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

      {!showResearch && (
        <aside className="space-y-4">
          <section className="bento-card rounded-[28px] p-5">
            <p className="text-sm font-semibold text-stone-100">Behind the scenes</p>
            <p className="mt-2 text-sm leading-6 text-lp-muted">{behindScenes}</p>
          </section>
          <section className="bento-card rounded-[28px] p-5">
            <p className="text-sm font-semibold text-stone-100">Progress</p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-lp-accent transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-2 font-mono text-xs text-lp-subtle">
              {validatedCount}/{totalQuestions} answered · {geminiAvailable ? "Gemini connected" : "Gemini key required"} · AI interview
            </p>
          </section>
        </aside>
      )}
    </div>
  );
}
