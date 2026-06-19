import { Nav } from "@/components/Nav";
import { ArrowUp, Brain, CheckCircle2, FileText, Lock, Search, Sparkles } from "lucide-react";
import Link from "next/link";

const cards = [
  { title: "Clarify your idea", body: "A warm interview turns scattered context into a founder snapshot, assumptions, and a sharper problem.", icon: Sparkles },
  { title: "Research market reality", body: "Visible agents label competitors, opportunities, confidence, and what still needs human validation.", icon: Search },
  { title: "Create your first real step", body: "LaunchPilot finds the current bottleneck and writes a practical 24-hour and 7-day validation plan.", icon: CheckCircle2 },
];

export default function Home() {
  return (
    <main className="shell-bg min-h-screen">
      <Nav />
      <section className="relative mx-auto min-h-[calc(100vh-76px)] max-w-7xl px-5 pb-10">
        <div className="pointer-events-none absolute left-24 top-0 hidden h-full w-28 lg:block">
          <div className="dashed-path mx-auto h-full w-0.5 rotate-12" />
          <div className="premium-card absolute left-0 top-[34%] flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50">
            <Search className="h-8 w-8 text-emerald-500" />
          </div>
          <div className="premium-card absolute bottom-8 left-16 flex h-20 w-20 items-center justify-center rounded-full bg-sky-50">
            <CheckCircle2 className="h-8 w-8 text-sky-500" />
          </div>
        </div>

        <div className="grid min-h-[calc(100vh-86px)] items-center gap-8 pt-8 lg:grid-cols-[1fr_360px]">
          <div className="mx-auto max-w-4xl text-center lg:pl-24">
            <span className="inline-flex rounded-full bg-stone-900 px-5 py-2 text-sm font-semibold text-white shadow-xl shadow-stone-300/50">
              Built for student founders who need clarity before they build.
            </span>
            <h1 className="mx-auto mt-7 max-w-4xl text-balance text-5xl font-semibold tracking-tight text-stone-950 md:text-7xl">
              Turn your vague idea into a real execution plan.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-xl leading-8 text-stone-600">
              LaunchPilot AI interviews you, researches your market, maps risks, finds opportunities, and builds a practical MVP roadmap with evidence and human control.
            </p>
            <div className="mx-auto mt-9 flex max-w-3xl items-center gap-3 rounded-[28px] border border-stone-200 bg-white/90 p-3 shadow-2xl shadow-stone-300/40">
              <div className="min-h-24 flex-1 px-5 py-4 text-left text-lg text-stone-400">
                I want to validate an AI study planner for first-year engineering students...
              </div>
              <Link className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-stone-900 text-white hover:-translate-y-0.5" href="/login" aria-label="Start Founder Interview">
                <ArrowUp className="h-6 w-6" />
              </Link>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link className="inline-flex items-center gap-2 rounded-full bg-stone-950 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-stone-300 hover:-translate-y-0.5" href="/login">
                Start Founder Interview <Sparkles className="h-4 w-4" />
              </Link>
              <Link className="rounded-full border border-stone-200 bg-white/80 px-6 py-3 text-sm font-semibold text-stone-900 hover:bg-white" href="/login">
                Open saved workspace
              </Link>
              <span className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-stone-600">
                <Lock className="h-4 w-4" /> Privacy mode available
              </span>
            </div>
            <div className="mt-12 grid gap-3 text-left md:grid-cols-3">
              {cards.map(({ title, body, icon: Icon }) => (
                <div key={title} className="premium-card rounded-[22px] p-5">
                  <Icon className="h-5 w-5 text-stone-900" />
                  <h2 className="mt-4 font-semibold text-stone-950">{title}</h2>
                  <p className="mt-2 text-sm leading-6 text-stone-600">{body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="hidden space-y-5 lg:block">
            <div className="premium-card rounded-[20px]">
              <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4 text-sm text-stone-500">
                <span className="inline-flex items-center gap-2"><FileText className="h-4 w-4" /> Market research report</span>
                <span>2 min</span>
              </div>
              <div className="p-5">
                <h2 className="font-semibold leading-6 text-stone-800">3 underserved student-founder problems to test this week</h2>
                <div className="mt-4 space-y-2">
                  <div className="h-3 rounded-full bg-stone-200" />
                  <div className="h-3 w-4/5 rounded-full bg-stone-200" />
                  <div className="h-3 rounded-full bg-stone-200" />
                </div>
                <p className="mt-5 border-t border-stone-100 pt-4 text-sm text-stone-500">Sources: official, framework, fallback</p>
              </div>
            </div>
            <div className="ml-12 rounded-[18px] bg-amber-100/80 p-5 text-center text-stone-700 shadow-xl shadow-stone-300/30">
              <strong>Key insight:</strong> your next win is not more features. It is 10 real conversations.
            </div>
            <div className="premium-card mr-10 rounded-[20px] p-5">
              <div className="flex items-center gap-3">
                <Brain className="h-5 w-5 text-violet-500" />
                <div>
                  <p className="font-semibold text-stone-950">Lead Research Agent</p>
                  <p className="text-sm text-stone-500">Choosing the current bottleneck</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
