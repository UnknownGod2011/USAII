import { requireSessionUser } from "@/lib/auth";
import { normalizeFounderBrief } from "@/lib/brief/normalize";
import { getDb } from "@/lib/db";
import { founderProfileFromIntake, intakeFromRecord } from "@/lib/intake/profileAdapter";
import { EvidenceScoreSchema, FounderIntakeSchema } from "@/lib/intake/schema";
import type { LaunchBrief, ResearchPack } from "@/lib/types";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const user = await requireSessionUser();
    const [intakeRecord, idea] = await Promise.all([
      getDb().founderIntake.findFirst({ where: { userId: user.id }, orderBy: { updatedAt: "desc" } }),
      getDb().startupIdea.findFirst({
        where: { userId: user.id },
        orderBy: { updatedAt: "desc" },
        include: {
          researchRuns: { orderBy: { createdAt: "desc" }, take: 1 },
          workspaceItems: { where: { stale: false } },
        },
      }),
    ]);

    if (!intakeRecord) {
      return NextResponse.json({
        user,
        hasProfile: false,
        message: "Complete the founder interview to create your profile snapshot.",
      });
    }

    const latestRun = idea?.researchRuns[0] || null;
    const intake = intakeFromRecord(intakeRecord);
    const parsedRunIntake = latestRun ? FounderIntakeSchema.safeParse(JSON.parse(latestRun.intakeJson)) : null;
    const analysisIntake = parsedRunIntake?.success ? parsedRunIntake.data : intake;
    const profile = founderProfileFromIntake(analysisIntake);
    const parsedEvidence = latestRun ? EvidenceScoreSchema.safeParse(JSON.parse(latestRun.scoreJson)) : null;
    const evidence = parsedEvidence?.success ? parsedEvidence.data : undefined;
    const research = latestRun ? JSON.parse(latestRun.packJson) as ResearchPack : undefined;
    const savedBriefItem = idea?.workspaceItems.find((item) => item.type === "Launch Brief");
    const savedBrief = savedBriefItem ? (JSON.parse(savedBriefItem.contentJson) as { brief?: LaunchBrief }).brief : undefined;
    const normalizedBrief = savedBrief?.normalizedBrief || normalizeFounderBrief(profile, evidence, research);
    const currentBottleneck = evidence?.scoreCapReason?.includes("direct user") ? "Demand evidence" : latestRun?.weakestSignal;

    return NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email },
      hasProfile: true,
      founder: {
        name: intake.name,
        location: [intake.locationCity, intake.locationCountry].filter(Boolean).join(", "),
        status: intake.status,
        hoursPerWeek: intake.hoursPerWeek,
        budget: intake.budget,
        skills: intake.skills,
        teamStatus: intake.teamStatus,
        stage: intake.stage,
        evidenceLevel: intake.evidenceLevel,
        alternatives: intake.alternatives,
        thirtyDayGoal: intake.thirtyDayGoal,
        openToModification: intake.openToModification,
      },
      idea: idea && {
        id: idea.id,
        name: idea.name,
        status: idea.status,
        rawIdea: intake.rawIdea,
        finalizedIdea: idea.finalizedIdea || normalizedBrief.refinedIdea,
        targetUser: idea.targetUser || normalizedBrief.targetUserSegment,
        problemStatement: idea.problemStatement || normalizedBrief.problemStatement,
        workspaceHref: `/dashboard?projectId=${encodeURIComponent(idea.id)}`,
        validationHref: `/validation?ideaId=${encodeURIComponent(idea.id)}`,
      },
      validation: latestRun && {
        status: latestRun.status,
        evidenceScore: latestRun.evidenceScore,
        verdict: latestRun.verdict,
        strongestSignal: latestRun.strongestSignal,
        weakestSignal: latestRun.weakestSignal,
        currentBottleneck,
        nextValidationStep: latestRun.nextValidationStep,
        updatedAt: latestRun.updatedAt.toISOString(),
      },
      normalizedBrief,
      workspaceReady: Boolean(savedBriefItem && idea?.status === "approved"),
    });
  } catch {
    return NextResponse.json({ error: "Sign in to view your founder profile." }, { status: 401 });
  }
}
