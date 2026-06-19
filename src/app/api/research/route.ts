import { requireSessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { FounderIntakeSchema, type ResearchSource } from "@/lib/intake/schema";
import { founderProfileFromIntake } from "@/lib/intake/profileAdapter";
import { runLiveResearch } from "@/lib/research";
import { calculateEvidenceScore } from "@/lib/research/scoring";
import { generateImprovedIdeas } from "@/lib/research/researchAgent";
import { safeJsonStringify, sanitizeExternalText } from "@/lib/safeText";
import { NextResponse } from "next/server";

function classifySources(pack: Awaited<ReturnType<typeof runLiveResearch>>): ResearchSource[] {
  return pack.sources.map((source) => ({
      id: source.id,
      title: sanitizeExternalText(source.title),
      url: source.url,
      snippet: sanitizeExternalText(source.snippet || "Retrieved public source"),
      sourceType: source.type as ResearchSource["sourceType"],
      supports: sanitizeExternalText(source.query || source.type),
      limitation: sanitizeExternalText(source.limitation || "This source may not represent the exact target segment or willingness to pay."),
      confidence: source.qualityScore && source.qualityScore >= 0.78 ? "high" : source.qualityScore && source.qualityScore >= 0.48 ? "medium" : "low",
      provider: source.provider || "offline",
      query: source.query,
      verified: source.verified || false,
      relevanceScore: source.relevanceScore || 0,
      qualityScore: source.qualityScore || 0,
    }));
}

export async function POST(request: Request) {
  try {
    const user = await requireSessionUser();
    const body = await request.json();
    const intake = FounderIntakeSchema.parse(body.intake);
    const pack = await runLiveResearch(founderProfileFromIntake(intake));
    const sources = classifySources(pack);
    if (!sources.length) sources.push({
      title: "Fallback analysis used because live research is unavailable",
      url: "",
      snippet: "No live source provider returned a usable result.",
      sourceType: "fallback",
      supports: "Founder feasibility and structured idea analysis",
      limitation: "No external market evidence was retrieved.",
      confidence: "low",
      provider: "offline",
      verified: false,
      relevanceScore: 0,
      qualityScore: 0.1,
    });
    const mode = sources.every((source) => source.sourceType === "fallback") ? "fallback" : pack.mode;
    const evidence = calculateEvidenceScore(intake, sources, mode, pack.evidenceClaims);
    const idea = body.startupIdeaId ? await getDb().startupIdea.findFirst({ where: { id: body.startupIdeaId, userId: user.id } }) : null;
    let researchRunId: string | undefined;
    if (idea) {
      const researchRun = await getDb().researchRun.create({
        data: {
          userId: user.id,
          startupIdeaId: idea.id,
          status: "complete",
          evidenceScore: evidence.score,
          verdict: evidence.verdict,
          strongestSignal: evidence.strongestSignal,
          weakestSignal: evidence.weakestSignal,
          reasoning: evidence.reasoning,
          whatCouldBeWrong: evidence.whatCouldBeWrong,
          nextValidationStep: evidence.nextValidationStep,
          fallbackUsed: evidence.researchMode === "fallback",
          breakdownJson: safeJsonStringify(evidence.breakdown),
          intakeJson: safeJsonStringify(intake),
          researchPlanJson: safeJsonStringify(pack.plan),
          evidenceClaimsJson: safeJsonStringify(pack.evidenceClaims),
          logsJson: safeJsonStringify(pack.logs),
          packJson: safeJsonStringify(pack),
          scoreJson: safeJsonStringify(evidence),
          sources: {
            create: sources.map((source) => ({
              title: sanitizeExternalText(source.title),
              url: source.url,
              snippet: sanitizeExternalText(source.snippet),
              sourceType: source.sourceType,
              supports: sanitizeExternalText(source.supports),
              limitation: sanitizeExternalText(source.limitation),
              confidence: source.confidence,
              provider: source.provider,
              query: source.query,
              verified: source.verified,
              relevanceScore: source.relevanceScore,
              qualityScore: source.qualityScore,
            })),
          },
        },
      });
      researchRunId = researchRun.id;
      await getDb().startupIdea.update({ where: { id: idea.id }, data: { status: evidence.verdict === "strong" ? "researched" : "needs_revision" } });
    }
    return NextResponse.json({ evidence, revisions: generateImprovedIdeas(intake, evidence), logs: pack.logs, researchRunId });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Research pipeline failed", error instanceof Error ? error.name : "UnknownError");
    }
    return NextResponse.json({ error: "Research could not be completed safely. Please retry the evidence pass." }, { status: 400 });
  }
}
