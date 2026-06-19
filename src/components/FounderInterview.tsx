"use client";

import { Badge } from "./Badge";
import { EvidenceScoreCard } from "./EvidenceScoreCard";
import { ResearchProgress } from "./ResearchProgress";
import { VoiceOrb, type OrbState } from "./VoiceOrb";
import { extractMultipleFields } from "@/lib/intake/fieldExtractor";
import { CORE_QUESTIONS } from "@/lib/intake/questions";
import { shouldContinueToNext, validateAnswer } from "@/lib/intake/answerValidator";
import { convertToFounderIntake, createInitialState, getProgress, saveInterviewState, type InterviewMessage, type InterviewState } from "@/lib/intake/interviewState";
import type { EvidenceScore, FounderIntake, IdeaRevision } from "@/lib/intake/schema";
import { isIrrelevantFounderQuestion, redirectMessage } from "@/lib/guardrails";
import { createInitialProgress } from "@/lib/research/researchAgent";
import { createVoiceProvider, liveClientConfig, type IVoiceProvider } from "@/lib/voice/voiceProvider";
import { Check, MessageCircle, Mic, RefreshCw, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { results: SpeechRecognitionResultList }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
};

type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

const now = () => Date.now();
const assistant = (content: string, status?: InterviewMessage["status"]): InterviewMessage => ({ role: "assistant", content, status, timestamp: now() });
const user = (content: string): InterviewMessage => ({ role: "user", content, timestamp: now() });

