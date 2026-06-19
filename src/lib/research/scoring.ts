import type { EvidenceClaim, EvidenceScore, FounderIntake, ResearchSource } from "../intake/schema";

type Breakdown = EvidenceScore["breakdown"];
type Dimension = keyof Breakdown;

export function verdictForScore(score: number): EvidenceScore["verdict"] {
  if (score >= 80) return "strong";
  if (score >= 60) return "promising_needs_modification";
  if (score >= 40) return "weak";
  return "reject";
}

function directValidationStrength(value: string) {
  const text = value.toLowerCase();
  if (/revenue|paying|repeat users|retention/.test(text)) return 20;
  if (/users exist|active users|pilot|preorder/.test(text)) return 17;
  if (/interview|survey/.test(text)) return 13;
  if (/research|data/.test(text)) return 10;
  if (/competitor|community|review|online/.test(text)) return 7;
  if (/personal experience|friends|classmates/.test(text)) return 4;
  return 1;
}

export function hasDirectUserEvidence(value: string) {
  return /revenue|paying|users exist|active users|pilot|preorder|interview|survey/i.test(value);
}

function isBroadTarget(value: string) {
  return /^(?:everyone|anyone|people|users|students|businesses|companies|founders|professionals)$/i.test(value.trim());
}

function meaningfulAlternatives(value: string) {
  return !/^(?:none|nothing|idk|not sure|no idea|unclear\s*\/\s*skipped)$/i.test(value.trim()) && value.trim().length >= 5;
}

function evidenceWeight(claim: EvidenceClaim) {
  const confidence = claim.confidence === "high" ? 1 : claim.confidence === "medium" ? 0.72 : 0.38;
  const support = claim.support === "supports" ? 1 : claim.support === "contradicts" ? -0.7 : 0.25;
  return claim.relevanceScore * claim.qualityScore * confidence * support;
}

function sourceEvidenceMetrics(sources: ResearchSource[]) {
  const usable = sources.filter((source) =>
    source.sourceType !== "fallback"
    && source.relevanceScore >= 0.2
    && source.qualityScore >= 0.4,
  );
  if (!usable.length) return { usable, strength: 0, diversity: 0, verifiedRatio: 0 };
  const weighted = usable.map((source) =>
    source.relevanceScore
    * source.qualityScore
    * (source.verified ? 1 : 0.68)
    * (source.confidence === "high" ? 1 : source.confidence === "medium" ? 0.78 : 0.5),
  );
  const diversity = new Set(usable.map((source) => source.sourceType)).size;
  const verifiedRatio = usable.filter((source) => source.verified).length / usable.length;
  const average = weighted.reduce((sum, value) => sum + value, 0) / weighted.length;
  const corroboration = Math.min(1, usable.length / 6);
  const diversityFactor = Math.min(1, diversity / 4);
  return {
    usable,
    strength: Math.min(1, average * 0.58 + corroboration * 0.24 + diversityFactor * 0.18),
    diversity,
    verifiedRatio,
  };
}

function claimScore(claims: EvidenceClaim[], categories: EvidenceClaim["category"][], maximum: number) {
  const total = claims
    .filter((claim) => categories.includes(claim.category) && claim.sourceIds.length)
    .reduce((sum, claim) => sum + evidenceWeight(claim), 0);
  return Math.max(0, Math.min(maximum, Math.round(total * maximum * 0.8)));
}

function capBreakdown(breakdown: Breakdown, cap: number): Breakdown {
  const total = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
  if (total <= cap) return breakdown;
  const keys = Object.keys(breakdown) as Dimension[];
  const scaled = Object.fromEntries(keys.map((key) => [key, Math.floor((breakdown[key] / total) * cap)])) as Breakdown;
  let remainder = cap - Object.values(scaled).reduce((sum, value) => sum + value, 0);
  for (const key of keys.sort((a, b) => breakdown[b] - breakdown[a])) {
    if (remainder <= 0) break;
    scaled[key] += 1;
    remainder -= 1;
  }
  return scaled;
}

