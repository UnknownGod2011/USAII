"use client";

import { Badge } from "@/components/Badge";
import { breakdownToMarkdown, syllabusAssistantReply, type SyllabusBreakdown } from "@/lib/syllabus";
import {
  BookOpen,
  Calendar,
  ClipboardList,
  Download,
  GraduationCap,
  MessageCircle,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

function downloadFile(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function Section({
  title,
  icon: Icon,
  children,
  empty,
}: {
  title: string;
  icon: typeof BookOpen;
  children: ReactNode;
  empty?: boolean;
}) {
  return (
    <section className="premium-card rounded-[22px] p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-stone-900">
        <Icon className="h-4 w-4 text-violet-600" />
        {title}
      </div>
      {empty ? (
        <p className="mt-3 text-sm text-stone-500">Nothing detected yet. Paste more syllabus detail or ask the assistant.</p>
      ) : (
        <div className="mt-4">{children}</div>
      )}
    </section>
  );
}

export function SyllabusBreakdownView({
  breakdown,
  onReanalyze,
  loading,
}: {
  breakdown: SyllabusBreakdown;
  onReanalyze?: () => void;
  loading?: boolean;
}) {
  const [question, setQuestion] = useState("What is the grading breakdown?");
  const [answer, setAnswer] = useState(() => syllabusAssistantReply("What is the grading breakdown?", breakdown));
  const markdown = useMemo(() => breakdownToMarkdown(breakdown), [breakdown]);

  const ask = () => {
    setAnswer(syllabusAssistantReply(question, breakdown));
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
      <div className="space-y-5">
        <section className="glass rounded-[28px] p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">Course breakdown</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-950 md:text-4xl">{breakdown.courseName}</h1>
              <div className="mt-3 flex flex-wrap gap-2 text-sm text-stone-600">
                {breakdown.courseCode && <span>{breakdown.courseCode}</span>}
                {breakdown.semester && <span>• {breakdown.semester}</span>}
                {breakdown.instructor && <span>• {breakdown.instructor}</span>}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge label={breakdown.mode === "ai" ? "AI parsed" : "Fallback analysis"} />
              {onReanalyze && (
                <button
                  type="button"
                  onClick={onReanalyze}
                  disabled={loading}
                  className="rounded-full border border-stone-200 bg-white/80 px-4 py-2 text-sm font-medium text-stone-800 hover:bg-white disabled:opacity-60"
                >
                  {loading ? "Analyzing..." : "Re-analyze"}
                </button>
              )}
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Meeting times", value: breakdown.meetingTimes },
              { label: "Location", value: breakdown.location },
              { label: "Office hours", value: breakdown.officeHours },
              { label: "Assessments", value: breakdown.exams.length ? `${breakdown.exams.length} found` : undefined },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-[18px] border border-stone-100 bg-white/70 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-stone-500">{label}</p>
                <p className="mt-2 text-sm font-medium text-stone-900">{value || "Not listed"}</p>
              </div>
            ))}
          </div>

          {breakdown.warnings?.length ? (
            <div className="mt-5 rounded-[18px] border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900">
              <div className="flex items-center gap-2 font-medium">
                <AlertCircle className="h-4 w-4" />
                Review these gaps
              </div>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {breakdown.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <div className="grid gap-5 xl:grid-cols-2">
          <Section title="Grading setup" icon={GraduationCap} empty={!breakdown.grading.components.length}>
            <div className="space-y-3">
              {breakdown.grading.components.map((item) => (
                <div key={`${item.name}-${item.weight}`} className="flex items-start justify-between gap-3 rounded-[16px] bg-stone-50/80 px-4 py-3">
                  <div>
                    <p className="font-medium text-stone-900">{item.name}</p>
                    {item.description ? <p className="mt-1 text-sm text-stone-600">{item.description}</p> : null}
                  </div>
                  {item.weight ? <span className="shrink-0 rounded-full bg-violet-100 px-3 py-1 text-sm font-semibold text-violet-700">{item.weight}</span> : null}
                </div>
              ))}
              {breakdown.grading.scale ? <p className="text-sm text-stone-600">Scale: {breakdown.grading.scale}</p> : null}
              {breakdown.grading.passingGrade ? <p className="text-sm text-stone-600">Passing grade: {breakdown.grading.passingGrade}</p> : null}
            </div>
          </Section>

          <Section title="Tests & exam dates" icon={Calendar} empty={!breakdown.exams.length}>
            <div className="space-y-3">
              {breakdown.exams.map((exam) => (
                <div key={`${exam.name}-${exam.date}`} className="rounded-[16px] border border-stone-100 bg-white/70 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium text-stone-900">{exam.name}</p>
                    {exam.weight ? <Badge label={exam.weight} /> : null}
                  </div>
                  <p className="mt-2 text-sm text-stone-600">
                    {[exam.date, exam.time, exam.location].filter(Boolean).join(" • ") || "Date not specified"}
                  </p>
                  {exam.notes ? <p className="mt-1 text-sm text-stone-500">{exam.notes}</p> : null}
                </div>
              ))}
            </div>
          </Section>

          <Section title="Textbooks & materials" icon={BookOpen} empty={!breakdown.textbooks.length}>
            <div className="space-y-3">
              {breakdown.textbooks.map((book) => (
                <div key={`${book.title}-${book.isbn}`} className="rounded-[16px] border border-stone-100 bg-white/70 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Badge label={book.required ? "Required" : "Optional"} />
                    <p className="font-medium text-stone-900">{book.title}</p>
                  </div>
                  {book.author ? <p className="mt-2 text-sm text-stone-600">{book.author}</p> : null}
                  {book.isbn ? <p className="mt-1 text-xs text-stone-500">ISBN {book.isbn}</p> : null}
                </div>
              ))}
            </div>
          </Section>

          <Section title="Important dates" icon={ClipboardList} empty={!breakdown.importantDates.length}>
            <div className="space-y-2">
              {breakdown.importantDates.map((item) => (
                <div key={`${item.label}-${item.date}`} className="flex items-center justify-between gap-3 rounded-[14px] bg-stone-50/80 px-4 py-2.5 text-sm">
                  <span className="font-medium text-stone-900">{item.label}</span>
                  <span className="text-stone-600">{item.date}</span>
                </div>
              ))}
            </div>
          </Section>
        </div>

        <Section title="Weekly schedule" icon={Calendar} empty={!breakdown.schedule.length}>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-stone-100 text-stone-500">
                  <th className="px-3 py-2 font-medium">Week</th>
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Topic</th>
                  <th className="px-3 py-2 font-medium">Work</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.schedule.map((item, index) => (
                  <tr key={`${item.topic}-${index}`} className="border-b border-stone-50">
                    <td className="px-3 py-3 text-stone-700">{item.week ?? "—"}</td>
                    <td className="px-3 py-3 text-stone-700">{item.date ?? "—"}</td>
                    <td className="px-3 py-3 font-medium text-stone-900">{item.topic}</td>
                    <td className="px-3 py-3 text-stone-600">{[item.readings, item.assignments].filter(Boolean).join(" • ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      </div>

      <aside className="space-y-5">
        <section className="glass rounded-[24px] p-5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-600" />
            <h2 className="font-semibold text-stone-950">Course assistant</h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            Ask about grading, exams, textbooks, office hours, or the schedule. Answers come from your parsed syllabus.
          </p>
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            rows={4}
            className="mt-4 w-full rounded-[18px] border border-stone-200 bg-white/90 px-4 py-3 text-sm text-stone-900 outline-none focus:border-violet-300"
            placeholder="When is the midterm?"
          />
          <button
            type="button"
            onClick={ask}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-[18px] bg-stone-950 px-4 py-3 text-sm font-semibold text-white hover:-translate-y-0.5"
          >
            <MessageCircle className="h-4 w-4" />
            Ask assistant
          </button>
          <div className="mt-4 rounded-[18px] border border-stone-100 bg-white/80 p-4 text-sm leading-6 text-stone-700">{answer}</div>
          <div className="mt-4 flex flex-wrap gap-2">
            {["What is the grading breakdown?", "When is the final exam?", "What textbooks do I need?", "Show me the schedule"].map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => {
                  setQuestion(prompt);
                  setAnswer(syllabusAssistantReply(prompt, breakdown));
                }}
                className="rounded-full border border-stone-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-white"
              >
                {prompt}
              </button>
            ))}
          </div>
        </section>

        <section className="premium-card rounded-[24px] p-5">
          <h2 className="font-semibold text-stone-950">Export</h2>
          <p className="mt-2 text-sm text-stone-600">Download your breakdown for Notion, Google Docs, or printing.</p>
          <div className="mt-4 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => downloadFile(`${breakdown.courseName.replace(/\s+/g, "-").toLowerCase()}-breakdown.md`, markdown, "text/markdown")}
              className="inline-flex items-center justify-center gap-2 rounded-[16px] border border-stone-200 bg-white px-4 py-3 text-sm font-medium text-stone-900 hover:bg-stone-50"
            >
              <Download className="h-4 w-4" />
              Download Markdown
            </button>
            <button
              type="button"
              onClick={() =>
                downloadFile(
                  `${breakdown.courseName.replace(/\s+/g, "-").toLowerCase()}-breakdown.json`,
                  JSON.stringify(breakdown, null, 2),
                  "application/json",
                )
              }
              className="inline-flex items-center justify-center gap-2 rounded-[16px] border border-stone-200 bg-white px-4 py-3 text-sm font-medium text-stone-900 hover:bg-stone-50"
            >
              <Download className="h-4 w-4" />
              Download JSON
            </button>
          </div>
        </section>
      </aside>
    </div>
  );
}
