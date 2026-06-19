const BADGES = [
  "Evidence labels",
  "Human control",
  "No funding predictions",
  "Source transparency",
];

export function LandingSafety() {
  return (
    <section id="safety" className="scroll-mt-28 mx-auto max-w-5xl px-5 py-24">
      <p className="mono-label">Safety & concerns</p>
      <h2 className="mt-4 max-w-2xl text-3xl font-semibold tracking-tight text-white md:text-4xl">
        Transparent about what AI can and cannot do
      </h2>
      <div className="mt-8 max-w-3xl space-y-5 text-base leading-7 text-lp-muted">
        <p>
          LaunchPilot does not pretend to predict funding outcomes or guarantee product-market fit. Findings
          include evidence labels and source quality scoring so you can judge confidence before acting.
        </p>
        <p>
          You approve every publish step. The roadmap is a starting point — not a mandate. Human judgment stays
          in the loop from interview through build.
        </p>
        <p>
          Your founder profile, research evidence, and project workspace are stored in user-scoped records. Interview transcripts
          and project details stay private to you — we do not sell founder context or use it for unrelated
          training.
        </p>
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        {BADGES.map((badge) => (
          <span
            key={badge}
            className="rounded-sm border border-white/15 px-3 py-1.5 font-mono text-xs uppercase tracking-wide text-lp-muted"
          >
            {badge}
          </span>
        ))}
      </div>
    </section>
  );
}
