import type { EvidenceScore, FounderIntake, IdeaRevision, ResearchSource } from "../intake/schema";
import { calculateEvidenceScore } from "./scoring";

export type ResearchStep = { id: string; label: string; status: "pending" | "running" | "complete"; finding?: string };
export const RESEARCH_STEPS: ResearchStep[] = [
  { id: "evaluate", label: "Evaluating your startup idea", status: "pending" },
  { id: "user", label: "Understanding the target user", status: "pending" },
  { id: "competitors", label: "Searching for competitors and alternatives", status: "pending" },
  { id: "demand", label: "Looking for demand signals", status: "pending" },
  { id: "market", label: "Checking market size proxies", status: "pending" },
  { id: "feasibility", label: "Checking feasibility and execution risk", status: "pending" },
  { id: "fit", label: "Reviewing founder fit", status: "pending" },
  { id: "verdict", label: "Producing an evidence-based verdict", status: "pending" },
];

export function createInitialProgress() {
  return { steps: RESEARCH_STEPS.map((step) => ({ ...step })), currentStep: 0, isComplete: false };
}

export function runResearchEvaluation(intake: FounderIntake, sources: ResearchSource[] = []): Promise<EvidenceScore> {
  const fallbackSources: ResearchSource[] = sources.length ? sources : [{
    title: "Fallback analysis used because live research is unavailable",
    url: "",
    snippet: "Evidence scoring used the founder intake and deterministic validation frameworks only.",
    sourceType: "fallback",
    supports: "Problem clarity, feasibility, and next-step planning",
    limitation: "No live competitor, demand, or market-size evidence was retrieved.",
    confidence: "low",
    provider: "offline",
    verified: false,
    relevanceScore: 0,
    qualityScore: 0.1,
  }];
  return Promise.resolve(calculateEvidenceScore(intake, fallbackSources, sources.length ? "hybrid" : "fallback"));
}

export function generateImprovedIdeas(intake: FounderIntake, evidence: EvidenceScore): IdeaRevision[] {
  const baseUser = intake.targetUser === "no idea yet" ? `${intake.status.toLowerCase()}s in ${intake.locationCity || intake.locationCountry}` : intake.targetUser;
  const problem = intake.problem === "no idea yet" ? "a repeated workflow problem they currently solve manually" : intake.problem;
  const baseIdea = (intake.rawIdea === "no idea yet" ? "A concierge service" : intake.rawIdea)
    .replace(/\s+for a narrow first group:.*$/i, "")
    .trim();
  return [
    {
      improvedIdea: `${baseIdea} for a narrow first group: ${baseUser}.`,
      targetUser: baseUser,
      problem,
      whyStronger: "It starts with a reachable segment and can be tested without building a complete platform.",
      whatChanged: "Narrowed the first user and reduced the first version to a validation experiment.",
      remainingRisk: evidence.weakestSignal,
    },
    {
      improvedIdea: `A manual-first pilot that helps ${baseUser.toLowerCase()} solve ${problem.toLowerCase()} before automating the workflow.`,
      targetUser: baseUser,
      problem,
      whyStronger: "A manual pilot reveals whether users value the outcome before technical investment.",
      whatChanged: "Replaced feature scope with a concierge test and measurable user evidence.",
      remainingRisk: "Users may like the idea but still refuse to change behavior or pay.",
    },
    {
      improvedIdea: `A focused evidence and planning tool for ${baseUser.toLowerCase()}, centered only on the highest-frequency part of the problem.`,
      targetUser: baseUser,
      problem,
      whyStronger: "The product promise is easier to explain, prototype, and compare with current alternatives.",
      whatChanged: "Removed broad platform claims and chose one urgent job to be done.",
      remainingRisk: "The selected sub-problem still needs five direct user conversations.",
    },
  ];
}