function evidenceMap(claims: EvidenceClaim[]) {
  const by = (categories: EvidenceClaim["category"][]) => claims.filter((claim) => categories.includes(claim.category)).map((claim) => claim.id);
  return {
    problemPainClarity: by(["problem"]),
    targetUserSharpness: by(["target_user", "problem"]),
    demandEvidence: by(["demand"]),
    competitorGap: by(["competitor", "pricing"]),
    feasibility: by(["feasibility"]),
    founderMarketFit: by(["problem", "target_user", "feasibility"]),
    riskLevel: by(["risk"]),
  };
}

export function calculateEvidenceScore(
  intake: FounderIntake,
  sources: ResearchSource[],
  mode: EvidenceScore["researchMode"],
  claims: EvidenceClaim[] = [],
): EvidenceScore {
  const noIdea = intake.stage === "no idea yet" || intake.rawIdea === "no idea yet";
  const sourceMetrics = sourceEvidenceMetrics(sources);
  const externalSources = sourceMetrics.usable;
  const directEvidence = hasDirectUserEvidence(intake.evidenceLevel);

  const problemBase = noIdea ? 2 : /^(?:problem|pain|hard|bad|annoying|nothing)$/i.test(intake.problem.trim()) ? 4 : 10;
  const consequence = /cost|waste|delay|risk|lose|fail|frustrat|time|money|manual|miss|cannot|can't/i.test(intake.problem) ? 5 : 2;
  const problemExternal = Math.min(5, claimScore(claims, ["problem"], 4) + Math.round(sourceMetrics.strength * 2));
  const problemPainClarity = Math.min(20, problemBase + consequence + problemExternal);

  const targetUserSharpness = noIdea
    ? 2
    : isBroadTarget(intake.targetUser)
      ? 3
      : Math.min(15, 9 + (/\bwho\b|\bwith\b|\bin\b|\bat\b|\busing\b|\bfirst-year\b|\bpre-revenue\b|\bsmall\b/i.test(intake.targetUser) ? 3 : 1) + claimScore(claims, ["target_user"], 3));

  const demandEvidence = Math.min(
    20,
    directValidationStrength(intake.evidenceLevel)
    + claimScore(claims, ["demand"], 6)
    + Math.round(sourceMetrics.strength * 2),
  );

  const competitorClaims = claims.filter((claim) => claim.category === "competitor" && claim.sourceIds.length && evidenceWeight(claim) > 0.12);
  const alternativesBase = meaningfulAlternatives(intake.alternatives) ? 6 : 2;
  const competitorGap = noIdea ? 2 : Math.min(
    15,
    alternativesBase
    + Math.min(5, competitorClaims.length * 2)
    + Math.round(sourceMetrics.strength * 2)
    + (/\bmanual\b|\bspreadsheet\b|\bdo nothing\b|\bword of mouth\b/i.test(intake.alternatives) ? 2 : 0),
  );

  const time = intake.hoursPerWeek >= 10 ? 5 : intake.hoursPerWeek >= 5 ? 4 : intake.hoursPerWeek > 0 ? 2 : 0;
  const skills = Math.min(5, Math.max(1, intake.skills.length * 2));
  const budget = /25,000\+|25000\+|₹25,000\+/i.test(intake.budget) ? 3 : /5,000|5000/i.test(intake.budget) ? 2 : 1;
  const scopeRisk = /marketplace|hardware|medical|healthcare|fintech|banking|blockchain|autonomous|global platform/i.test(intake.rawIdea) ? -2 : 1;
  const feasibility = Math.max(0, Math.min(15, time + skills + budget + scopeRisk + claimScore(claims, ["feasibility"], 2)));

  const livedExperience = /personal experience|own experience|users|revenue|interview/i.test(intake.evidenceLevel) ? 4 : 1;
  const audienceAccess = intake.status.toLowerCase().includes("student") && intake.targetUser.toLowerCase().includes("student") ? 3 : 1;
  const founderMarketFit = Math.min(10, livedExperience + audienceAccess + Math.min(3, intake.skills.length));

  const highRisk = /medical|healthcare|finance|banking|children|minor|legal|regulated|hardware/i.test(intake.rawIdea);
  const riskEvidence = claims.filter((claim) => claim.category === "risk" && claim.support === "contradicts").length;
  const riskLevel = Math.max(0, Math.min(5, (highRisk ? 2 : 4) - Math.min(2, riskEvidence)));

  let breakdown: Breakdown = {
    problemPainClarity,
    targetUserSharpness,
    demandEvidence,
    competitorGap,
    feasibility,
    founderMarketFit,
    riskLevel,
  };

  let scoreCapReason: string | undefined;
  if (!directEvidence && (externalSources.length === 0 || sourceMetrics.strength < 0.18)) {
    breakdown = capBreakdown(breakdown, 59);
    scoreCapReason = "The score is capped at 59 because neither direct user evidence nor sufficiently relevant, high-quality external evidence is available.";
  } else if (!directEvidence) {
    breakdown = capBreakdown(breakdown, 69);
    scoreCapReason = "The score is capped at 69 until the founder collects direct user, pilot, usage, or payment evidence.";
  } else if (competitorClaims.length === 0) {
    breakdown = capBreakdown(breakdown, 79);
    scoreCapReason = "The score is capped below 80 until a relevant competitor or current alternative is supported by external evidence.";
  }

  const score = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
  const verdict = verdictForScore(score);
  const maximums: Record<Dimension, number> = {
    problemPainClarity: 20,
    targetUserSharpness: 15,
    demandEvidence: 20,
    competitorGap: 15,
    feasibility: 15,
    founderMarketFit: 10,
    riskLevel: 5,
  };
  const ordered = (Object.entries(breakdown) as [Dimension, number][]).sort((a, b) => (b[1] / maximums[b[0]]) - (a[1] / maximums[a[0]]));
  const labels: Record<Dimension, string> = {
    problemPainClarity: "Problem pain and clarity",
    targetUserSharpness: "Target user sharpness",
    demandEvidence: "Demand evidence",
    competitorGap: "Competitor and alternative evidence",
    feasibility: "Founder feasibility",
    founderMarketFit: "Founder-market fit",
    riskLevel: "Risk profile",
  };

  return {
    score,
    verdict,
    breakdown,
    reasoning: verdict === "strong"
      ? "The direction has enough direct validation, relevant market evidence, and founder feasibility to justify a narrow execution sprint."
      : verdict === "promising_needs_modification"
        ? "The direction is plausible, but evidence gaps or founder constraints still require a narrower first version."
        : verdict === "weak"
          ? "The current direction lacks sufficient validation strength, source coverage, or a defensible first wedge."
          : "The evidence is too weak to recommend building this version. Start with a reachable problem and direct user evidence.",
    strongestSignal: labels[ordered[0][0]],
    weakestSignal: labels[ordered.at(-1)![0]],
    whatCouldBeWrong: mode === "fallback"
      ? "Live research was unavailable, so market conclusions are limited to founder statements and transparent offline reasoning."
      : `Public web evidence may not represent the exact segment, local context, urgency, or willingness to pay. ${Math.round(sourceMetrics.verifiedRatio * 100)}% of retained sources were opened directly across ${sourceMetrics.diversity} source types.`,
    nextValidationStep: noIdea
      ? "Interview eight people in one community you can reach and rank their repeated painful problems."
      : `Interview five ${intake.targetUser.toLowerCase()} and collect recent examples of the problem before showing a solution.`,
    sources,
    researchMode: mode,
    evidenceByDimension: evidenceMap(claims),
    scoreCapReason,
  };
}

export function canProceedToDashboard(score: number, approvedModifiedIdea: boolean) {
  return score >= 80 || (score >= 60 && approvedModifiedIdea);
}
