"use client";

import { Nav } from "@/components/Nav";
import { Download, LogOut, Shield, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function SettingsPage() {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [api, setApi] = useState<{ liveVoice?: { available: boolean; mode: string } } | null>(null);
  useEffect(() => { fetch("/api/voice").then((response) => response.json()).then(setApi).catch(() => null); }, []);

  async function clearContext() {
    const response = await fetch("/api/account/data", { method: "DELETE" });
    if (response.ok) {
      Object.keys(localStorage).filter((key) => key.startsWith("launchpilot-")).forEach((key) => localStorage.removeItem(key));
      setStatus("Saved founder context and workspace cleared.");
    }
  }
  async function exportData() {
    const response = await fetch("/api/account/data");
    const data = await response.json();
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "launchpilot-data.json"; anchor.click(); URL.revokeObjectURL(url);
  }
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login"); router.refresh();
  }
  return (
    <main className="shell-bg min-h-screen">
      <Nav />
      <section className="mx-auto max-w-3xl px-5 pb-12">
        <div className="glass rounded-[32px] p-7">
          <div className="flex items-center gap-3"><Shield className="h-5 w-5 text-emerald-600" /><h1 className="text-3xl font-semibold text-stone-950">Settings and saved context</h1></div>
          <div className="mt-7 divide-y divide-stone-200 text-sm">
            <div className="flex items-start justify-between gap-4 py-5"><div><h2 className="font-semibold text-stone-950">Storage</h2><p className="mt-1 leading-6 text-stone-600">Founder intake, validations, approved direction, sources, agent reports, workspace, and Copilot history are stored in local SQLite under your account.</p></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-800">User-scoped</span></div>
            <div className="flex items-start justify-between gap-4 py-5"><div><h2 className="font-semibold text-stone-950">Live voice</h2><p className="mt-1 leading-6 text-stone-600">{api?.liveVoice?.available ? "Secure live voice is available." : "Browser speech and text are available."} Raw audio is never persisted.</p></div><span className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-600">{api?.liveVoice?.available ? "Ready" : "Fallback ready"}</span></div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <button onClick={() => void exportData()} className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-5 py-3 text-sm font-semibold"><Download className="h-4 w-4" /> Export data</button>
            <button onClick={() => void clearContext()} className="inline-flex items-center gap-2 rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white"><Trash2 className="h-4 w-4" /> Clear context and workspace</button>
            <button onClick={() => void logout()} className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-5 py-3 text-sm font-semibold"><LogOut className="h-4 w-4" /> Log out</button>
          </div>
          {status && <p className="mt-4 text-sm text-emerald-700">{status}</p>}
        </div>
      </section>
    </main>
  );
}
