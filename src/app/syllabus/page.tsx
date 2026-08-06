"use client";

import { Nav } from "@/components/Nav";
import { SyllabusBreakdownView } from "@/components/SyllabusBreakdownView";
import { SAMPLE_SYLLABUS, type SyllabusBreakdown } from "@/lib/syllabus";
import { BookOpenCheck, FileUp, Sparkles, Upload } from "lucide-react";
import { useEffect, useState } from "react";

const STORAGE_KEY = "syllabus-breakdown";
const TEXT_STORAGE_KEY = "syllabus-raw-text";

export default function SyllabusPage() {
  const [text, setText] = useState("");
  const [breakdown, setBreakdown] = useState<SyllabusBreakdown | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const savedText = localStorage.getItem(TEXT_STORAGE_KEY);
    const savedBreakdown = localStorage.getItem(STORAGE_KEY);
    if (savedText) setText(savedText);
    if (savedBreakdown) {
      try {
        setBreakdown(JSON.parse(savedBreakdown));
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  const analyze = async (inputText = text) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/syllabus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: inputText }),
      });
      if (!response.ok) throw new Error("Could not analyze syllabus.");
      const data = await response.json();
      setBreakdown(data.breakdown);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data.breakdown));
      localStorage.setItem(TEXT_STORAGE_KEY, inputText);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (file: File | null) => {
    if (!file) return;
    const content = await file.text();
    setText(content);
    await analyze(content);
  };

  return (
    <main className="shell-bg min-h-screen">
      <Nav />
      <section className="mx-auto max-w-7xl px-5 pb-12 pt-2">
        <div className="mb-8 max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-violet-100 px-4 py-2 text-sm font-semibold text-violet-800">
            <BookOpenCheck className="h-4 w-4" />
            Syllabus assistant
          </span>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-stone-950 md:text-5xl">
            Turn your syllabus into a clear semester plan.
          </h1>
          <p className="mt-4 text-lg leading-8 text-stone-600">
            Paste or upload your course syllabus and get an easy breakdown of grading, test dates, textbooks, and the weekly schedule — plus an assistant to answer follow-up questions.
          </p>
        </div>

        {!breakdown ? (
          <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
            <div className="glass rounded-[28px] p-6">
              <label htmlFor="syllabus-text" className="text-sm font-semibold text-stone-900">
                Paste your syllabus
              </label>
              <textarea
                id="syllabus-text"
                value={text}
                onChange={(event) => setText(event.target.value)}
                rows={18}
                placeholder="Paste your full course syllabus here — grading policy, exam dates, textbooks, and weekly topics..."
                className="mt-4 w-full rounded-[22px] border border-stone-200 bg-white/90 px-5 py-4 text-sm leading-7 text-stone-900 outline-none focus:border-violet-300"
              />
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => analyze()}
                  disabled={loading || !text.trim()}
                  className="inline-flex items-center gap-2 rounded-full bg-stone-950 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-stone-300 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Sparkles className="h-4 w-4" />
                  {loading ? "Analyzing..." : "Analyze syllabus"}
                </button>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-stone-200 bg-white/80 px-5 py-3 text-sm font-semibold text-stone-900 hover:bg-white">
                  <Upload className="h-4 w-4" />
                  Upload .txt or .md
                  <input
                    type="file"
                    accept=".txt,.md,.text/plain,text/markdown"
                    className="hidden"
                    onChange={(event) => handleFileUpload(event.target.files?.[0] || null)}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setText(SAMPLE_SYLLABUS);
                    analyze(SAMPLE_SYLLABUS);
                  }}
                  className="rounded-full px-4 py-3 text-sm font-medium text-stone-600 hover:bg-white/70"
                >
                  Try sample syllabus
                </button>
              </div>
              {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}
            </div>

            <div className="space-y-5">
              <div className="premium-card rounded-[24px] p-5">
                <div className="flex items-center gap-2 font-semibold text-stone-950">
                  <FileUp className="h-4 w-4 text-sky-600" />
                  What gets extracted
                </div>
                <ul className="mt-4 space-y-3 text-sm leading-6 text-stone-600">
                  <li>Grading weights and passing requirements</li>
                  <li>Midterms, finals, quizzes, and due dates</li>
                  <li>Required and optional textbooks with ISBNs</li>
                  <li>Weekly topics, readings, and assignments</li>
                  <li>Office hours, meeting times, and location</li>
                </ul>
              </div>
              <div className="rounded-[24px] bg-emerald-50/80 p-5 text-sm leading-6 text-emerald-900 shadow-xl shadow-stone-300/20">
                Works without an API key using rule-based parsing. Add <code className="rounded bg-white/70 px-1.5 py-0.5">GEMINI_API_KEY</code> for smarter AI extraction on messy syllabi.
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="glass rounded-[24px] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-stone-900">Source syllabus</p>
                  <p className="mt-1 text-sm text-stone-500">Edit and re-analyze anytime.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setBreakdown(null);
                    localStorage.removeItem(STORAGE_KEY);
                  }}
                  className="rounded-full border border-stone-200 bg-white/80 px-4 py-2 text-sm font-medium text-stone-800 hover:bg-white"
                >
                  Start over
                </button>
              </div>
              <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                rows={8}
                className="mt-4 w-full rounded-[18px] border border-stone-200 bg-white/90 px-4 py-3 text-sm leading-6 text-stone-900 outline-none focus:border-violet-300"
              />
              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => analyze()}
                  disabled={loading}
                  className="rounded-full bg-stone-950 px-5 py-2.5 text-sm font-semibold text-white hover:-translate-y-0.5 disabled:opacity-60"
                >
                  {loading ? "Analyzing..." : "Re-analyze syllabus"}
                </button>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-stone-200 bg-white/80 px-4 py-2.5 text-sm font-medium text-stone-800 hover:bg-white">
                  <Upload className="h-4 w-4" />
                  Replace file
                  <input
                    type="file"
                    accept=".txt,.md,.text/plain,text/markdown"
                    className="hidden"
                    onChange={(event) => handleFileUpload(event.target.files?.[0] || null)}
                  />
                </label>
              </div>
            </div>
            <SyllabusBreakdownView breakdown={breakdown} onReanalyze={() => analyze()} loading={loading} />
          </div>
        )}
      </section>
    </main>
  );
}
