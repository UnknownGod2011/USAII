"use client";

import { Nav } from "@/components/Nav";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function continueSession() {
    setLoading(true);
    setError("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Could not start the secure session.");
      setLoading(false);
      return;
    }
    localStorage.setItem("launchpilot-user", JSON.stringify(data.user));
    router.replace("/start");
    router.refresh();
  }

  return (
    <main className="shell-bg min-h-screen">
      <Nav />
      <section className="mx-auto flex min-h-[calc(100vh-88px)] max-w-xl items-center px-5 pb-10">
        <div className="glass w-full rounded-[32px] p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">Founder access</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">Continue as a founder.</h1>
          <p className="mt-3 text-slate-600">This creates a signed local session. Your founder context and workspace are stored in user-scoped records on this installation.</p>
          <div className="mt-6 space-y-3">
            <input className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100" placeholder="Name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
            <input className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100" placeholder="Email (optional)" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
          <button disabled={loading} className="mt-6 w-full rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white disabled:opacity-60" onClick={continueSession}>
            {loading ? "Starting secure session..." : "Continue securely"}
          </button>
        </div>
      </section>
    </main>
  );
}
