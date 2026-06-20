"use client";

import { Nav } from "@/components/Nav";
import { MessageCircle, Mic } from "lucide-react";
import Link from "next/link";

export default function StartPage() {
  function prepareNewIdea() {
    localStorage.removeItem("launchpilot-interview-state");
    localStorage.removeItem("launchpilot-intake");
    localStorage.removeItem("launchpilot-startup-idea-id");
  }

  return (
    <main className="shell-bg min-h-screen">
      <Nav />
      <section className="mx-auto flex min-h-[calc(100vh-76px)] max-w-4xl flex-col items-center justify-center px-5 pb-10 text-center">
        <p className="mono-label">Stage 1 · Founder intake</p>
        <h1 className="mt-6 text-4xl font-semibold tracking-tight text-white md:text-5xl">
          Choose how you want to begin
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-7 text-lp-muted">
          Voice or chat — same adaptive interview, same research pipeline, same evidence-scored verdict.
        </p>

        <div className="mt-12 grid w-full max-w-2xl gap-4 md:grid-cols-2">
          <Link href="/interview-voice" onClick={prepareNewIdea} className="terminal-card group flex flex-col items-start p-8 text-left">
            <Mic className="h-6 w-6 text-white" />
            <h2 className="mt-6 text-xl font-semibold text-white">Voice intake</h2>
            <p className="mt-2 text-sm leading-6 text-lp-muted">Hands-free conversation with a centered voice orb.</p>
            <span className="mt-6 font-mono text-xs text-lp-subtle group-hover:text-white">Begin voice →</span>
          </Link>

          <Link href="/interview-chat" onClick={prepareNewIdea} className="terminal-card group flex flex-col items-start p-8 text-left">
            <MessageCircle className="h-6 w-6 text-white" />
            <h2 className="mt-6 text-xl font-semibold text-white">Chat intake</h2>
            <p className="mt-2 text-sm leading-6 text-lp-muted">Same interview in a minimal terminal-style chat UI.</p>
            <span className="mt-6 font-mono text-xs text-lp-subtle group-hover:text-white">Begin chat →</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
