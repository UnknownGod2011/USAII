import type { EvidenceLabel } from "@/lib/types";

const styles: Record<string, string> = {
  Verified: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  Inferred: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  Approximate: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  "Needs validation": "border-orange-500/30 bg-orange-500/10 text-orange-300",
  "AI may be wrong": "border-rose-500/30 bg-rose-500/10 text-rose-300",
  "Fallback analysis": "border-slate-500/30 bg-slate-500/10 text-slate-300",
  "Official source": "border-blue-500/30 bg-blue-500/10 text-blue-300",
  "Community signal": "border-violet-500/30 bg-violet-500/10 text-violet-300",
  "Framework-based": "border-indigo-500/30 bg-indigo-500/10 text-indigo-300",
};

export function Badge({ label }: { label: EvidenceLabel | string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${styles[label] || styles.Inferred}`}>
      {label}
    </span>
  );
}
