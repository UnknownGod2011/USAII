import { requireSessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { FounderIntakeSchema, type ResearchSource } from "@/lib/intake/schema";
import { founderProfileFromIntake } from "@/lib/intake/profileAdapter";
import { runLiveResearch } from "@/lib/research";
import { calculateEvidenceScore } from "@/lib/research/scoring";
import { generateImprovedIdeas } from "@/lib/research/researchAgent";
import type { ResearchPack } from "@/lib/types";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const user = await requireSessionUser();
    const body = await request.json();
    const intake = FounderIntakeSchema.parse(body.intake);
    const profile = founderProfileFromIntake(intake);
    let pack: ResearchPack;
    try {
      pack = await runLiveResearch(profile);
    } catch {
      pack = {
        mode: "fallback",
        fetchedAt: new Date().toISOString(),
        logs: ["Live research unavailable. Limited offline analysis prepared."],
        plan: [],
        sources: [{
          id: "offline-analysis",
          title: "Limited offline analysis",
          url: "",
          type: "fallback",
          label: "Fallback analysis",
          snippet: "Live research is unavailable right now, so LaunchPilot used a limited offline analysis. Validate these findings before making decisions.",
          provider: "offline",
          verified: false,
          relevanceScore: 0,
          qualityScore: 0.1,
          limitation: "No external source was retrieved during this run.",
        }],
        evidenceClaims: [],
        competitors: [],
        marketSignals: ["No live demand signal was retained."],
        opportunities: [],
        skillResources: [],
      };
    }
    const sources: ResearchSource[] = pack.sources.map((source) => ({
      id: source.id, title: source.title, url: source.url, snippet: source.snippet || "", sourceType: source.type as ResearchSource["sourceType"],
      supports: source.query || source.type, limitation: source.limitation || "Review this source before relying on it.",
      confidence: (source.qualityScore || 0) >= .78 ? "high" : (source.qualityScore || 0) >= .45 ? "medium" : "low",
      provider: source.provider || "offline", query: source.query, verified: Boolean(source.verified),
      relevanceScore: source.relevanceScore || 0, qualityScore: source.qualityScore || 0,
    }));
    const evidence = calculateEvidenceScore(intake, sources, pack.mode, pack.evidenceClaims);
    const idea = await getDb().startupIdea.findFirst({ where: { id: body.startupIdeaId, userId: user.id } });
    if (!idea) return NextResponse.json({ error: "Saved startup direction not found." }, { status: 404 });
    const researchRun = await getDb().researchRun.create({
      data: {
        userId: user.id, startupIdeaId: idea.id, status: "complete", evidenceScore: evidence.score, verdict: evidence.verdict,
        strongestSignal: evidence.strongestSignal, weakestSignal: evidence.weakestSignal, reasoning: evidence.reasoning,
        whatCouldBeWrong: evidence.whatCouldBeWrong, nextValidationStep: evidence.nextValidationStep,
        fallbackUsed: evidence.researchMode === "fallback", breakdownJson: JSON.stringify(evidence.breakdown),
        intakeJson: JSON.stringify(intake), researchPlanJson: JSON.stringify(pack.plan), evidenceClaimsJson: JSON.stringify(pack.evidenceClaims),
        logsJson: JSON.stringify(pack.logs), packJson: JSON.stringify(pack), scoreJson: JSON.stringify(evidence),
        sources: { create: sources.map((source) => ({
          title: source.title, url: source.url, snippet: source.snippet, sourceType: source.sourceType, supports: source.supports,
          limitation: source.limitation, confidence: source.confidence, provider: source.provider, query: source.query,
          verified: source.verified, relevanceScore: source.relevanceScore, qualityScore: source.qualityScore,
        })) },
      },
    });
    await getDb().startupIdea.update({ where: { id: idea.id }, data: { status: evidence.verdict === "strong" ? "researched" : "needs_revision" } });
    return NextResponse.json({ evidence, revisions: generateImprovedIdeas(intake, evidence), logs: pack.logs, researchRunId: researchRun.id });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error("Research pipeline failed", error instanceof Error ? error.name : "UnknownError");
    return NextResponse.json({ error: "Research could not be completed safely. Please retry the evidence pass." }, { status: 400 });
  }
}
