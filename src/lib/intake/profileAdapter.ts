import type { FounderIntake } from "./schema";
import type { FounderProfile } from "../types";

export function founderProfileFromIntake(intake: FounderIntake): FounderProfile {
  return {
    name: intake.name,
    location: [intake.locationCity, intake.locationCountry].filter(Boolean).join(", "),
    status: intake.status,
    hoursPerWeek: intake.hoursPerWeek,
    budget: intake.budget,
    skills: intake.skills,
    teamStatus: intake.teamStatus,
    ideaStage: ["MVP exists", "users exist", "revenue exists"].includes(intake.stage) ? "MVP already exists" : intake.stage as FounderProfile["ideaStage"],
    rawIdea: intake.rawIdea,
    targetUser: intake.targetUser,
    whyItMatters: intake.problem,
    currentAlternatives: intake.alternatives,
    evidence: [intake.evidenceLevel],
    traction: intake.evidenceLevel,
    willingnessToLearn: intake.openToModification ? "Open to modification" : "Prefers current direction",
    riskTolerance: "Not yet assessed",
    success30Days: intake.thirtyDayGoal,
  };
}

export function intakeFromRecord(record: {
  name: string; locationCountry: string; locationCity: string | null; status: string; hoursPerWeek: number; budget: string; skillsJson: string;
  teamStatus: string; stage: string; rawIdea: string; targetUser: string; problem: string; evidenceLevel: string; alternatives: string;
  thirtyDayGoal: string; openToModification: boolean; transcriptJson: string; skippedOrUnclearJson: string; discoveryJson?: string;
}): FounderIntake {
  const discovery = JSON.parse(record.discoveryJson || "{}") as Partial<FounderIntake>;
  return {
    name: record.name, locationCountry: record.locationCountry, locationCity: record.locationCity || undefined, status: record.status,
    hoursPerWeek: record.hoursPerWeek, budget: record.budget, skills: JSON.parse(record.skillsJson), teamStatus: record.teamStatus,
    stage: record.stage as FounderIntake["stage"], rawIdea: record.rawIdea, targetUser: record.targetUser, problem: record.problem,
    evidenceLevel: record.evidenceLevel, alternatives: record.alternatives, thirtyDayGoal: record.thirtyDayGoal,
    openToModification: record.openToModification, transcript: JSON.parse(record.transcriptJson), answerValidations: [],
    skippedOrUnclearFields: JSON.parse(record.skippedOrUnclearJson), accessibleCommunities: discovery.accessibleCommunities,
    noticedProblems: discovery.noticedProblems, reachableUsers: discovery.reachableUsers,
  };
}
