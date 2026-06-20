"use client";

import { Nav } from "@/components/Nav";
import {
  clearLaunchPilotLocalData,
  clearStoredUser,
  getStoredUser,
} from "@/lib/auth-session";
import { firebaseAuth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

function PrivacyList({ items }: { items: string[] }) {
  return (
    <ul className="privacy-list">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const [signedIn, setSignedIn] = useState(false);
  const [ready, setReady] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => setSignedIn(!!getStoredUser());
    const timer = window.setTimeout(() => {
      sync();
      setReady(true);
    }, 0);
    window.addEventListener("launchpilot-auth-change", sync);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("launchpilot-auth-change", sync);
    };
  }, []);

  async function handleSignOut() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    await signOut(firebaseAuth).catch(() => undefined);
    clearStoredUser();
    window.dispatchEvent(new Event("launchpilot-auth-change"));
    router.push("/login");
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    setError(null);

    try {
      const response = await fetch("/api/account/data", { method: "DELETE" });
      if (!response.ok) throw new Error("Could not delete account data.");
      await signOut(firebaseAuth).catch(() => undefined);
      clearLaunchPilotLocalData();
      window.dispatchEvent(new Event("launchpilot-auth-change"));
      setConfirmDelete(false);
      router.push("/login");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete account");
      setDeleting(false);
    }
  }

  if (!ready) {
    return (
      <main className="shell-bg min-h-screen">
        <Nav />
        <section className="mx-auto max-w-3xl px-5 py-10">
          <p className="font-mono text-sm text-lp-muted">Loading privacy settings…</p>
        </section>
      </main>
    );
  }

  return (
    <main className="shell-bg min-h-screen">
      <Nav />

      <section className="mx-auto max-w-3xl space-y-6 px-5 py-8 pb-16">
        <div>
          <p className="mono-label">Privacy</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">Your data &amp; control</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-lp-muted">
            LaunchPilot is a hackathon build — this page explains what we actually collect and how you can manage it.
            No dense legal text, just the facts.
          </p>
        </div>

        {error && (
          <div className="profile-section-card">
            <p className="font-mono text-sm text-red-400">{error}</p>
          </div>
        )}

        <div className="profile-section-card space-y-3">
          <h2 className="profile-section-title">What we collect</h2>
          <p className="text-sm leading-6 text-lp-muted">
            We only store what you enter or generate while using LaunchPilot. Nothing is collected passively in the
            background.
          </p>
          <PrivacyList
            items={[
              "Interview conversation text (what you tell the AI during the founder interview)",
              "Founder profile fields (background, skills, goals)",
              "Avatar image (stored as a compressed image directly in your profile)",
              "Account email",
            ]}
          />
        </div>

        <div className="profile-section-card space-y-3">
          <h2 className="profile-section-title">How your data is used</h2>
          <p className="text-sm leading-6 text-lp-muted">
            Your data powers the features you trigger — interview, research, and publish. We do not sell founder
            context or use it for unrelated training.
          </p>
          <PrivacyList
            items={[
              "Interview responses are processed server-side to validate answer quality and structure your founder context. Optional voice mode may use a short-lived secure voice session.",
              "Research agents query configured live search services to ground market research. Only the idea and context needed for the active research step are sent.",
              "We only send what's needed to run the specific feature you're using — nothing is shared beyond what's required for the interview or research step you triggered.",
            ]}
          />
        </div>

        <div className="profile-section-card space-y-3">
          <h2 className="profile-section-title">Your control over your data</h2>
          <p className="text-sm leading-6 text-lp-muted">
            You can change or remove your data without contacting support. These controls are built into the app
            today.
          </p>
          <PrivacyList
            items={[
              "Edit your founder profile fields any time from the Profile tab.",
              "Edit or delete individual published projects from the Workspace tab.",
            ]}
          />
          <div className="flex flex-wrap gap-3 pt-2">
            <Link href="/profile" className="btn-secondary text-xs">
              Go to profile
            </Link>
            <Link href="/dashboard" className="btn-secondary text-xs">
              Go to workspace
            </Link>
          </div>

          {signedIn && (
            <div className="mt-4 border-t border-white/10 pt-4">
              <p className="text-sm leading-6 text-lp-muted">
                Delete your account removes your persisted founder profile, research, workspaces, and clears
                local session data from this browser.
              </p>
              {!confirmDelete ? (
                <button
                  type="button"
                  className="btn-secondary mt-4 text-xs text-red-300"
                  onClick={() => setConfirmDelete(true)}
                >
                  Delete account
                </button>
              ) : (
                <div className="mt-4 space-y-3">
                  <p className="font-mono text-xs text-lp-subtle">
                    This cannot be undone. Your profile and projects will be permanently deleted.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      className="btn-primary text-xs"
                      onClick={handleDeleteAccount}
                      disabled={deleting}
                    >
                      {deleting ? "Deleting…" : "Yes, delete my account"}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary text-xs"
                      onClick={() => setConfirmDelete(false)}
                      disabled={deleting}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="profile-section-card space-y-3">
          <h2 className="profile-section-title">Evidence &amp; source quality</h2>
          <p className="text-sm leading-6 text-lp-muted">
            Every research claim in your roadmap comes with a confidence and source label — verified, inferred, or
            needs validation — so you can see what&apos;s been checked versus what still needs proof.
          </p>
          <p className="text-sm leading-6 text-lp-muted">
            This is the same &ldquo;human approval at every step&rdquo; principle on the landing page: LaunchPilot
            gives you labeled evidence, not blind faith in AI output. You decide what to act on.
          </p>
        </div>

        <div className="profile-section-card space-y-3">
          <h2 className="profile-section-title">Account &amp; security</h2>
          <p className="text-sm leading-6 text-lp-muted">
            This local build uses a signed, HTTP-only session tied to your email. It is suitable for local verification,
            but it does not yet include password hashing, MFA, email verification, or enterprise identity controls.
          </p>
          <p className="text-sm leading-6 text-lp-muted">
            API keys for AI and research services live in server environment variables only. They are never written
            to your profile or exposed in the client UI.
          </p>
          {signedIn ? (
            <button type="button" className="btn-secondary mt-2 text-xs" onClick={handleSignOut}>
              Sign out
            </button>
          ) : (
            <p className="font-mono text-xs text-lp-subtle">
              You are not signed in.{" "}
              <Link href="/login" className="text-white hover:underline">
                Sign in
              </Link>{" "}
              to manage your account.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
