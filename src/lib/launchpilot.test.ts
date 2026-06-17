import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildFallbackEvaluation } from "./evaluation";
import { generateLaunchBrief, copilotReply, problemDiscoveryCards } from "./agents";
import { redirectMessage, isIrrelevantFounderQuestion } from "./guardrails";
import { intakeToFounderProfile } from "./intake-questions";
import { getOpeningState, submitIntakeAnswer } from "./interview";
import { selectGeminiKey, keyPoolStatus } from "./keyPool";
import { retrieveSources } from "./rag";
import { demoProfile, emptyProfile } from "./seed";

describe("LaunchPilot guardrails", () => {
  it("redirects irrelevant interview questions", () => {
    expect(isIrrelevantFounderQuestion("What is an amethyst?")).toBe(true);
    expect(copilotReply("Tell me a joke", generateLaunchBrief(demoProfile))).toBe(redirectMessage);
  });

  it("does not block relevant founder questions", () => {
    expect(isIrrelevantFounderQuestion("Should I apply to Startup India?")).toBe(false);
  });
});

describe("Stage 1 intake", () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = "test-key";
    vi.restoreAllMocks();
  });

  function mockGeminiResponse(payload: unknown) {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }],
      }),
    } as Response);
  }

  it("opens with an AI-generated first question", async () => {
    mockGeminiResponse({
      feedback: "Let's begin.",
      nextQuestion: "What should I call you?",
      profilePatch: {},
      isComplete: false,
    });
    const opening = await getOpeningState();
    expect(opening.questionNumber).toBe(1);
    expect(opening.totalQuestions).toBe(18);
    expect(opening.currentQuestion).toContain("call you");
    expect(opening.validation.mode).toBe("gemini");
  });

  it("accepts a real answer, merges profilePatch, and advances to the next AI question", async () => {
    mockGeminiResponse({
      accepted: true,
      relevance: "relevant",
      feedback: "Got it.",
      profilePatch: { name: "Khushi" },
      nextQuestion: "Where are you based?",
      isComplete: false,
      missingFields: ["location"],
    });
    const result = await submitIntakeAnswer(
      { validatedCount: 0, answers: {}, phase: "interview", currentQuestion: "What should I call you?", askedQuestions: ["What should I call you?"] },
      "Khushi",
    );
    expect(result.validation.valid).toBe(true);
    expect(result.validatedCount).toBe(1);
    expect(result.questionNumber).toBe(2);
    expect(result.answers.name).toBe("Khushi");
    expect(result.currentQuestion).toBe("Where are you based?");
  });

  it("does not advance when Gemini classifies an answer as off-topic", async () => {
    mockGeminiResponse({
      accepted: false,
      relevance: "off_topic",
      feedback: "Sorry, I didn't quite get that.",
      profilePatch: {},
      nextQuestion: "What should I call you?",
      isComplete: false,
      missingFields: ["name"],
    });
    const result = await submitIntakeAnswer(
      { validatedCount: 0, answers: {}, phase: "interview", currentQuestion: "What should I call you?", askedQuestions: ["What should I call you?"] },
      "Tell me a joke",
    );
    expect(result.validation.valid).toBe(false);
    expect(result.validatedCount).toBe(0);
    expect(result.questionNumber).toBe(1);
    expect(result.currentQuestion).toBe("What should I call you?");
  });

  it("maps intake answers into a founder profile", () => {
    const profile = intakeToFounderProfile({
      name: "Khushi",
      location: "Bengaluru, India",
      rawIdea: "AI study planner for engineering students",
      targetUser: "First-year engineering students",
      whyItMatters: "They struggle to plan revision across subjects",
    });
    expect(profile.name).toBe("Khushi");
    expect(profile.rawIdea).toContain("study planner");
  });

  it("produces an evaluation verdict without predicting success", () => {
    const evaluation = buildFallbackEvaluation({
      name: "Khushi",
      location: "Bengaluru, India",
      status: "Student",
      hoursPerWeek: "8",
      budget: "under ₹5,000",
      skills: "coding, research",
      teamStatus: "Solo",
      ideaStage: "rough idea",
      rawIdea: "AI study planner for engineering students",
      targetUser: "First-year engineering students",
      whyItMatters: "Revision planning is chaotic",
      evidence: "Talked to 3 classmates",
      competitorsKnown: "Notion templates, Google Calendar",
      traction: "Paper prototype",
      success30Days: "Interview 10 students",
    });
    expect(["continue", "modify", "reject"]).toContain(evaluation.verdict);
    expect(evaluation.summary).not.toMatch(/guarantee/i);
  });
});

describe("API key pool", () => {
  it("rotates keys deterministically", () => {
    expect(selectGeminiKey(0, ["a", "b"])).toBe("a");
    expect(selectGeminiKey(1, ["a", "b"])).toBe("b");
    expect(selectGeminiKey(2, ["a", "b"])).toBe("a");
  });

  it("reports AI unavailable when no key exists", () => {
    expect(keyPoolStatus([])).toEqual({ available: false, count: 0, mode: "ai-unavailable" });
  });
});

describe("RAG source registry", () => {
  it("returns sources for opportunity queries", () => {
    const sources = retrieveSources("Startup India DPIIT MAARG");
    expect(sources.length).toBeGreaterThan(0);
    expect(sources.some((source) => source.id === "startup-india")).toBe(true);
  });
});

describe("Agent engine", () => {
  it("returns structured JSON-ready launch brief", () => {
    const brief = generateLaunchBrief(demoProfile);
    expect(brief.agents.length).toBeGreaterThanOrEqual(5);
    expect(brief.workspace.some((item) => item.type === "Current Bottleneck")).toBe(true);
    expect(brief.sources.length).toBeGreaterThan(0);
  });

  it("creates one clear bottleneck", () => {
    const brief = generateLaunchBrief(demoProfile);
    expect(brief.currentBottleneck).toBe("Unvalidated demand from a specific target user");
  });

  it("keeps Founder Reality Check free of fake success and funding claims", () => {
    const brief = generateLaunchBrief(demoProfile);
    const text = JSON.stringify(brief);
    expect(text).not.toMatch(/\d{1,3}% likely to succeed/i);
    expect(text).not.toMatch(/YC would fund/i);
    expect(text).toMatch(/VC outreach is premature/i);
  });

  it("labels no-idea problem discovery as fallback or framework analysis", () => {
    const cards = problemDiscoveryCards(emptyProfile);
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.every((card) => ["Fallback analysis", "Framework-based", "Official source"].includes(card.label))).toBe(true);
  });

  it("chatbot uses saved context and challenges weak assumptions", () => {
    const brief = generateLaunchBrief(demoProfile);
    expect(copilotReply("What should I do next?", brief)).toContain(brief.nextValidationTask);
    expect(copilotReply("Would YC like this?", brief)).toContain("cannot predict");
    expect(copilotReply("Should I drop out?", brief)).toContain("Do not make a dropout decision");
  });

  it("workspace persists exportable items", () => {
    const brief = generateLaunchBrief(demoProfile);
    const required = [
      "Founder Snapshot",
      "Refined Idea",
      "Research Notes",
      "Competitors / Alternatives",
      "Assumptions",
      "Risks",
      "MVP Plan",
      "Current Bottleneck",
      "Founder Reality Check",
      "Roadmap",
      "Pitch Assets",
      "Opportunity Cards",
      "Saved Decisions",
      "Sources",
    ];
    expect(required.every((type) => brief.workspace.some((item) => item.type === type))).toBe(true);
  });
});
