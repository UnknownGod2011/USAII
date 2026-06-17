import type { FounderProfile, IdeaStage } from "./types";

export type IntakeField =
  | "name"
  | "startupName"
  | "location"
  | "status"
  | "hoursPerWeek"
  | "budget"
  | "skills"
  | "teamStatus"
  | "ideaStage"
  | "rawIdea"
  | "targetUser"
  | "whyItMatters"
  | "evidence"
  | "competitorsKnown"
  | "traction"
  | "success30Days";

export type IntakeAnswers = Partial<Record<IntakeField, string>>;

export const RESEARCH_COMPLETE_MESSAGE =
  "Thank you for answering the questions. I'm going to carry out a thorough market and feasibility research pass now.";

export const RESEARCH_PROGRESS_STEPS = [
  "Evaluating your startup idea",
  "Understanding the target user",
  "Searching for competitors and alternatives",
  "Looking for demand signals",
  "Checking market size proxies",
  "Checking feasibility and execution risk",
  "Reviewing founder fit",
  "Producing an evidence-based verdict",
] as const;

export type EvaluationVerdict = "continue" | "modify" | "reject";

export function parseIdeaStage(value: string): IdeaStage {
  const text = value.toLowerCase();
  if (text.includes("no idea")) return "no idea yet";
  if (text.includes("mvp") || text.includes("users exist") || text.includes("revenue")) return "MVP already exists";
  if (text.includes("started building") || text.includes("building")) return "started building";
  return "rough idea";
}

export function intakeToFounderProfile(answers: IntakeAnswers): FounderProfile {
  const skills = (answers.skills || "")
    .split(/,|and|\n|\/|;/)
    .map((skill) => skill.trim())
    .filter(Boolean);

  const hours = Number.parseInt(String(answers.hoursPerWeek || "6"), 10);

  return {
    name: answers.name?.trim() || "Founder",
    startupName: answers.startupName?.trim() || "Untitled startup",
    location: answers.location?.trim() || "Undisclosed",
    status: answers.status?.trim() || "Student founder",
    hoursPerWeek: Number.isNaN(hours) ? 6 : hours,
    budget: answers.budget?.trim() || "Not sure",
    skills: skills.length ? skills : ["curiosity", "research"],
    teamStatus: answers.teamStatus?.trim() || "Solo",
    ideaStage: parseIdeaStage(answers.ideaStage || answers.rawIdea || ""),
    rawIdea: answers.rawIdea?.trim() || "Exploring problem spaces",
    targetUser: answers.targetUser?.trim() || "A specific user group to validate",
    whyItMatters: answers.whyItMatters?.trim() || answers.rawIdea?.trim() || "Problem still being clarified",
    evidence: [answers.evidence, answers.competitorsKnown ? `Known alternatives: ${answers.competitorsKnown}` : ""]
      .map((item) => item?.trim())
      .filter(Boolean) as string[],
    traction: answers.traction?.trim() || "Nothing built yet",
    willingnessToLearn: "High",
    riskTolerance: "Low to medium",
    success30Days: answers.success30Days?.trim() || "Talk to 8–10 target users",
  };
}
