"use client";

import { Badge } from "@/components/Badge";
import { Nav } from "@/components/Nav";
import { copilotReply, generateLaunchBrief } from "@/lib/agents";
import { demoProfile } from "@/lib/seed";
import type { AgentOutput, FounderProfile, LaunchBrief } from "@/lib/types";
import { Bot, CheckCircle2, ChevronDown, MessageCircle, Radar, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const stagedLogs = [
  "Reading founder profile and interview transcript...",
  "Fetching public founder pain signals from Hacker News Algolia...",
  "Searching GitHub for open-source alternatives and adjacent tools...",
  "Fetching World Bank entrepreneurship macro signal...",
  "Checking ESCO skill taxonomy and Startup India opportunity references...",
  "Comparing sources, labeling confidence, and building the roadmap...",
];

function AgentLine({ agent, active }: { agent: AgentOutput; active: boolean }) {
  return (
    <details className="group border-b border-stone-200 py-4" open={active}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${active ? "bg-stone-950 text-white" : "bg-white text-stone-700"}`}>
            {active ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
          </span>
          <div className="min-w-0">
            <h2 className="truncate font-semibold text-stone-950">{agent.name}</h2>
            <p className="truncate text-sm text-stone-500">{agent.role}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge label={active ? "Running" : agent.label} />
          <ChevronDown className="h-4 w-4 text-stone-400 transition group-open:rotate-180" />
        </div>
      </summary>
      <div className="ml-12 mt-4 space-y-4 text-sm leading-6 text-stone-700">
        <div>
          <p className="font-medium text-stone-950">What is happening</p>
          <ul className="mt-2 space-y-1">
            {(agent.liveSteps || []).map((step) => (
              <li key={step} className="flex gap-2">
                <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-600" />
                <span>{step}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="font-medium text-stone-950">Plan generated</p>
          <ol className="mt-2 space-y-1">
            {(agent.plan || [agent.reasoning.recommendation]).map((item, index) => (
              <li key={item}>{index + 1}. {item}</li>
            ))}
          </ol>
        </div>
        {!!agent.sources?.length && (
          <div>
            <p className="font-medium text-stone-950">Sources used</p>
            <div className="mt-2 grid gap-2">
              {agent.sources.map((source) => (
                <a key={`${agent.name}-${source.id}`} href={source.url} target="_blank" rel="noreferrer" className="rounded-2xl bg-white/70 px-3 py-2 text-stone-700 hover:bg-white">
                  {source.title} <span className="text-xs text-stone-500">({source.label})</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </details>
  );
}

export default function ResearchPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<FounderProfile>(demoProfile);
  const [brief, setBrief] = useState<LaunchBrief>(() => generateLaunchBrief(demoProfile));
  const [activeStep, setActiveStep] = useState(0);
  const [done, setDone] = useState(false);
  const [question, setQuestion] = useState("What is the single most important thing I should do first?");
  const [answer, setAnswer] = useState("I am reading your founder profile and waiting for the research agents to finish.");

  const visibleLogs = useMemo(() => {
    const realLogs = brief.research.logs || [];
    return [...stagedLogs.slice(0, activeStep + 1), ...realLogs].slice(-9);
  }, [activeStep, brief.research.logs]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setInterval(() => {
      setActiveStep((step) => Math.min(step + 1, stagedLogs.length - 1));
    }, 900);

    const boot = window.setTimeout(() => {
      const savedProfile = localStorage.getItem("launchpilot-profile");
      const parsedProfile = savedProfile ? JSON.parse(savedProfile) : demoProfile;
      if (cancelled) return;
      setProfile(parsedProfile);
      setBrief(generateLaunchBrief(parsedProfile));

      fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: parsedProfile }),
      })
        .then((response) => response.json())
        .then((data) => {
          if (cancelled) return;
          setBrief(data.brief);
          localStorage.setItem("launchpilot-brief", JSON.stringify(data.brief));
          setAnswer(copilotReply("What should I do first?", data.brief));
          setDone(true);
          setActiveStep(stagedLogs.length - 1);
        })
        .catch(() => {
          if (cancelled) return;
          const fallback = generateLaunchBrief(parsedProfile);
          setBrief(fallback);
          localStorage.setItem("launchpilot-brief", JSON.stringify(fallback));
          setDone(true);
        })
        .finally(() => window.clearInterval(timer));
    }, 0);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.clearTimeout(boot);
    };
  }, []);

  return (
    <main className="shell-bg min-h-screen">
      <Nav />
      <section className="mx-auto grid max-w-7xl gap-6 px-5 pb-10 lg:grid-cols-[1fr_360px]">
        <div className="glass rounded-[32px] p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">Agent research run</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-stone-950">Creating your personalized startup roadmap...</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">
                Multiple agents are researching real sources, comparing alternatives, labeling uncertainty, and turning your founder profile into a practical plan.
              </p>
            </div>
            <Badge label={done ? "Complete" : "Running"} />
          </div>

          <div className="mt-7 rounded-[26px] bg-stone-950 p-5 text-white">
            <div className="flex items-center gap-3">
              <Radar className="h-5 w-5 animate-pulse text-emerald-300" />
              <p className="font-medium">{done ? "Research synthesis complete" : stagedLogs[activeStep]}</p>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/15">
              <div className="h-full rounded-full bg-emerald-300 transition-all duration-700" style={{ width: `${done ? 100 : ((activeStep + 1) / stagedLogs.length) * 100}%` }} />
            </div>
            <div className="mt-4 grid gap-2 text-sm text-white/80">
              {visibleLogs.map((log, index) => (
                <p key={`${log}-${index}`}>- {log}</p>
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-[26px] bg-white/70 px-5">
            {brief.agents.map((agent, index) => (
              <AgentLine key={agent.name} agent={agent} active={!done && index === activeStep % brief.agents.length} />
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button className="rounded-full bg-stone-950 px-6 py-3 text-sm font-semibold text-white" onClick={() => router.push("/dashboard")}>
              Open Launch Brief
            </button>
            <button className="rounded-full border border-stone-200 bg-white px-6 py-3 text-sm font-semibold text-stone-900" onClick={() => router.push("/profile")}>
              Review founder profile
            </button>
          </div>
        </div>

        <aside className="glass h-fit rounded-[28px] p-5 lg:sticky lg:top-5">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-stone-700" />
            <h2 className="font-semibold text-stone-950">Live Copilot</h2>
          </div>
          <p className="mt-3 text-sm leading-6 text-stone-600">
            I am using {profile.name}&apos;s saved profile, the current research run, and the generated roadmap.
          </p>
          <textarea className="mt-4 min-h-24 w-full rounded-2xl border border-stone-200 bg-white p-3 text-sm outline-none focus:border-stone-400 focus:ring-4 focus:ring-stone-200" value={question} onChange={(event) => setQuestion(event.target.value)} />
          <button className="mt-3 w-full rounded-full bg-stone-950 px-4 py-3 text-sm font-semibold text-white" onClick={() => setAnswer(copilotReply(question, brief))}>
            Ask with context
          </button>
          <div className="mt-4 rounded-2xl bg-stone-50 p-4 text-sm leading-6 text-stone-700">{answer}</div>
          <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-xs leading-5 text-stone-600">
            Research mode: {brief.research.mode}. AI synthesis appears only when a Gemini key is configured; otherwise LaunchPilot uses retrieved data plus deterministic reasoning.
          </div>
        </aside>
      </section>
    </main>
  );
}
