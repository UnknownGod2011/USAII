"use client";

import { Nav } from "@/components/Nav";
import { MessageCircle, Mic, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";

export default function StartPage() {
  return (
    <main className="shell-bg min-h-screen">
      <Nav />
      <section className="mx-auto flex min-h-[calc(100vh-76px)] max-w-5xl flex-col items-center justify-center px-5 pb-10 text-center">
        <span className="mono-label inline-flex rounded-full border border-white/10 bg-lp-surface px-4 py-2">
          Stage 1 · Founder intake
        </span>
        <h1 className="mt-6 max-w-3xl text-balance text-4xl font-semibold tracking-tight text-stone-50 md:text-6xl">
          Tell LaunchPilot about you and your idea.
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-lp-muted">
          An adaptive AI interview gathers the founder profile, then a grounded research pass decides whether to continue, refine, or brainstorm something stronger.
        </p>

        <div className="mt-12 grid w-full max-w-3xl gap-4 md:grid-cols-2">
          <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.2 }}>
            <Link
              href="/interview?mode=voice"
              className="bento-card group flex h-full flex-col items-center rounded-[28px] p-8 text-left md:items-start"
            >
              <div className="orb flex h-16 w-16 items-center justify-center rounded-full">
                <Mic className="h-7 w-7 text-white" />
              </div>
              <h2 className="mt-6 text-2xl font-semibold text-stone-100">Start with Voice</h2>
              <p className="mt-3 text-sm leading-6 text-lp-muted">
                Fast, natural conversation with a glowing voice orb, live transcript, and low-latency browser voice with Gemini-assisted validation.
              </p>
              <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-lp-accent">
                Begin voice intake <Sparkles className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </span>
            </Link>
          </motion.div>

          <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.2 }}>
            <Link
              href="/interview?mode=chat"
              className="bento-card group flex h-full flex-col items-center rounded-[28px] p-8 text-left md:items-start"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-lp-accent/40 bg-lp-accent/10">
                <MessageCircle className="h-7 w-7 text-lp-accent" />
              </div>
              <h2 className="mt-6 text-2xl font-semibold text-stone-100">Start with Chat</h2>
              <p className="mt-3 text-sm leading-6 text-lp-muted">
                The same adaptive AI interview in a premium chat interface, with research progress and approval controls on the same screen.
              </p>
              <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-lp-accent">
                Begin chat intake <Sparkles className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </span>
            </Link>
          </motion.div>
        </div>

        <p className="mt-8 max-w-xl rounded-2xl border border-white/10 bg-lp-surface px-5 py-4 text-xs leading-5 text-lp-subtle">
          Voice uses browser speech for capture and playback. Raw audio is not stored. Gemini drives the interview and re-asks when an answer is off-topic.
        </p>
      </section>
    </main>
  );
}
