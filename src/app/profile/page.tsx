"use client";

import { Nav } from "@/components/Nav";
import { demoProfile } from "@/lib/seed";
import type { FounderProfile } from "@/lib/types";
import { Save, Trash2, UserRound } from "lucide-react";
import { useEffect, useState } from "react";

export default function ProfilePage() {
  const [profile, setProfile] = useState<FounderProfile>(demoProfile);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => {
      const existing = localStorage.getItem("launchpilot-profile");
      if (existing) setProfile(JSON.parse(existing));
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  function update<K extends keyof FounderProfile>(key: K, value: FounderProfile[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  function save() {
    localStorage.setItem("launchpilot-profile", JSON.stringify(profile));
    localStorage.removeItem("launchpilot-brief");
    setSaved(true);
  }

  function clear() {
    ["launchpilot-user", "launchpilot-profile", "launchpilot-brief", "launchpilot-interview"].forEach((key) => localStorage.removeItem(key));
    setProfile(demoProfile);
    setSaved(true);
  }

  return (
    <main className="shell-bg min-h-screen">
      <Nav />
      <section className="mx-auto max-w-5xl px-5 pb-10">
        <div className="glass rounded-[32px] p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-full border border-lp-accent/40 bg-lp-accent/10 text-lp-accent">
                <UserRound className="h-5 w-5" />
              </span>
              <div>
                <p className="mono-label">Saved founder context</p>
                <h1 className="text-3xl font-semibold tracking-tight text-stone-50">Founder profile</h1>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="btn-primary inline-flex items-center gap-2 px-5 py-3 text-sm" onClick={save}>
                <Save className="h-4 w-4" /> Save
              </button>
              <button className="btn-secondary inline-flex items-center gap-2 px-5 py-3 text-sm" onClick={clear}>
                <Trash2 className="h-4 w-4" /> Clear
              </button>
            </div>
          </div>

          <div className="mt-7 grid gap-4 md:grid-cols-2">
            <input className="input-field-rect px-4 py-3" value={profile.name} onChange={(event) => update("name", event.target.value)} placeholder="Name" />
            <input className="input-field-rect px-4 py-3" value={profile.location} onChange={(event) => update("location", event.target.value)} placeholder="Location" />
            <input className="input-field-rect px-4 py-3" value={profile.status} onChange={(event) => update("status", event.target.value)} placeholder="Status" />
            <input className="input-field-rect px-4 py-3" value={profile.budget} onChange={(event) => update("budget", event.target.value)} placeholder="Budget" />
            <input className="input-field-rect px-4 py-3" type="number" value={profile.hoursPerWeek} onChange={(event) => update("hoursPerWeek", Number(event.target.value))} placeholder="Hours per week" />
            <input className="input-field-rect px-4 py-3" value={profile.skills.join(", ")} onChange={(event) => update("skills", event.target.value.split(",").map((skill) => skill.trim()).filter(Boolean))} placeholder="Skills" />
          </div>

          <div className="mt-4 grid gap-4">
            <textarea className="input-field-rect min-h-24 p-4" value={profile.rawIdea} onChange={(event) => update("rawIdea", event.target.value)} placeholder="Rough idea" />
            <textarea className="input-field-rect min-h-24 p-4" value={profile.targetUser} onChange={(event) => update("targetUser", event.target.value)} placeholder="Target user" />
            <textarea className="input-field-rect min-h-24 p-4" value={profile.success30Days} onChange={(event) => update("success30Days", event.target.value)} placeholder="30-day success target" />
          </div>

          <p className="mt-5 text-sm text-lp-muted">
            {saved ? "Saved. Re-run research to regenerate the roadmap from this context." : "Changes stay local until you save."}
          </p>
        </div>
      </section>
    </main>
  );
}
