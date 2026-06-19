"use client";

import { DotFieldBackground } from "@/components/animations/DotFieldBackground";
import { Logo } from "@/components/Logo";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function continueToWorkspace() {
    setError("");
    setLoading(true);
    const safeEmail = email.trim();
    if (!safeEmail) {
      setError("Enter your email address.");
      setLoading(false);
      return;
    }
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: safeEmail, name: safeEmail.split("@")[0] }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Could not start your session.");
      setLoading(false);
      return;
    }
    localStorage.setItem("launchpilot-user", JSON.stringify(data.user));
    window.dispatchEvent(new Event("launchpilot-auth-change"));
    router.push("/start");
  }

  return (
    <main className="relative min-h-screen bg-black">
      <DotFieldBackground variant="calm" bulgeStrength={32} />

      <div className="page-content relative z-10 flex min-h-screen flex-col items-center justify-center px-5">
        <div className="mb-8 flex items-center gap-3 text-white">
          <Logo size={32} />
          <span className="font-mono text-sm tracking-wide">LaunchPilot AI</span>
        </div>

        <div className="w-full max-w-sm border border-white/15 bg-black/80 p-8">
          <p className="mono-label">Sign in</p>
          <h1 className="mt-3 text-2xl font-semibold text-white">Continue to your workspace</h1>

          <div className="mt-8 space-y-4">
            <div>
              <label htmlFor="email" className="mono-label mb-2 block">
                Email
              </label>
              <input
                id="email"
                type="email"
                className="input-field"
                placeholder="you@university.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="mono-label mb-2 block">
                Password
              </label>
              <input
                id="password"
                type="password"
                className="input-field"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
          <button className="btn-primary mt-8 w-full" onClick={continueToWorkspace} disabled={loading}>
            {loading ? "Starting secure session…" : "Continue"}
          </button>

          <p className="mt-6 text-center font-mono text-xs text-lp-subtle">
            Your founder context is stored in your signed local workspace.
          </p>
        </div>
      </div>
    </main>
  );
}
