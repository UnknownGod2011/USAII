"use client";

import { Badge } from "@/components/Badge";
import { Nav } from "@/components/Nav";
import { generateLaunchBrief, problemDiscoveryCards } from "@/lib/agents";
import { isIrrelevantFounderQuestion, redirectMessage } from "@/lib/guardrails";
import { demoProfile, emptyProfile } from "@/lib/seed";
import type { FounderProfile } from "@/lib/types";
import { ArrowRight, CheckCircle2, ClipboardList, Compass, Mic, MicOff, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useRef, useState } from "react";

const questions = [
  "What's your name?",
  "How old are you, and which country/city are you building from?",
  "Are you a student, working professional, or exploring independently?",
  "Do you already have a startup idea, or are you still exploring?",
  "How many hours per week can you realistically spend?",
  "What skills do you currently have?",
  "What is your rough idea? If you have no idea yet, say 'no idea yet'.",
  "Who do you think has this problem?",
  "What evidence do you already have?",
  "What budget or resources can you use right now?",
  "Would you be willing to learn new skills or complete courses?",
  "What would make the next 30 days successful?",
];

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { results: SpeechRecognitionResultList }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechWindow = Window & {
  SpeechRecognition?: new () => BrowserSpeechRecognition;
  webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
};

function InterviewInner() {
  const router = useRouter();
  const params = useSearchParams();
  const mode = params.get("mode") || "chat";
  const [step, setStep] = useState(0);
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const [messages, setMessages] = useState<string[]>([
    "Hey there! Ready to build the next big thing? Let's start with you first. I will ask a few focused questions about your goals, skills, time, budget, current stage, and ambition. Then real research agents will build your startup roadmap.",
  ]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const noIdea = useMemo(() => Object.values(answers).join(" ").toLowerCase().includes("no idea"), [answers]);

  function submitAnswer() {
    if (isIrrelevantFounderQuestion(input)) {
      setMessages((prev) => [...prev, `You: ${input}`, redirectMessage]);
      setInput("");
      return;
    }
    const key = questions[step] || "extra";
    setAnswers((prev) => ({ ...prev, [key]: input }));
    const nextStep = Math.min(step + 1, questions.length);
    setStep(nextStep);
    setMessages((prev) => [
      ...prev,
      `You: ${input}`,
      nextStep < questions.length
        ? questions[nextStep]
        : "Good. I have enough context to create your Launch Brief. You can approve research or use fallback analysis.",
    ]);
    setInput("");
  }

  function buildProfile(useDemo = false): FounderProfile {
    if (useDemo) return demoProfile;
    const skillText = answers[questions[5]] || "";
    const skills = skillText
      .split(/,|and|\n/)
      .map((skill) => skill.trim())
      .filter(Boolean);
    if (noIdea) {
      return {
        ...emptyProfile,
        name: answers[questions[0]] || emptyProfile.name,
        location: answers[questions[1]] || emptyProfile.location,
        status: answers[questions[2]] || emptyProfile.status,
        hoursPerWeek: Number.parseInt(answers[questions[4]] || "6", 10) || 6,
        skills: skills.length ? skills : emptyProfile.skills,
        budget: answers[questions[9]] || emptyProfile.budget,
        willingnessToLearn: answers[questions[10]] || emptyProfile.willingnessToLearn,
        success30Days: answers[questions[11]] || emptyProfile.success30Days,
      };
    }
    return {
      ...demoProfile,
      name: answers[questions[0]] || demoProfile.name,
      location: answers[questions[1]] || demoProfile.location,
      status: answers[questions[2]] || demoProfile.status,
      ideaStage: (answers[questions[3]] || answers[questions[6]] || "").toLowerCase().includes("no idea") ? "no idea yet" : "rough idea",
      hoursPerWeek: Number.parseInt(answers[questions[4]] || "10", 10) || 10,
      skills: skills.length ? skills : demoProfile.skills,
      rawIdea: answers[questions[6]] || demoProfile.rawIdea,
      targetUser: answers[questions[7]] || demoProfile.targetUser,
      evidence: [answers[questions[8]] || "no formal user validation yet"],
      budget: answers[questions[9]] || demoProfile.budget,
      willingnessToLearn: answers[questions[10]] || demoProfile.willingnessToLearn,
      success30Days: answers[questions[11]] || demoProfile.success30Days,
    };
  }

  function finish(useDemo = false) {
    const profile = buildProfile(useDemo);
    localStorage.setItem("launchpilot-profile", JSON.stringify(profile));
    localStorage.setItem("launchpilot-interview", JSON.stringify({ answers, messages }));
    localStorage.setItem("launchpilot-brief", JSON.stringify(generateLaunchBrief(profile)));
    router.push("/research");
  }

  function toggleVoice() {
    const SpeechRecognition = (window as SpeechWindow).SpeechRecognition || (window as SpeechWindow).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMessages((prev) => [...prev, "Voice is not available in this browser. Text mode is ready and uses the same founder workflow."]);
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript || "")
        .join(" ")
        .trim();
      if (transcript) setInput(transcript);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => {
      setListening(false);
      setMessages((prev) => [...prev, "Voice capture hit an error. Continue in text mode; your workflow is unchanged."]);
    };
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }

  return (
    <main className="shell-bg min-h-screen">
      <Nav />
      <section className="mx-auto grid max-w-7xl gap-5 px-5 pb-10 lg:grid-cols-[1fr_390px]">
        <div className="glass rounded-[32px] p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-stone-500">Founder interview</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-950">Warm, short, focused.</h1>
            </div>
            <Badge label={mode === "voice" ? "Voice fallback ready" : "Text mode"} />
          </div>
          <div className="mt-4 rounded-2xl bg-stone-950 px-4 py-3 text-sm leading-6 text-white">
            {step < questions.length
              ? questions[step]
              : "Perfect. I have enough context to create your personalized startup roadmap with live agents."}
          </div>
          <div className="mt-6 min-h-[420px] space-y-3 rounded-[26px] bg-white/90 p-4 shadow-inner">
            {messages.map((message, index) => (
              <div key={`${message}-${index}`} className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 ${message.startsWith("You:") ? "ml-auto bg-stone-950 text-white" : "bg-stone-50 text-stone-700"}`}>
                {message}
              </div>
            ))}
            {step >= questions.length && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-stone-700">
                LaunchPilot wants to research competitors, user pain signals, skill gaps, and relevant opportunities.
                Use research for a stronger brief, or use fallback analysis if you want the fully local demo path.
              </div>
            )}
          </div>
          <div className="mt-4 flex gap-2">
            <input className="min-w-0 flex-1 rounded-full border border-stone-200 bg-white px-4 py-3 outline-none focus:border-stone-400 focus:ring-4 focus:ring-stone-200" value={input} onChange={(e) => setInput(e.target.value)} placeholder={step < questions.length ? questions[step] : "Ask or finish"} onKeyDown={(e) => e.key === "Enter" && submitAnswer()} />
            {mode === "voice" && (
              <button className={`inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold ${listening ? "bg-red-600 text-white" : "border border-stone-200 bg-white text-stone-900"}`} onClick={toggleVoice} aria-label={listening ? "Stop voice capture" : "Start voice capture"}>
                {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                <span className="hidden sm:inline">{listening ? "Stop voice" : "Start voice"}</span>
              </button>
            )}
            <button className="rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white" onClick={submitAnswer}>Send</button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="inline-flex items-center gap-2 rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white" onClick={() => finish(false)}>
              Start research <ArrowRight className="h-4 w-4" />
            </button>
            <button className="rounded-full border border-stone-200 bg-white px-5 py-3 text-sm font-semibold text-stone-900" onClick={() => finish(true)}>
              Use strong demo profile
            </button>
            <button className="rounded-full border border-stone-200 bg-white px-5 py-3 text-sm font-semibold text-stone-900" onClick={() => finish(false)}>
              Skip and use fallback analysis
            </button>
          </div>
        </div>
        <aside className="space-y-5">
          <section className="premium-card rounded-[28px] p-5">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-stone-700" />
              <h2 className="font-semibold text-stone-950">Research approval</h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-stone-600">LaunchPilot checks competitors, user pain signals, skill gaps, and opportunities. If live APIs are not configured, it uses deterministic fallback analysis and labels it clearly.</p>
          </section>
          {noIdea && (
            <section className="premium-card rounded-[28px] p-5">
              <div className="flex items-center gap-2">
                <Compass className="h-4 w-4 text-emerald-600" />
                <h2 className="font-semibold text-stone-950">Problem Discovery Mode</h2>
              </div>
              <div className="mt-4 space-y-3">
                {problemDiscoveryCards(emptyProfile).map((card) => (
                  <div key={card.problem} className="rounded-2xl bg-stone-50 p-4 text-sm leading-6 text-stone-700">
                    <div className="flex items-center justify-between gap-2">
                      <strong>{card.problem}</strong>
                      <Badge label={card.label} />
                    </div>
                    <p className="mt-2">{card.howToValidate}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
          <section className="premium-card rounded-[28px] p-5">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-violet-600" />
              <h2 className="font-semibold text-stone-950">What gets saved</h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-stone-600">Founder snapshot, refined idea, assumptions, risks, roadmap, sources, agent outputs, saved decisions, and chat context. Raw audio is not saved.</p>
          </section>
          <section className="premium-card rounded-[28px] p-5">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <h2 className="font-semibold text-stone-950">Guardrails active</h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-stone-600">Irrelevant questions are redirected. Voice transcripts go through the same checks as text answers.</p>
          </section>
        </aside>
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
