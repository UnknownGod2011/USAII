import { describe, expect, it } from "vitest";
import { generateLaunchBrief } from "./agents";
import { retrieveWorkspaceContext } from "./copilot";
import type { EvidenceClaim, EvidenceScore, FounderIntake, ResearchSource } from "./intake/schema";
import { isMarketCompetitorUrl, sourceCanBePresentedAsVerified } from "./research";
import { calculateEvidenceScore } from "./research/scoring";
import { demoProfile } from "./seed";
import type { ResearchPack, Source } from "./types";
import { liveClientConfig } from "./voice/voiceProvider";
import { hasIdeaChanged, workspaceRecordsFromBrief } from "./workspace";

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

const source: ResearchSource = {
  id: "source-competitor",
  title: "Focused Study Planner",
  url: "https://example.com/study-planner",
  snippet: "A planning product for engineering students with weak-topic recommendations.",
  sourceType: "competitor",
  supports: "competitor",
  limitation: "Vendor page; adoption is not independently verified.",
  confidence: "high",
  provider: "exa",
  query: "study planning alternatives",
  verified: true,
  relevanceScore: 0.8,
  qualityScore: 0.82,
};

const claim: EvidenceClaim = {
  id: "claim-competitor",
  claim: "Focused Study Planner serves a similar first-year engineering student workflow.",
  category: "competitor",
  evidenceType: "competitor_primary",
  sourceIds: ["source-competitor"],
  support: "supports",
  confidence: "high",
  limitation: source.limitation,
  relevanceScore: 0.8,
  qualityScore: 0.82,
};

function evidence(sources: ResearchSource[] = [source], claims: EvidenceClaim[] = [claim]): EvidenceScore {
  return calculateEvidenceScore(intake, sources, "live", claims);
}

function researchPack(score: EvidenceScore): ResearchPack {
  const displaySource: Source = {
    id: "source-competitor",
    title: source.title,
    url: source.url,
    type: source.sourceType,
    label: "Verified",
    snippet: source.snippet,
    provider: "exa",
    verified: true,
    relevanceScore: source.relevanceScore,
    qualityScore: source.qualityScore,
    limitation: source.limitation,
  };
  return {
    mode: "live",
    fetchedAt: new Date().toISOString(),
    logs: ["Created research plan", "Opened source page", "Extracted evidence claim"],
    plan: [{
      id: "competitor",
      query: "study planning alternatives",
      category: "competitor",
      purpose: "Find direct products",
      preferredSources: ["company pages"],
    }],
    sources: [displaySource],
    evidenceClaims: [claim],
    competitors: [source.title],
    marketSignals: [],
    opportunities: [],
    skillResources: [],
    aiSummary: score.reasoning,
  };
}

describe("final evidence architecture", () => {
  it("caps unsupported ideas and does not reward answer length alone", () => {
    const result = calculateEvidenceScore(intake, [], "fallback", []);
    expect(result.score).toBeLessThanOrEqual(59);
    expect(result.scoreCapReason).toContain("capped at 59");
  });

  it("keeps an idea below strong without externally supported competitor evidence", () => {
    const direct = { ...intake, evidenceLevel: "15 paying users and repeat weekly usage" };
    const result = calculateEvidenceScore(direct, [], "fallback", []);
    expect(result.score).toBeLessThanOrEqual(79);
    expect(result.scoreCapReason).toContain("competitor");
  });

  it("does not penalize a specific target merely because it contains students", () => {
    const specific = calculateEvidenceScore(intake, [], "fallback", []);
    const generic = calculateEvidenceScore({ ...intake, targetUser: "students" }, [], "fallback", []);
    expect(specific.breakdown.targetUserSharpness).toBeGreaterThan(generic.breakdown.targetUserSharpness);
  });

  it("requires a fetched, relevant, high-quality page before calling a source verified", () => {
    expect(sourceCanBePresentedAsVerified(source)).toBe(true);
    expect(sourceCanBePresentedAsVerified({ ...source, verified: false })).toBe(false);
    expect(sourceCanBePresentedAsVerified({ ...source, relevanceScore: 0.05 })).toBe(false);
  });

  it("excludes source-code repositories from market competitor discovery", () => {
    expect(isMarketCompetitorUrl("https://github.com/example/study-planner")).toBe(false);
    expect(isMarketCompetitorUrl("https://example.com/study-planner")).toBe(true);
  });

  it("passes researched competitors and evidence into dynamic agents", () => {
    const scored = evidence();
    const brief = generateLaunchBrief({ ...demoProfile, currentAlternatives: "manual mentoring" }, researchPack(scored), scored);
    const market = brief.agents.find((agent) => agent.name === "Market Reality Agent");
    expect(brief.competitors).toContain(source.title);
    expect(market?.finding).toContain(source.title);
    expect(market?.evidenceClaimIds).toContain(claim.id);
    expect(market?.sources?.[0].url).toBe(source.url);
  });

  it("creates independently persistable workspace sections", () => {
    const scored = evidence();
    const brief = generateLaunchBrief(demoProfile, researchPack(scored), scored);
    const records = workspaceRecordsFromBrief(brief, scored);
    expect(records.length).toBeGreaterThanOrEqual(15);
    expect(records.some((record) => record.type === "Roadmap")).toBe(true);
    expect(records.some((record) => record.type === "Competitors / Alternatives")).toBe(true);
  });

  it("detects idea changes so prior workspace items can be marked stale", () => {
    const original = { rawIdea: "A broad app", targetUser: "students", problem: "planning" };
    expect(hasIdeaChanged(original, { ...original })).toBe(false);
    expect(hasIdeaChanged(original, { ...original, targetUser: "first-year engineering students" })).toBe(true);
  });

  it("retrieves relevant workspace context for Copilot", () => {
    const context = retrieveWorkspaceContext("What competitors did you find?", [{
      id: "competitors",
      type: "Competitors / Alternatives",
      title: "Alternatives",
      contentJson: JSON.stringify({ content: "Focused Study Planner" }),
      markdown: "",
      confidence: "high",
    }, {
      id: "roadmap",
      type: "Roadmap",
      title: "Next steps",
      contentJson: JSON.stringify({ content: "Interview five students" }),
      markdown: "",
      confidence: "high",
    }], []);
    expect(context.workspace[0].type).toBe("Competitors / Alternatives");
  });

  it("uses an ephemeral token client config without exposing a long-lived API key field", () => {
    const config = liveClientConfig("auth_tokens/short-lived");
    expect(config.ephemeralToken).toBe("auth_tokens/short-lived");
    expect(config.model).toBe("gemini-3.1-flash-live-preview");
    expect("apiKey" in config).toBe(false);
  });
});
