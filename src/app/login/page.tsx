"use client";

import { DotFieldBackground } from "@/components/animations/DotFieldBackground";
import { Logo } from "@/components/Logo";
import { firebaseAuth } from "@/lib/firebase";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const bridgeInFlight = useRef(false);

  function authErrorMessage(reason: unknown, fallback: string) {
    const message = reason instanceof Error ? reason.message : "";
    if (message.includes("auth/network-request-failed")) {
      return "Firebase sign-in could not reach the authentication service. Check your connection and try again.";
    }
    if (message.includes("auth/unauthorized-domain")) {
      return "This deployment domain is not authorized in Firebase. Add this exact domain in Firebase Authentication → Settings → Authorized domains.";
    }
    if (message.includes("auth/popup-closed-by-user")) {
      return "The sign-in window was closed before LaunchPilot could finish authentication.";
    }
    if (message.includes("auth/operation-not-allowed")) {
      return "This sign-in method is not enabled for this Firebase project yet.";
    }
    if (message.includes("auth/invalid-credential") || message.includes("auth/wrong-password")) {
      return "Those email credentials were not accepted. Check the email and password, or use Google sign-in.";
    }
    return message || fallback;
  }

  async function startServerSession(idToken: string, fallback?: { email?: string | null; name?: string | null }) {
    if (bridgeInFlight.current) return;
    bridgeInFlight.current = true;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 15_000);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      signal: controller.signal,
      body: JSON.stringify({ idToken, email: fallback?.email, name: fallback?.name }),
    }).finally(() => window.clearTimeout(timer));
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      bridgeInFlight.current = false;
      throw new Error(data.error || "Could not start your session.");
    }
    localStorage.setItem("launchpilot-user", JSON.stringify(data.user));
    window.dispatchEvent(new Event("launchpilot-auth-change"));
    const next = new URLSearchParams(window.location.search).get("next") || "/projects";
    window.location.assign(next);
  }

  useEffect(() => {
    let cancelled = false;

    async function checkExistingAppSession() {
      try {
        const response = await fetch("/api/auth/session", { credentials: "include" });
        const data = await response.json().catch(() => ({}));
        if (!cancelled && response.ok && data.authenticated) router.replace("/projects");
      } catch {
        // Firebase auth-state below can still restore the app session.
      }
    }

    void checkExistingAppSession();
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      if (!user || cancelled || bridgeInFlight.current) return;
      setLoading(true);
      setError("");
      try {
        await startServerSession(await user.getIdToken(), {
          email: user.email,
          name: user.displayName,
        });
      } catch (reason) {
        if (!cancelled) {
          bridgeInFlight.current = false;
          setError(authErrorMessage(reason, "Your Firebase sign-in succeeded, but LaunchPilot could not start the workspace session. Try signing in again."));
          setLoading(false);
        }
      }
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [router]);

  async function continueWithGoogle() {
    setError("");
    setLoading(true);
    try {
      const credential = await signInWithPopup(firebaseAuth, new GoogleAuthProvider());
      await startServerSession(await credential.user.getIdToken(), {
        email: credential.user.email,
        name: credential.user.displayName,
      });
    } catch (reason) {
      bridgeInFlight.current = false;
      setError(authErrorMessage(reason, "Google sign-in failed."));
      setLoading(false);
    }
  }

  async function continueWithEmail() {
    setError("");
    setLoading(true);
    const safeEmail = email.trim();
    if (!safeEmail || password.length < 6) {
      setError("Enter your email and a password with at least 6 characters.");
      setLoading(false);
      return;
    }
    try {
      let credential;
      try {
        credential = await signInWithEmailAndPassword(firebaseAuth, safeEmail, password);
      } catch {
        credential = await createUserWithEmailAndPassword(firebaseAuth, safeEmail, password);
      }
      await startServerSession(await credential.user.getIdToken(), {
        email: credential.user.email,
        name: credential.user.displayName || safeEmail.split("@")[0],
      });
    } catch (reason) {
      bridgeInFlight.current = false;
      setError(authErrorMessage(reason, "Email sign-in failed."));
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen bg-black">
      <DotFieldBackground variant="calm" bulgeStrength={32} />

      <div className="page-content relative z-10 flex min-h-screen flex-col items-center justify-center px-5">
        <div className="mb-8 flex items-center gap-3 text-white">
          <Logo size={32} />
          <span className="font-mono text-sm tracking-wide">LaunchPilot AI</span>
        </div>

        <div className="w-full max-w-sm border border-white/15 bg-black/80 p-8 shadow-2xl shadow-black/40">
          <p className="mono-label">Secure founder access</p>
          <h1 className="mt-3 text-2xl font-semibold text-white">Continue to your workspace</h1>
          <p className="mt-3 text-sm leading-6 text-lp-muted">
            Sign in with Google, or use email and password. Your founder ideas stay scoped to your account.
          </p>

          <button className="btn-primary mt-8 w-full justify-center" onClick={continueWithGoogle} disabled={loading}>
            {loading ? "Starting secure session..." : "Continue with Google"}
          </button>

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-white/10" />
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-lp-subtle">or email</span>
            <span className="h-px flex-1 bg-white/10" />
          </div>

          <div className="space-y-4">
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
                onChange={(event) => setEmail(event.target.value)}
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
                placeholder="At least 6 characters"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
          </div>

          {error && <p className="mt-4 text-sm leading-6 text-red-400">{error}</p>}

          <button className="btn-secondary mt-8 w-full justify-center" onClick={continueWithEmail} disabled={loading}>
            {loading ? "Starting secure session..." : "Continue with email"}
          </button>

          <p className="mt-6 text-center font-mono text-xs text-lp-subtle">
            LaunchPilot uses Firebase authentication and a signed server session.
          </p>
        </div>
      </div>
    </main>
  );
}