export function FounderInterview({ initialMode }: { initialMode: "chat" | "voice" }) {
  const router = useRouter();
  const [state, setState] = useState<InterviewState>(() => {
    const initial = createInitialState(initialMode);
    initial.transcript = [
      assistant("Hey there. Ready to turn an early idea into a clear first step? I will ask exactly 15 focused questions, challenge vague answers, then run an evidence-based research pass."),
      assistant(CORE_QUESTIONS[0].conversationalVariant),
    ];
    return initial;
  });
  const stateRef = useRef(state);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const voiceProviderRef = useRef<IVoiceProvider | null>(null);
  const liveTranscriptRef = useRef("");
  const [input, setInput] = useState("");
  const [processing, setProcessing] = useState(false);
  const [voiceActive, setVoiceActive] = useState(false);
  const [orbState, setOrbState] = useState<OrbState>("idle");
  const [btsStatus, setBtsStatus] = useState(initialMode === "voice" ? "Voice is ready" : "Waiting for your answer");
  const [researchProgress, setResearchProgress] = useState<ReturnType<typeof createInitialProgress> | null>(null);
  const [evidence, setEvidence] = useState<EvidenceScore | null>(null);
  const [revisions, setRevisions] = useState<IdeaRevision[]>([]);
  const [selectedRevision, setSelectedRevision] = useState<IdeaRevision | null>(null);
  const [startupIdeaId, setStartupIdeaId] = useState("");
  const [researchLogs, setResearchLogs] = useState<string[]>([]);
  const [approvalReady, setApprovalReady] = useState(false);

  useEffect(() => {
    stateRef.current = state;
    saveInterviewState(state);
  }, [state]);

  useEffect(() => () => {
    recognitionRef.current?.stop();
    voiceProviderRef.current?.stop();
  }, []);

  const currentQuestion = CORE_QUESTIONS[state.currentQuestionIndex];
  const progress = getProgress(state);
  const quickOptions = (state.retryCount[currentQuestion?.id || 0] || 0) >= 2 ? currentQuestion?.quickSelect : undefined;

  function commit(next: InterviewState) {
    stateRef.current = next;
    setState(next);
  }

  async function runResearch(intake: FounderIntake, ideaId: string, modified = false) {
    const progressState = createInitialProgress();
    setResearchProgress(progressState);
    setOrbState("thinking");
    setBtsStatus("Planning and retrieving evidence");
    setResearchProgress({
      steps: progressState.steps.map((step, index) => ({ ...step, status: index === 0 ? "running" : "pending" })),
      currentStep: 0,
      isComplete: false,
    });
    try {
      const response = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intake, startupIdeaId: ideaId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Research failed");
      setEvidence(data.evidence);
      setRevisions(data.revisions);
      setResearchLogs(data.logs || []);
      setApprovalReady(data.evidence.score >= 80 || (modified && data.evidence.score >= 60));
      localStorage.setItem("launchpilot-intake", JSON.stringify(intake));
      localStorage.setItem("launchpilot-evidence", JSON.stringify(data.evidence));
      setBtsStatus("Evidence-based verdict ready");
    } catch (error) {
      setBtsStatus(error instanceof Error ? error.message : "Research failed");
    } finally {
      setResearchProgress({
        steps: progressState.steps.map((step) => ({ ...step, status: "complete" })),
        currentStep: progressState.steps.length - 1,
        isComplete: true,
      });
      setOrbState("idle");
    }
  }

  async function finishInterview(next: InterviewState) {
    const complete = { ...next, isComplete: true, currentQuestionIndex: 15 };
    commit(complete);
    const intake = convertToFounderIntake(complete);
    setBtsStatus("Saving founder profile");
    const save = await fetch("/api/intake", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(intake),
    });
    const saved = await save.json();
    if (!save.ok) {
      setBtsStatus("Could not save the intake. Check the highlighted answers.");
      return;
    }
    setStartupIdeaId(saved.startupIdeaId);
    localStorage.setItem("launchpilot-startup-idea-id", saved.startupIdeaId);
    await runResearch(intake, saved.startupIdeaId);
  }

  async function submitAnswer(answerOverride?: string) {
    const answer = (answerOverride ?? input).trim();
    if (!answer || processing || !currentQuestion) return;
    setInput("");
    if (isIrrelevantFounderQuestion(answer)) {
      commit({ ...stateRef.current, transcript: [...stateRef.current.transcript, user(answer), assistant(redirectMessage, "clarify")] });
      return;
    }
    setProcessing(true);
    setOrbState("thinking");
    setBtsStatus("Checking if the answer is usable");
    const base = stateRef.current;
    const withUser = { ...base, transcript: [...base.transcript, user(answer), assistant("Checking your answer against the founder context...", "validating")] };
    commit(withUser);
    const validation = await validateAnswer(currentQuestion, answer, base.answers);
    const transcript = withUser.transcript.filter((message) => message.status !== "validating");
    const retry = base.retryCount[currentQuestion.id] || 0;
    const decision = shouldContinueToNext(validation, retry, currentQuestion.isCritical);

    if (decision.action === "accept") {
      setBtsStatus("Extracting founder context");
      const extracted = extractMultipleFields(answer, currentQuestion.field);
      const cached = { ...base.extractedFieldsCache };
      extracted.filter((field) => field.confidence >= 0.75).forEach((field) => { if (!base.answers[field.field]) cached[field.field] = field.value; });
      const answers = { ...base.answers, [currentQuestion.field]: validation.normalizedAnswer };
      const nextIndex = base.currentQuestionIndex + 1;
      const nextQuestion = CORE_QUESTIONS[nextIndex];
      const nextPrompt = nextQuestion
        ? cached[nextQuestion.field]
          ? `I already have "${cached[nextQuestion.field]}" for this. Confirm it or replace it: ${nextQuestion.conversationalVariant}`
          : nextQuestion.conversationalVariant
        : "";
      const next: InterviewState = {
        ...base,
        currentQuestionIndex: nextIndex,
        answers,
        validations: [...base.validations, validation],
        extractedFieldsCache: cached,
        transcript: [...transcript, assistant("Understood and saved.", "saved"), ...(nextPrompt ? [assistant(nextPrompt)] : [])],
      };
      setBtsStatus(nextQuestion ? "Preparing next question" : "Research agent starting");
      if (nextIndex >= 15) {
        next.transcript.push(assistant("Thank you for answering the questions. I'm going to carry out a thorough market and feasibility research pass now."));
        await finishInterview(next);
      } else {
        commit(next);
      }
    } else if (decision.action === "skip") {
      const nextIndex = base.currentQuestionIndex + 1;
      const nextQuestion = CORE_QUESTIONS[nextIndex];
      const next: InterviewState = {
        ...base,
        currentQuestionIndex: nextIndex,
        skippedFields: [...base.skippedFields, currentQuestion.field],
        answers: { ...base.answers, [currentQuestion.field]: "unclear / skipped" },
        validations: [...base.validations, validation],
        transcript: [...transcript, assistant(decision.message || "I will mark that as unclear.", "clarify"), ...(nextQuestion ? [assistant(nextQuestion.conversationalVariant)] : [])],
      };
      commit(next);
    } else {
      setBtsStatus("Asking a quick follow-up");
      commit({
        ...base,
        retryCount: { ...base.retryCount, [currentQuestion.id]: retry + 1 },
        validations: [...base.validations, validation],
        transcript: [...transcript, assistant(decision.message || currentQuestion.conversationalVariant, "clarify")],
      });
    }
    setOrbState(voiceActive ? "listening" : "idle");
    setProcessing(false);
  }

  function startBrowserSpeech() {
    const Recognition = (window as SpeechWindow).SpeechRecognition || (window as SpeechWindow).webkitSpeechRecognition;
    if (!Recognition) {
      setBtsStatus("Web Speech is unavailable. Text chat remains fully functional.");
      return;
    }
    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).map((result) => result[0]?.transcript || "").join(" ").trim();
      setInput(transcript);
      setBtsStatus(event.results[event.results.length - 1]?.isFinal ? "Transcribing complete" : "Transcribing");
      if (event.results[event.results.length - 1]?.isFinal && transcript) void submitAnswer(transcript);
    };
    recognition.onend = () => { setVoiceActive(false); setOrbState("idle"); };
    recognition.onerror = () => { setVoiceActive(false); setOrbState("idle"); setBtsStatus("Voice failed. Continue with text."); };
    recognitionRef.current = recognition;
    setVoiceActive(true);
    setOrbState("listening");
    setBtsStatus("Listening to your answer");
    recognition.start();
  }

  async function startLiveVoice() {
    try {
      const response = await fetch("/api/voice", { method: "POST" });
      const session = await response.json();
      if (!response.ok || !session.token) throw new Error("Live voice session unavailable");
      liveTranscriptRef.current = "";
      const provider = await createVoiceProvider(liveClientConfig(session.token, session.model), (event) => {
        if (event.type === "listening") {
          setVoiceActive(true);
          setOrbState("listening");
          setBtsStatus("Listening securely");
        } else if (event.type === "transcript") {
          const previous = liveTranscriptRef.current;
          const next = previous && !event.text.startsWith(previous) ? `${previous} ${event.text}`.trim() : event.text.trim();
          liveTranscriptRef.current = next;
          setInput(next);
          setBtsStatus(event.isFinal ? "Transcript ready" : "Transcribing");
          if (event.isFinal && next) {
            voiceProviderRef.current = null;
            provider.stop();
            setVoiceActive(false);
            setOrbState("thinking");
            void submitAnswer(next);
          }
        } else if (event.type === "speaking") {
          setOrbState("speaking");
          setBtsStatus("Voice guide responding");
        } else if (event.type === "error") {
          voiceProviderRef.current = null;
          provider.stop();
          setVoiceActive(false);
          setOrbState("idle");
          setBtsStatus("Switching to browser speech");
          startBrowserSpeech();
        } else if (event.type === "end") {
          setVoiceActive(false);
          setOrbState("idle");
        }
      });
      voiceProviderRef.current = provider;
      await provider.start();
      if (currentQuestion) await provider.send(currentQuestion.conversationalVariant);
    } catch {
      voiceProviderRef.current?.stop();
      voiceProviderRef.current = null;
      setBtsStatus("Secure live voice unavailable. Using browser speech.");
      startBrowserSpeech();
    }
  }

  async function toggleVoice() {
    if (voiceActive) {
      voiceProviderRef.current?.stop();
      voiceProviderRef.current = null;
      recognitionRef.current?.stop();
      setVoiceActive(false);
      setOrbState("idle");
      setBtsStatus("Voice paused");
      return;
    }
    await startLiveVoice();
  }

  async function researchRevision(revision: IdeaRevision) {
    const intake = JSON.parse(localStorage.getItem("launchpilot-intake") || "{}") as FounderIntake;
    const revised = { ...intake, rawIdea: revision.improvedIdea, targetUser: revision.targetUser, problem: revision.problem };
    setSelectedRevision(revision);
    setEvidence(null);
    setRevisions([]);
    await runResearch(revised, startupIdeaId || localStorage.getItem("launchpilot-startup-idea-id") || "", true);
  }

  async function approve() {
    if (!evidence || !approvalReady) return;
    const response = await fetch("/api/research/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startupIdeaId: startupIdeaId || localStorage.getItem("launchpilot-startup-idea-id"), evidence, revision: selectedRevision }),
    });
    if (response.ok) router.push("/dashboard");
  }

  return (
    <section className="mx-auto max-w-7xl px-5 pb-10">
      {!state.isComplete && !evidence ? (
        <div className={`grid gap-6 ${initialMode === "voice" ? "lg:grid-cols-[420px_1fr]" : "lg:grid-cols-[1fr_340px]"}`}>
          {initialMode === "voice" && (
            <div className="glass flex min-h-[660px] flex-col items-center justify-center rounded-[32px] p-6">
              <VoiceOrb state={orbState} isActive={voiceActive || orbState === "thinking"} onToggle={toggleVoice} statusText={btsStatus} />
              <p className="mt-8 text-center text-sm leading-6 text-stone-600">Raw audio is never saved. The transcript uses the same answer-quality gate as chat.</p>
            </div>
          )}
          <div className="glass rounded-[32px] p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">Founder interview</p>
                <h1 className="mt-2 text-2xl font-semibold text-stone-950">{initialMode === "voice" ? "Live voice + transcript" : "Guided founder conversation"}</h1>
              </div>
              <Badge label={`Question ${progress.current} of 15`} />
            </div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-stone-200"><div className="h-full bg-stone-950 transition-all" style={{ width: `${progress.percentage}%` }} /></div>
            <div className="mt-5 h-[470px] space-y-3 overflow-y-auto rounded-[24px] bg-white/80 p-4">
              {state.transcript.map((message, index) => (
                <div key={`${message.timestamp}-${index}`} className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === "user" ? "ml-auto bg-stone-950 text-white" : message.status === "clarify" ? "bg-amber-50 text-amber-900" : message.status === "saved" ? "bg-emerald-50 text-emerald-800" : "bg-stone-50 text-stone-700"}`}>
                  {message.content}
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <input value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void submitAnswer(); }} disabled={processing || state.isComplete} placeholder="Answer in your own words..." className="min-w-0 flex-1 rounded-full border border-stone-200 bg-white px-5 py-3 outline-none focus:border-stone-400 focus:ring-4 focus:ring-stone-200" />
              {initialMode === "chat" && <button onClick={toggleVoice} className="rounded-full border border-stone-200 bg-white p-3" aria-label="Use voice"><Mic className="h-5 w-5" /></button>}
              <button onClick={() => void submitAnswer()} disabled={processing || state.isComplete} className="inline-flex items-center gap-2 rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"><Send className="h-4 w-4" /> Send</button>
            </div>
            {!!quickOptions?.length && <div className="mt-3 flex flex-wrap gap-2">{quickOptions.map((option) => <button key={option} onClick={() => void submitAnswer(option)} className="rounded-full border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-stone-700">{option}</button>)}</div>}
            {currentQuestion && <p className="mt-3 text-xs leading-5 text-stone-500"><strong>Why this matters:</strong> {currentQuestion.whyItMatters}</p>}
          </div>
          {initialMode === "chat" && <aside className="space-y-4"><div className="premium-card rounded-[24px] p-5"><MessageCircle className="h-5 w-5" /><h2 className="mt-4 font-semibold">Answer Quality Gate</h2><p className="mt-2 text-sm leading-6 text-stone-600">Every answer is checked for relevance, usable detail, and structured founder context before the interview moves forward.</p></div><div className="premium-card rounded-[24px] p-5"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">Behind the scenes</p><p className="mt-3 text-sm text-stone-800">{btsStatus}</p></div></aside>}
        </div>
      ) : !evidence ? (
        <div className="mx-auto max-w-3xl glass rounded-[32px] p-6">
          <h1 className="text-3xl font-semibold text-stone-950">Creating your personalized startup roadmap...</h1>
          <p className="mt-3 text-sm text-stone-600">{btsStatus}</p>
          {researchProgress && <div className="mt-7"><ResearchProgress steps={researchProgress.steps} currentStep={researchProgress.currentStep} /></div>}
          {!!researchLogs.length && <div className="mt-5 rounded-2xl bg-stone-950 p-4 text-xs leading-6 text-white/75">{researchLogs.slice(-6).map((log) => <p key={log}>- {log}</p>)}</div>}
        </div>
      ) : (
        <div className="mx-auto max-w-5xl">
          <EvidenceScoreCard evidenceScore={evidence} />
          {evidence.score < 80 && (
            <div className="mt-6 glass rounded-[28px] p-6">
              <h2 className="text-2xl font-semibold text-stone-950">This direction needs work before the dashboard.</h2>
              <p className="mt-2 text-sm leading-6 text-stone-600">Choose a sharper direction and run the evidence pass again. Approval becomes available at 80+, or at 60+ when you explicitly approve a researched modification.</p>
              <div className="mt-5 divide-y divide-stone-200">
                {revisions.map((revision) => (
                  <div key={revision.improvedIdea} className="py-5">
                    <h3 className="font-semibold text-stone-950">{revision.improvedIdea}</h3>
                    <p className="mt-2 text-sm text-stone-600">{revision.whyStronger}</p>
                    <p className="mt-2 text-xs text-stone-500">Remaining risk: {revision.remainingRisk}</p>
                    <button onClick={() => void researchRevision(revision)} className="mt-3 inline-flex items-center gap-2 rounded-full bg-stone-950 px-4 py-2 text-xs font-semibold text-white"><RefreshCw className="h-3.5 w-3.5" /> Research this revision</button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="mt-6 flex justify-center gap-3">
            <button disabled={!approvalReady} onClick={() => void approve()} className="inline-flex items-center gap-2 rounded-full bg-stone-950 px-6 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"><Check className="h-4 w-4" /> Approve direction and open dashboard</button>
            <button onClick={() => router.push("/start")} className="rounded-full border border-stone-200 bg-white px-6 py-3 text-sm font-semibold">Start over</button>
          </div>
        </div>
      )}
    </section>
  );
}
