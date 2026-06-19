import { describe, expect, it } from "vitest";
import { validateAnswerFallback } from "./intake/answerValidator";
import { extractMultipleFields } from "./intake/fieldExtractor";
import { CORE_QUESTIONS } from "./intake/questions";
import { FounderIntakeSchema, type FounderIntake } from "./intake/schema";
import { calculateEvidenceScore, canProceedToDashboard, verdictForScore } from "./research/scoring";
import { runResearchEvaluation } from "./research/researchAgent";
import { createSessionToken, readSessionToken } from "./session";
import { selectVoiceProvider, voiceStoragePolicy } from "./voice/voiceProvider";

const intake: FounderIntake = {
  name: "Tanush",
  locationCountry: "India",
  locationCity: "Mumbai",
  status: "student",
  hoursPerWeek: 10,
  budget: "Under ₹5,000",
  skills: ["coding", "design"],
  teamStatus: "solo",
  stage: "rough idea",
  rawIdea: "A study planning tool for first-year engineering students with repeated exam failures",
  targetUser: "First-year engineering students who fail internal exams",
  problem: "They waste revision time because they cannot identify which weak topic to study next",
  evidenceLevel: "No proof yet",
  alternatives: "YouTube videos, handwritten plans, and advice from seniors",
  thirtyDayGoal: "Interview 10 students and get 3 prototype testers",
  openToModification: true,
  transcript: [],
  answerValidations: [],
  skippedOrUnclearFields: [],
};

describe("Stage 1 intake", () => {
  it("contains exactly 15 core questions", () => expect(CORE_QUESTIONS).toHaveLength(15));
  it("validates a complete founder intake", () => expect(FounderIntakeSchema.safeParse(intake).success).toBe(true));
  it("rejects 0 as a name", () => expect(validateAnswerFallback(CORE_QUESTIONS[0], "0").isUsable).toBe(false));
  it("rejects everyone as target user", () => expect(validateAnswerFallback(CORE_QUESTIONS[9], "everyone").qualityScore).toBeLessThan(0.4));
  it("accepts honest no-proof evidence", () => expect(validateAnswerFallback(CORE_QUESTIONS[11], "no proof yet").isUsable).toBe(true));
  it("extracts future fields from one natural answer", () => {
    const fields = extractMultipleFields("I'm Tanush from Mumbai, India, a student, and I can work 10 hours per week with a 5k budget.");
    expect(fields.some((field) => field.field === "name" && field.value === "Tanush")).toBe(true);
    expect(fields.some((field) => field.field === "hoursPerWeek" && field.value === "10")).toBe(true);
    expect(fields.some((field) => field.field === "status" && field.value === "student")).toBe(true);
  });
});

describe("Evidence gate", () => {
  it("uses the exact verdict thresholds", () => {
    expect(verdictForScore(80)).toBe("strong");
    expect(verdictForScore(60)).toBe("promising_needs_modification");
    expect(verdictForScore(40)).toBe("weak");
    expect(verdictForScore(39)).toBe("reject");
  });
  it("calculates a bounded weighted score", () => {
    const result = calculateEvidenceScore(intake, [], "fallback");
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(Object.values(result.breakdown).reduce((sum, value) => sum + value, 0)).toBe(result.score);
  });
  it("labels fallback research explicitly", async () => {
    const result = await runResearchEvaluation(intake);
    expect(result.researchMode).toBe("fallback");
    expect(result.sources[0].sourceType).toBe("fallback");
  });
  it("blocks low scores and allows approved researched modifications at 60+", () => {
    expect(canProceedToDashboard(59, true)).toBe(false);
    expect(canProceedToDashboard(60, false)).toBe(false);
    expect(canProceedToDashboard(60, true)).toBe(true);
    expect(canProceedToDashboard(80, false)).toBe(true);
  });
});

describe("Session and voice fallbacks", () => {
  it("creates and verifies a signed demo session", () => {
    const token = createSessionToken("user-1");
    expect(readSessionToken(token)?.userId).toBe("user-1");
    expect(readSessionToken(`${token}tampered`)).toBeNull();
  });
  it("falls back from Gemini to Web Speech and then text", () => {
    expect(selectVoiceProvider({ geminiLiveAvailable: false, webSpeechAvailable: true })).toBe("web-speech");
    expect(selectVoiceProvider({ geminiLiveAvailable: false, webSpeechAvailable: false })).toBe("text-fallback");
  });
  it("never persists raw audio", () => expect(voiceStoragePolicy.rawAudioStored).toBe(false));
});
