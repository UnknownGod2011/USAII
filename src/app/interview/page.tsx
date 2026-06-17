"use client";

import { Badge } from "@/components/Badge";
import { ChatInterviewView, type ChatMessage } from "@/components/ChatInterviewView";
import { Nav } from "@/components/Nav";
import { VoiceInterviewView } from "@/components/VoiceInterviewView";
import { useVoiceConversation } from "@/hooks/useVoiceConversation";
import type { IdeaEvaluation } from "@/lib/evaluation";
import { intakeToFounderProfile, type IntakeAnswers } from "@/lib/intake-questions";
import { loadIntakeSession, saveIntakeSession } from "@/lib/intake-session";
import type { VoiceOrbStatus } from "@/lib/voice";
import { preloadSpeechVoices } from "@/lib/voice";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";

type Phase = "interview" | "complete" | "researching" | "verdict";

type InterviewApiResponse = {
  validation: { valid: boolean; mode: "gemini"; feedback?: string };
  assistantMessage: string;
  currentQuestion: string | null;
  validatedCount: number;
  totalQuestions: number;
  answers: IntakeAnswers;
  askedQuestions: string[];
  isComplete: boolean;
  questionNumber: number | null;
  error?: string;
};

function InterviewInner() {
  const router = useRouter();
  const params = useSearchParams();
  const voiceMode = params.get("mode") === "voice";

  const [phase, setPhase] = useState<Phase>("interview");
  const [validatedCount, setValidatedCount] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(18);
  const [answers, setAnswers] = useState<IntakeAnswers>({});
  const [askedQuestions, setAskedQuestions] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<VoiceOrbStatus>("idle");
  const [voiceStatusLabel, setVoiceStatusLabel] = useState("Preparing your intake session");
  const [behindScenes, setBehindScenes] = useState("Preparing your intake session");
  const [researchStep, setResearchStep] = useState(0);
  const [evaluation, setEvaluation] = useState<IdeaEvaluation | null>(null);
  const [brainstormText, setBrainstormText] = useState("");
  const [geminiAvailable, setGeminiAvailable] = useState(false);
  const [interviewError, setInterviewError] = useState("");
  const [showCorrection, setShowCorrection] = useState(false);
  const [correctionText, setCorrectionText] = useState("");

  const messageIdRef = useRef(0);
  const bootedRef = useRef(false);
  const phaseRef = useRef(phase);
  const answersRef = useRef(answers);
  const validatedCountRef = useRef(validatedCount);
  const currentQuestionRef = useRef(currentQuestion);
  const askedQuestionsRef = useRef(askedQuestions);
  const totalQuestionsRef = useRef(totalQuestions);
  const voiceConversationRef = useRef<ReturnType<typeof useVoiceConversation> | null>(null);

  useEffect(() => {
    if (voiceMode) preloadSpeechVoices();
  }, [voiceMode]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);
  useEffect(() => {
    validatedCountRef.current = validatedCount;
  }, [validatedCount]);
  useEffect(() => {
    currentQuestionRef.current = currentQuestion;
  }, [currentQuestion]);
  useEffect(() => {
    askedQuestionsRef.current = askedQuestions;
  }, [askedQuestions]);
  useEffect(() => {
    totalQuestionsRef.current = totalQuestions;
  }, [totalQuestions]);

  const updateVoiceStatus = useCallback((status: VoiceOrbStatus, label: string) => {
    setVoiceStatus(status);
    setVoiceStatusLabel(label);
  }, []);

  const applyInterviewState = useCallback((data: Pick<InterviewApiResponse, "validatedCount" | "totalQuestions" | "answers" | "currentQuestion" | "askedQuestions">) => {
    validatedCountRef.current = data.validatedCount;
    totalQuestionsRef.current = data.totalQuestions || totalQuestionsRef.current;
    answersRef.current = data.answers || {};
    currentQuestionRef.current = data.currentQuestion || "";
    askedQuestionsRef.current = data.askedQuestions || [];

    setValidatedCount(validatedCountRef.current);
    setTotalQuestions(totalQuestionsRef.current);
    setAnswers(answersRef.current);
    setCurrentQuestion(currentQuestionRef.current);
    setAskedQuestions(askedQuestionsRef.current);
  }, []);

  const pushMessage = useCallback((message: Omit<ChatMessage, "id">) => {
    if (voiceMode) return;
    messageIdRef.current += 1;
    setMessages((prev) => [...prev, { ...message, id: `msg-${messageIdRef.current}` }]);
  }, [voiceMode]);

  const persistSession = useCallback(() => {
    saveIntakeSession({
      validatedCount: validatedCountRef.current,
      answers: answersRef.current,
      phase: phaseRef.current,
      currentQuestion,
      askedQuestions: askedQuestionsRef.current,
      totalQuestions: totalQuestionsRef.current,
    });
  }, [currentQuestion]);

  useEffect(() => {
    persistSession();
  }, [validatedCount, answers, phase, currentQuestion, persistSession]);

  const runResearch = useCallback(
    async (finalAnswers: IntakeAnswers, ideaOverride?: string) => {
      setPhase("researching");
      setBehindScenes("Research agents running");
      updateVoiceStatus("thinking", "Researching your idea");
      if (voiceMode) {
        voiceConversationRef.current?.speakThenListen(
          "Thanks for answering — let me carry out some real market research now. Evaluating your startup idea.",
          updateVoiceStatus,
          false,
        );
      } else {
        pushMessage({ role: "system", text: "Research agent working: evaluating your startup idea with current sources.", validationMode: "gemini" });
      }
      setResearchStep(0);

      const stepTimer = window.setInterval(() => {
        setResearchStep((step) => Math.min(step + 1, 7));
      }, 900);

      try {
        const result = await fetch("/api/evaluate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers: finalAnswers, ideaOverride }),
        }).then((res) => res.json());

        window.clearInterval(stepTimer);
        setResearchStep(7);
        setEvaluation(result);
        setPhase("verdict");
        setBehindScenes("Verdict ready");
        updateVoiceStatus("idle", "Verdict ready");

        const storedAnswers = ideaOverride ? { ...finalAnswers, rawIdea: ideaOverride } : finalAnswers;
        const profile = intakeToFounderProfile(storedAnswers);
        localStorage.setItem("launchpilot-profile", JSON.stringify(profile));
        localStorage.setItem("launchpilot-intake", JSON.stringify({ answers: storedAnswers, evaluation: result }));
        localStorage.setItem("launchpilot-brief", JSON.stringify(result.brief));
      } catch {
        window.clearInterval(stepTimer);
        setBehindScenes("Research failed — using registry fallback");
        pushMessage({
          role: "system",
          text: "Research could not complete. You can still continue with saved intake answers.",
          validationMode: "gemini",
        });
      }
    },
    [pushMessage, updateVoiceStatus, voiceMode],
  );

  const rerunResearchWithIdea = useCallback(
    async (idea: string) => {
      const trimmed = idea.trim();
      if (!trimmed) return;
      const nextAnswers = { ...answersRef.current, rawIdea: trimmed };
      answersRef.current = nextAnswers;
      setAnswers(nextAnswers);
      setBrainstormText("");
      if (!voiceMode) {
        pushMessage({ role: "user", text: `Evaluate revised idea: ${trimmed}` });
        pushMessage({ role: "system", text: "Research agent working: rescoring the revised idea.", validationMode: "gemini" });
      }
      await runResearch(nextAnswers, trimmed);
    },
    [pushMessage, runResearch, voiceMode],
  );

  const proceedToDashboard = useCallback(
    (force = false) => {
      if (force) localStorage.setItem("launchpilot-proceed-override", "true");
      router.push("/dashboard");
    },
    [router],
  );

  const processInterviewResponse = useCallback(
    async (data: InterviewApiResponse) => {
      if (data.error) {
        setInterviewError(data.error);
        setBehindScenes("AI interview error");
        updateVoiceStatus("idle", "AI interview error — retry or switch to text");
        if (!voiceMode) {
          pushMessage({ role: "system", text: `${data.error} Use Retry to continue.`, validationMode: "gemini" });
        }
        return;
      }

      setInterviewError("");
      applyInterviewState(data);

      if (!data.validation.valid) {
        setBehindScenes(data.validation.feedback?.includes("didn't quite get") ? "Re-asking the same question" : "Answer needs more detail");
        if (voiceMode) {
          voiceConversationRef.current?.speakThenListen(data.assistantMessage, updateVoiceStatus);
        } else {
          pushMessage({ role: "assistant", text: data.assistantMessage, validationMode: data.validation.mode });
        }
        return;
      }

      if (data.isComplete) {
        setPhase("complete");
        setBehindScenes("Intake complete · starting research");
        if (voiceMode) {
          voiceConversationRef.current?.speakThenListen(data.assistantMessage, updateVoiceStatus, false);
        } else {
          pushMessage({ role: "assistant", text: data.assistantMessage, validationMode: data.validation.mode });
        }
        await runResearch(data.answers);
        return;
      }

      setBehindScenes(`AI interview · question ${data.questionNumber || data.validatedCount + 1} of about ${data.totalQuestions}`);
      if (voiceMode) {
        voiceConversationRef.current?.speakThenListen(data.assistantMessage, updateVoiceStatus);
      } else {
        pushMessage({ role: "assistant", text: data.assistantMessage, validationMode: data.validation.mode });
      }
    },
    [applyInterviewState, pushMessage, runResearch, updateVoiceStatus, voiceMode],
  );

  const submitAnswer = useCallback(
    async (rawAnswer?: string) => {
      const trimmed = (rawAnswer ?? input).trim();
      if (!trimmed || submitting || phaseRef.current !== "interview") return false;

      setSubmitting(true);
      voiceConversationRef.current?.markThinking(updateVoiceStatus);
      voiceConversationRef.current?.stopAll();

      if (!voiceMode) {
        pushMessage({ role: "user", text: trimmed });
        setInput("");
      }

      try {
        const data: InterviewApiResponse = await fetch("/api/interview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            validatedCount: validatedCountRef.current,
            answers: answersRef.current,
            phase: phaseRef.current,
            currentQuestion: currentQuestionRef.current,
            askedQuestions: askedQuestionsRef.current,
            answer: trimmed,
          }),
        }).then((res) => res.json());

        await processInterviewResponse(data);
        return true;
      } catch {
        if (!voiceMode) {
          pushMessage({
            role: "system",
            text: "Could not validate that answer. Try again.",
            validationMode: "gemini",
          });
        } else {
          updateVoiceStatus("idle", "Something went wrong — try again or switch to text");
          setShowCorrection(true);
          setCorrectionText(trimmed);
        }
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [input, processInterviewResponse, pushMessage, submitting, updateVoiceStatus, voiceMode],
  );

  const retryInterview = useCallback(async () => {
    if (submitting) return;
    setInterviewError("");
    if (currentQuestionRef.current) {
      setBehindScenes("AI interview ready");
      if (voiceMode) {
        voiceConversationRef.current?.speakThenListen(currentQuestionRef.current, updateVoiceStatus);
      }
      return;
    }
    setLoading(true);
    try {
      const data: InterviewApiResponse = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ init: true }),
      }).then((res) => res.json());
      await processInterviewResponse(data);
    } catch {
      setInterviewError("Could not reach the AI interview service. Check your Gemini key or network and retry.");
    } finally {
      setLoading(false);
    }
  }, [processInterviewResponse, submitting, updateVoiceStatus, voiceMode]);

  const voiceConversation = useVoiceConversation({
    enabled: voiceMode,
    active: phase === "interview" && !loading && !submitting,
    onSilenceSubmit: async (transcript) => {
      await submitAnswer(transcript);
    },
  });

  useEffect(() => {
    voiceConversationRef.current = voiceConversation;
  }, [voiceConversation]);

  const applyOpening = useCallback(
    (data: {
      assistantMessage: string;
      currentQuestion: string | null;
      validatedCount: number;
      totalQuestions: number;
      answers: IntakeAnswers;
      askedQuestions: string[];
      phase: Phase;
      error?: string;
    }) => {
      if (data.error) {
        setInterviewError(data.error);
        setBehindScenes("AI interview error");
        if (!voiceMode) pushMessage({ role: "system", text: `${data.error} Use Retry to start again.`, validationMode: "gemini" });
        return;
      }
      applyInterviewState(data);
      setPhase(data.phase);
      setInterviewError("");
      setBehindScenes("AI interview ready");

      if (voiceMode) {
        voiceConversationRef.current?.speakThenListen(data.assistantMessage, updateVoiceStatus);
      } else {
        pushMessage({ role: "assistant", text: data.assistantMessage, validationMode: "gemini" });
      }
    },
    [applyInterviewState, pushMessage, updateVoiceStatus, voiceMode],
  );

  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;

    let cancelled = false;

    async function boot() {
      const saved = loadIntakeSession();

      if (saved && saved.validatedCount > 0) {
        applyInterviewState({
          validatedCount: saved.validatedCount,
          totalQuestions: saved.totalQuestions || 18,
          answers: saved.answers,
          currentQuestion: saved.currentQuestion,
          askedQuestions: saved.askedQuestions || (saved.currentQuestion ? [saved.currentQuestion] : []),
        });
        setPhase(saved.phase === "verdict" || saved.phase === "researching" ? "interview" : saved.phase);
        setLoading(false);
        setBehindScenes(`Resumed AI interview`);
        if (!voiceMode) {
          pushMessage({
            role: "system",
            text: `Resumed your AI interview.`,
            validationMode: "gemini",
          });
        }
        return;
      }

      try {
        const [voiceInfo, opening] = await Promise.all([
          fetch("/api/voice").then((res) => res.json()),
          fetch("/api/interview", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ init: true }),
          }).then((res) => res.json()),
        ]);

        if (cancelled) return;
        setGeminiAvailable(Boolean(voiceInfo?.geminiLive?.available));
        setBehindScenes(voiceInfo?.geminiLive?.available ? "Gemini key detected · AI interview active" : "Gemini key required for AI interview");
        applyOpening(opening);
      } catch {
        if (!cancelled) {
          setInterviewError("Could not start the AI interview. Check your Gemini key or network and retry.");
          pushMessage({ role: "system", text: "Could not start the AI interview. Check your Gemini key or network and retry.", validationMode: "gemini" });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    boot();
    return () => {
      cancelled = true;
      voiceConversationRef.current?.stopAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="shell-bg min-h-screen">
      <Nav />
      <section className="mx-auto max-w-7xl px-5 pb-10 pt-2">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="mono-label">Stage 1 intake</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-stone-50">
              {voiceMode ? "Voice conversation" : "Chat founder interview"}
            </h1>
          </div>
          {!voiceMode && (
            <div className="flex flex-wrap items-center gap-2">
              <Badge label="Chat mode" />
              <Badge label={interviewError ? "AI interview error" : "AI interview"} />
              <Badge label={`${validatedCount}/${totalQuestions} answered`} />
            </div>
          )}
        </div>

        {voiceMode ? (
          <VoiceInterviewView
            status={voiceStatus}
            statusLabel={voiceStatusLabel}
            currentQuestion={currentQuestion}
            validatedCount={validatedCount}
            totalQuestions={totalQuestions}
            phase={phase}
            loading={loading}
            error={interviewError}
            researchStep={researchStep}
            evaluation={evaluation}
            brainstormText={brainstormText}
            showCorrection={showCorrection}
            correctionText={correctionText}
            onCorrectionChange={setCorrectionText}
            onCorrectionSubmit={() => {
              setShowCorrection(false);
              void submitAnswer(correctionText);
            }}
            onRetry={retryInterview}
            onBrainstormChange={setBrainstormText}
            onBrainstormSubmit={() => void rerunResearchWithIdea(brainstormText)}
            onAcceptPivot={() => evaluation?.suggestedPivot && void rerunResearchWithIdea(evaluation.suggestedPivot)}
            onProceedAnyway={() => proceedToDashboard(true)}
            onOpenWorkspace={() => proceedToDashboard(false)}
            onViewResearch={() => router.push("/research")}
          />
        ) : (
          <ChatInterviewView
            messages={messages}
            currentQuestion={currentQuestion}
            input={input}
            loading={loading}
            submitting={submitting}
            phase={phase}
            validatedCount={validatedCount}
            totalQuestions={totalQuestions}
            geminiAvailable={geminiAvailable}
            error={interviewError}
            behindScenes={behindScenes}
            researchStep={researchStep}
            evaluation={evaluation}
            brainstormText={brainstormText}
            onInputChange={setInput}
            onSubmit={() => void submitAnswer()}
            onRetry={retryInterview}
            onBrainstormChange={setBrainstormText}
            onBrainstormSubmit={() => void rerunResearchWithIdea(brainstormText)}
            onAcceptPivot={() => evaluation?.suggestedPivot && void rerunResearchWithIdea(evaluation.suggestedPivot)}
            onProceedAnyway={() => proceedToDashboard(true)}
            onOpenWorkspace={() => proceedToDashboard(false)}
            onViewResearch={() => router.push("/research")}
          />
        )}
      </section>
    </main>
  );
}

export default function InterviewPage() {
  return (
    <Suspense>
      <InterviewInner />
    </Suspense>
  );
}
