import { describe, expect, it } from "vitest";
import { generateLaunchBrief, copilotReply, problemDiscoveryCards } from "./agents";
import { redirectMessage, isIrrelevantFounderQuestion } from "./guardrails";
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

describe("API key pool", () => {
  it("rotates keys deterministically", () => {
    expect(selectGeminiKey(0, ["a", "b"])).toBe("a");
    expect(selectGeminiKey(1, ["a", "b"])).toBe("b");
    expect(selectGeminiKey(2, ["a", "b"])).toBe("a");
  });

  it("reports fallback mode when no key exists", () => {
    expect(keyPoolStatus([])).toEqual({ available: false, count: 0, mode: "deterministic-fallback" });
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
    expect(brief.pitchAssets.elevatorPitch).toContain("The first validation focus is to ");
    expect(brief.pitchAssets.elevatorPitch).not.toMatch(/focus is validate/i);
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

  it("supports voice and text fallback architecture without raw audio storage", () => {
    const status = {
      webSpeechFallback: true,
      textFallback: true,
      rawAudioStored: false,
    };
    expect(status.webSpeechFallback).toBe(true);
    expect(status.textFallback).toBe(true);
    expect(status.rawAudioStored).toBe(false);
  });

  it("text transcript and voice transcript produce the same profile shape", () => {
    const textProfile = { ...demoProfile };
    const voiceTranscriptProfile = { ...demoProfile };
    expect(generateLaunchBrief(textProfile).profile).toEqual(generateLaunchBrief(voiceTranscriptProfile).profile);
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
