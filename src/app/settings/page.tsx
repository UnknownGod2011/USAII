"use client";

import { Nav } from "@/components/Nav";
import { Shield, Trash2 } from "lucide-react";
import { useState } from "react";

export default function SettingsPage() {
  const [cleared, setCleared] = useState(false);
  function clearContext() {
    ["launchpilot-user", "launchpilot-profile", "launchpilot-brief", "launchpilot-interview"].forEach((key) => localStorage.removeItem(key));
    setCleared(true);
  }
  return (
    <main className="shell-bg min-h-screen">
      <Nav />
      <section className="mx-auto flex min-h-[calc(100vh-88px)] max-w-2xl items-center px-5 pb-10">
        <div className="glass w-full rounded-[32px] p-6">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-lp-accent" />
            <h1 className="text-3xl font-semibold tracking-tight text-stone-50">Privacy and saved context</h1>
          </div>
          <div className="mt-6 space-y-4 text-sm leading-6 text-lp-muted">
            <p>LaunchPilot saves demo profile data, structured interview answers, workspace cards, sources, agent outputs, roadmap, and chatbot context in browser local storage.</p>
            <p>Raw audio is not stored by default. Gemini Live is optional; Web Speech and text mode fallbacks remain available.</p>
            <p>API keys are read from environment variables only. The UI never stores plaintext keys.</p>
          </div>
          <button className="btn-primary mt-6 inline-flex items-center gap-2 px-5 py-3 text-sm" onClick={clearContext}>
            <Trash2 className="h-4 w-4" /> Clear workspace
          </button>
          {cleared && <p className="mt-4 text-sm text-emerald-400">Saved context cleared from this browser.</p>}
        </div>
      </section>
    </main>
  );
}
