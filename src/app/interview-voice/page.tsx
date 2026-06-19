"use client";

import { DotFieldBackground } from "@/components/animations/DotFieldBackground";
import { Nav } from "@/components/Nav";
import { VoiceOrb, type OrbState } from "@/components/VoiceOrb";
import { VoiceTranscriptPanel } from "@/components/VoiceTranscriptPanel";
import { buildIntakeFromFields, getInterviewProgress, mergeCollectedFields, requestInterviewTurn, type CollectedFields } from "@/lib/interview/aiInterview";
import { cancelSpeech } from "@/lib/voice/speechSynthesis";
import { createVoiceProvider, detectAvailableProvider, liveClientConfig, type IVoiceProvider, type VoiceEvent } from "@/lib/voice/voiceProvider";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, Suspense, useRef, useState } from "react";

function VoiceInterview() {
  const router = useRouter();
  const [orbState, setOrbState] = useState<OrbState>("idle");
  const [isActive, setIsActive] = useState(false);
  const [statusText, setStatusText] = useState("Tap the orb to begin");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [messages, setMessages] = useState<Array<{ role: "assistant" | "user"; content: string }>>([]);
  const [collectedFields, setCollectedFields] = useState<CollectedFields>({});
  const [finalizing, setFinalizing] = useState(false);
  const [providerKind, setProviderKind] = useState<"gemini-live" | "web-speech" | "text-fallback" | null>(null);
  const [typedAnswer, setTypedAnswer] = useState("");
  const providerRef = useRef<IVoiceProvider | null>(null);
  const conversationRef = useRef<Array<{ role: "assistant" | "user"; content: string }>>([]);
  const fieldsRef = useRef<CollectedFields>({});
  const processingRef = useRef(false);

  async function finalize(fields: CollectedFields, conversation: Array<{ role: "assistant" | "user"; content: string }>) {
    setFinalizing(true); setStatusText("Saving your context and opening validation…");
    providerRef.current?.stop(); providerRef.current = null; setIsActive(false); setOrbState("thinking");
    const intake = buildIntakeFromFields(fields, conversation);
    const response = await fetch("/api/intake", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(intake) });
    const saved = await response.json();
    if (!response.ok) { setStatusText(saved.error || "Could not save the interview. Continue in chat mode."); setFinalizing(false); setOrbState("idle"); return; }
    localStorage.setItem("launchpilot-intake", JSON.stringify(intake));
    localStorage.setItem("launchpilot-startup-idea-id", saved.startupIdeaId);
    router.push(`/validation?ideaId=${encodeURIComponent(saved.startupIdeaId)}`);
  }

  async function handleAnswer(answer: string) {
    if (!answer.trim() || processingRef.current || finalizing) return;
    processingRef.current = true; setLiveTranscript(""); setOrbState("thinking"); setStatusText("Checking answer quality…");
    const nextConversation = [...conversationRef.current, { role: "user" as const, content: answer.trim() }];
    conversationRef.current = nextConversation; setMessages((current) => [...current, { role: "user", content: answer.trim() }]);
    try {
      const turn = await requestInterviewTurn(nextConversation, { collectedFields: fieldsRef.current });
      const merged = mergeCollectedFields(fieldsRef.current, turn.collectedFields);
      fieldsRef.current = merged; setCollectedFields(merged);
      const finalConversation = [...nextConversation, { role: "assistant" as const, content: turn.message }];
      conversationRef.current = finalConversation;
      setMessages((current) => [...current, { role: "assistant", content: turn.message }]);
      if (turn.interviewComplete) {
        await finalize(merged, finalConversation);
      } else {
        await providerRef.current?.send(turn.message);
        setOrbState("listening"); setStatusText("Listening — take your time.");
      }
    } catch (reason) {
      setOrbState("idle"); setStatusText(reason instanceof Error ? reason.message : "Voice failed. Continue in chat mode.");
    } finally { processingRef.current = false; }
  }

  async function onVoiceEvent(event: VoiceEvent) {
    if (event.type === "listening") { setOrbState("listening"); setStatusText("Listening — take your time."); }
    if (event.type === "transcript") setLiveTranscript(event.text);
    if (event.type === "utterance-ready") await handleAnswer(event.text);
    if (event.type === "thinking") { setOrbState("thinking"); setStatusText("Checking your answer…"); }
    if (event.type === "speaking") { setOrbState("speaking"); setStatusText("LaunchPilot is speaking"); }
    if (event.type === "notice") { setOrbState("listening"); setStatusText(event.message); }
    if (event.type === "error") { setStatusText("Secure live voice was unavailable. Continue with browser speech or chat."); setOrbState("idle"); }
    if (event.type === "end" && !finalizing) { setIsActive(false); setOrbState("idle"); }
  }

  async function start() {
    if (isActive || finalizing) return;
    setStatusText("Connecting securely…");
    try {
      let provider: IVoiceProvider;
      const availableProvider = detectAvailableProvider();
      if (availableProvider === "web-speech") {
        provider = await createVoiceProvider({ provider: "web-speech", language: "en-IN" }, onVoiceEvent);
        await provider.start();
      } else {
        const session = await fetch("/api/voice", { method: "POST" }).then(async (response) => ({ ok: response.ok, data: await response.json() }));
        if (session.ok && session.data.token) {
          provider = await createVoiceProvider(liveClientConfig(session.data.token, session.data.model), onVoiceEvent);
          try {
            await Promise.race([
              provider.start(),
              new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error("Live voice connection timed out")), 8_000)),
            ]);
          } catch {
            provider.stop();
            provider = await createVoiceProvider({ provider: "text-fallback", language: "en-IN" }, onVoiceEvent);
            await provider.start();
          }
        } else {
          provider = await createVoiceProvider({ provider: "text-fallback", language: "en-IN" }, onVoiceEvent);
          await provider.start();
        }
      }
      providerRef.current = provider;
      setProviderKind(provider.getProvider());
      setIsActive(true);
      const turn = await requestInterviewTurn([], { collectedFields: fieldsRef.current });
      conversationRef.current = [{ role: "assistant", content: turn.message }];
      setMessages([{ role: "assistant", content: turn.message }]);
      await provider.send(turn.message);
      setOrbState("listening"); setStatusText("Listening — take your time.");
    } catch {
      setStatusText("Voice is unavailable on this device. Text chat remains fully functional."); setOrbState("idle"); setIsActive(false);
    }
  }
  function end() {
    cancelSpeech(); providerRef.current?.stop(); providerRef.current = null; setIsActive(false); setOrbState("idle"); setStatusText("Voice paused. Raw audio was not stored.");
  }
  function submitTypedAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const answer = typedAnswer.trim();
    if (!answer) return;
    setTypedAnswer("");
    void handleAnswer(answer);
  }
  const progress = getInterviewProgress(collectedFields);
  return (
    <main className="relative min-h-screen bg-black">
      <DotFieldBackground variant="calm" bulgeStrength={40} />
      <div className="page-content relative z-10"><Nav />
        <section className="mx-auto flex min-h-[calc(100vh-72px)] max-w-6xl items-center px-5 pb-10">
          <div className="grid w-full items-center gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div className="flex min-h-[min(70vh,560px)] flex-col items-center justify-center pt-14">
              <VoiceOrb state={orbState} isActive={isActive} onToggle={start} onEndConversation={end} statusText={statusText} />
              <p className="mt-8 font-mono text-sm text-lp-muted">Questions completed {progress.current} of {progress.total}</p>
              <p className="mt-3 max-w-md text-center text-xs leading-5 text-lp-subtle">English browser speech is used for stable turn-taking. A short-lived secure voice session or text input is used when needed. Raw audio is never permanently stored.</p>
              {providerKind === "text-fallback" && isActive && (
                <form onSubmit={submitTypedAnswer} className="mt-6 flex w-full max-w-md gap-2">
                  <input
                    value={typedAnswer}
                    onChange={(event) => setTypedAnswer(event.target.value)}
                    className="input-field min-w-0 flex-1"
                    placeholder="Type your answer"
                    aria-label="Type your interview answer"
                  />
                  <button type="submit" className="btn-primary shrink-0">Send</button>
                </form>
              )}
              <Link href="/interview-chat" className="btn-secondary mt-6">Nevermind I want chat!</Link>
            </div>
            <VoiceTranscriptPanel entries={messages} liveText={liveTranscript} isListening={orbState === "listening"} sessionEnded={!isActive && messages.length > 0} />
          </div>
        </section>
      </div>
    </main>
  );
}
export default function InterviewVoicePage() {
  return <Suspense fallback={<main className="min-h-screen bg-black" />}><VoiceInterview /></Suspense>;
}
