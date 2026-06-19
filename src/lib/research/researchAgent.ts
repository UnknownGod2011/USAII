import type { EvidenceScore, FounderIntake, IdeaRevision, ResearchSource } from "../intake/schema";
import { calculateEvidenceScore } from "./scoring";

export type ResearchStep = { id: string; label: string; status: "pending" | "running" | "complete"; finding?: string };
export type ResearchProgress = { steps: ResearchStep[]; currentStep: number; isComplete: boolean };
export const RESEARCH_STEPS: ResearchStep[] = [
  { id: "evaluate", label: "Evaluating your startup idea", status: "pending" },
  { id: "user", label: "Understanding the target user", status: "pending" },
  { id: "competitors", label: "Searching for competitors and alternatives", status: "pending" },
  { id: "demand", label: "Looking for demand signals", status: "pending" },
  { id: "feasibility", label: "Checking feasibility and execution risk", status: "pending" },
  { id: "verdict", label: "Producing an evidence-based verdict", status: "pending" },
];
export function createInitialProgress(): ResearchProgress {
  return { steps: RESEARCH_STEPS.map((step) => ({ ...step })), currentStep: 0, isComplete: false };
}
export function runResearchEvaluation(intake: FounderIntake, sources: ResearchSource[] = []): Promise<EvidenceScore> {
  const retained = sources.length ? sources : [{
    title: "Limited offline analysis", url: "", snippet: "Live research is unavailable right now, so LaunchPilot used a limited offline analysis. Validate these findings before making decisions.",
    sourceType: "fallback" as const, supports: "Structured founder feasibility analysis", limitation: "No external market evidence was retrieved.",
    confidence: "low" as const, provider: "offline" as const, verified: false, relevanceScore: 0, qualityScore: .1,
  }];
  return Promise.resolve(calculateEvidenceScore(intake, retained, sources.length ? "hybrid" : "fallback"));
}
export function generateImprovedIdeas(intake: FounderIntake, evidence: EvidenceScore): IdeaRevision[] {
  const cleanClause = (value: string) => value.replace(/\s+/g, " ").replace(/[.\s]+$/, "").trim();
  const baseUser = cleanClause(intake.targetUser === "no idea yet" ? `${intake.status.toLowerCase()}s in ${intake.locationCity || intake.locationCountry}` : intake.targetUser);
  const problem = cleanClause(intake.problem === "no idea yet" ? "a repeated workflow problem they currently solve manually" : intake.problem);
  const baseIdea = (intake.rawIdea === "no idea yet" ? "A concierge problem-discovery service" : intake.rawIdea).replace(/\s+for a narrow first group:.*$/i, "").replace(/[.\s]+$/, "").trim();
  return [
    { improvedIdea: `${baseIdea} for a narrow first group: ${baseUser}.`, targetUser: baseUser, problem, whyStronger: "It starts with a reachable segment and can be tested without building a complete platform.", whatChanged: "Narrowed the first user and reduced the first version to a validation experiment.", remainingRisk: evidence.weakestSignal },
    { improvedIdea: `A manual-first pilot that helps ${baseUser.toLowerCase()} solve ${problem.toLowerCase()} before automating the workflow.`, targetUser: baseUser, problem, whyStronger: "A manual pilot reveals whether users value the outcome before technical investment.", whatChanged: "Replaced feature scope with a concierge test and measurable user evidence.", remainingRisk: "Users may like the idea but still refuse to change behavior or pay." },
    { improvedIdea: `A focused tool for ${baseUser.toLowerCase()}, centered only on the highest-frequency part of the problem.`, targetUser: baseUser, problem, whyStronger: "The promise is easier to explain, prototype, and compare with current alternatives.", whatChanged: "Removed broad platform claims and chose one urgent job to be done.", remainingRisk: "The selected sub-problem still needs five direct user conversations." },
  ];
}
export function generateImprovedIdea(intake: FounderIntake, weakness: string) {
  return generateImprovedIdeas(intake, { weakestSignal: weakness } as EvidenceScore)[0];
}
