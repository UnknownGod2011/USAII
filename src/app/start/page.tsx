"use client";

import { Nav } from "@/components/Nav";
import { MessageCircle, Mic, Waves } from "lucide-react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";

const subscribeToBrowserCapability = () => () => undefined;
const browserSpeechAvailable = () => "SpeechRecognition" in window || "webkitSpeechRecognition" in window;
const serverSpeechAvailable = () => false;

export default function StartPage() {
  const router = useRouter();
  const speechSupported = useSyncExternalStore(subscribeToBrowserCapability, browserSpeechAvailable, serverSpeechAvailable);
  return (
    <main className="shell-bg min-h-screen">
      <Nav />
      <section className="mx-auto flex min-h-[calc(100vh-76px)] max-w-5xl flex-col justify-center px-5 pb-12">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">Founder intake</p>
          <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-stone-950 md:text-6xl">Choose how you want to think out loud.</h1>
          <p className="mx-auto mt-5 max-w-2xl text-xl leading-8 text-stone-600">&quot;Big ideas do not fail because they are too ambitious. They fail because the first step is unclear.&quot;</p>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <motion.button whileHover={{ y: -4 }} onClick={() => router.push("/interview?mode=voice")} className="glass group min-h-64 rounded-[28px] p-7 text-left">
            <span className="orb flex h-16 w-16 items-center justify-center rounded-full"><Mic className="h-7 w-7 text-white" /></span>
            <h2 className="mt-8 text-2xl font-semibold text-stone-950">Start with Voice</h2>
            <p className="mt-3 text-sm leading-6 text-stone-600">Speak naturally, watch the live transcript, and see what LaunchPilot is validating behind the scenes.</p>
            <span className="mt-6 inline-flex items-center gap-2 text-xs font-medium text-stone-500"><Waves className="h-4 w-4" /> {speechSupported ? "Browser speech ready" : "Text fallback ready"}</span>
          </motion.button>
          <motion.button whileHover={{ y: -4 }} onClick={() => router.push("/interview?mode=chat")} className="glass group min-h-64 rounded-[28px] p-7 text-left">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-stone-950"><MessageCircle className="h-7 w-7 text-white" /></span>
            <h2 className="mt-8 text-2xl font-semibold text-stone-950">Start with Chat</h2>
            <p className="mt-3 text-sm leading-6 text-stone-600">Answer at your own pace in a focused founder conversation with the same quality gate and research loop.</p>
            <span className="mt-6 inline-flex text-xs font-medium text-stone-500">Exactly 15 core questions</span>
          </motion.button>
        </div>
        <p className="mt-7 text-center text-xs leading-5 text-stone-500">Raw audio is never stored. Transcript and structured founder context can be cleared from Settings.</p>
      </section>
    </main>
  );
}
