import { generateLaunchBrief } from "./agents";
import type { EvaluationVerdict } from "./intake-questions";
import { intakeToFounderProfile, type IntakeAnswers } from "./intake-questions";
import { generateResearchedBrief, runLiveResearch } from "./research";
import type { FounderProfile, LaunchBrief, ResearchPack } from "./types";

export type IdeaEvaluation = {
  verdict: EvaluationVerdict;
  headline: string;
  summary: string;
  score: number;
  rating: string;
  suggestedPivot?: string;
  strengths: string[];
  concerns: string[];
  modifications: string[];
  brainstormDirections: string[];
  research: ResearchPack;
  brief: LaunchBrief;
  label: "live" | "hybrid" | "fallback";
};

function verdictFromBrief(brief: LaunchBrief, profile: FounderProfile): IdeaEvaluation {
  const noIdea = profile.ideaStage === "no idea yet";
  const weakEvidence = profile.evidence.join(" ").toLowerCase().includes("no formal") || profile.evidence.join(" ").toLowerCase().includes("none yet");
  const prematureFunding = brief.readinessLabel === "Fundraising is premature";

  const researchScore = brief.research.score;
  const overall = researchScore?.overall ?? brief.founderScore.overall;

  let verdict: EvaluationVerdict = "continue";
  if (noIdea || overall < 45) verdict = "reject";
  else if (weakEvidence && brief.risks.length >= 3) verdict = "modify";
  else if (overall < 68 || brief.founderScore.overall < 45) verdict = "modify";
  else if (prematureFunding && weakEvidence) verdict = "modify";

  const headline =
    verdict === "continue"
      ? "Worth continuing — focus on validation next"
      : verdict === "modify"
        ? "Promising direction, but needs sharper focus"
        : "Not ready yet — brainstorm a stronger problem first";

  const summary =
    verdict === "continue"
      ? `Based on ${brief.research.mode === "fallback" ? "fallback analysis" : "retrieved signals"}, this idea has enough clarity to move into structured validation. LaunchPilot is not predicting success — it is identifying a concrete next step.`
      : verdict === "modify"
        ? `There is a kernel here, but the evidence or feasibility is not strong enough yet. Current research score: ${overall}/100. Tighten one wedge before building more.`
        : `This is not ready to proceed as-is. Current research score: ${overall}/100. Use problem discovery or a sharper pivot before committing build time.`;

  return {
    verdict,
    headline,
    summary,
    score: overall,
    rating: researchScore?.rating || brief.founderScore.label,
    suggestedPivot: researchScore?.suggestedPivot,
    strengths: [brief.strongestPoint, ...(researchScore?.reasoning || []), ...brief.opportunities.slice(0, 2)].filter(Boolean).slice(0, 4),
    concerns: [brief.weakestPoint, ...brief.risks.slice(0, 3)].filter(Boolean),
    modifications:
      verdict === "modify"
        ? [
            researchScore?.suggestedPivot ? `Consider pivot: ${researchScore.suggestedPivot}` : "",
            brief.nextValidationTask,
            "Narrow to one user segment and one painful workflow",
            "Replace assumptions with 8–10 user conversations",
          ].filter(Boolean)
        : [],
    brainstormDirections:
      verdict === "reject"
        ? [
            researchScore?.suggestedPivot ? `Explore this pivot: ${researchScore.suggestedPivot}` : "",
            "Interview people in a community you already belong to",
            "List top 3 daily frustrations for that community",
            "Pick the problem you can validate in 7 days with zero budget",
          ].filter(Boolean)
        : [],
    research: brief.research,
    brief,
    label: brief.research.mode,
  };
}

export async function evaluateIntake(answers: IntakeAnswers): Promise<IdeaEvaluation> {
  const profile = intakeToFounderProfile(answers);
  const brief = await generateResearchedBrief(profile);
  return verdictFromBrief(brief, profile);
}

export async function runResearchOnly(profile: FounderProfile) {
  return runLiveResearch(profile);
}

export function buildFallbackEvaluation(answers: IntakeAnswers): IdeaEvaluation {
  const profile = intakeToFounderProfile(answers);
  const brief = generateLaunchBrief(profile);
  return verdictFromBrief(brief, profile);
}
