import { requireSessionUser } from "@/lib/auth";
import { latestResearchRun, loadUserState, productionBlobStateEnabled } from "@/lib/blobState";
import { getDb } from "@/lib/db";
import { intakeFromRecord } from "@/lib/intake/profileAdapter";
import { EvidenceScoreSchema, FounderIntakeSchema } from "@/lib/intake/schema";
import { deleteProject, getProject } from "@/lib/projects/firestore";
import { generateImprovedIdeas } from "@/lib/research/researchAgent";
import { NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireSessionUser();
    const { id } = await context.params;
    if (productionBlobStateEnabled()) {
      const state = await loadUserState(user);
      const idea = state.ideas.find((item) => item.id === id && item.userId === user.id);
      const intakeRecord = idea ? state.intakes.find((item) => item.id === idea.intakeId && item.userId === user.id) : null;
      const run = idea ? latestResearchRun(state, idea.id) : null;
      const parsedIntake = run
        ? FounderIntakeSchema.safeParse(JSON.parse(run.intakeJson))
        : FounderIntakeSchema.safeParse(intakeRecord?.data);
      if (!idea || !parsedIntake.success) return NextResponse.json({ error: "Project intake not found." }, { status: 404 });
      const parsedEvidence = run ? EvidenceScoreSchema.safeParse(JSON.parse(run.scoreJson)) : null;
      const evidence = parsedEvidence?.success ? parsedEvidence.data : null;
      return NextResponse.json({
        intake: parsedIntake.data,
        evidence,
        revisions: evidence ? generateImprovedIdeas(parsedIntake.data, evidence) : [],
      });
    }
    const idea = await getDb().startupIdea.findFirst({
      where: { id, userId: user.id },
      include: { intake: true, researchRuns: { orderBy: { updatedAt: "desc" }, take: 1 } },
    });
    if (!idea) return NextResponse.json({ error: "Project intake not found." }, { status: 404 });
    const run = idea.researchRuns[0];
    const parsedIntake = run
      ? FounderIntakeSchema.safeParse(JSON.parse(run.intakeJson))
      : FounderIntakeSchema.safeParse(intakeFromRecord(idea.intake));
    if (!parsedIntake.success) return NextResponse.json({ error: "Project intake not found." }, { status: 404 });
    const parsedEvidence = run ? EvidenceScoreSchema.safeParse(JSON.parse(run.scoreJson)) : null;
    const evidence = parsedEvidence?.success ? parsedEvidence.data : null;
    return NextResponse.json({
      intake: parsedIntake.data,
      evidence,
      revisions: evidence ? generateImprovedIdeas(parsedIntake.data, evidence) : [],
    });
  } catch {
    return NextResponse.json({ error: "Sign in to open this project." }, { status: 401 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const project = await getProject(id);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    await deleteProject(id);

    return NextResponse.json({ ok: true, id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete project";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
