import { generateLaunchBrief } from "@/lib/agents";
import { requireSessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { founderProfileFromIntake, intakeFromRecord } from "@/lib/intake/profileAdapter";
import { EvidenceScoreSchema } from "@/lib/intake/schema";
import { canProceedToDashboard } from "@/lib/research/scoring";
import type { ResearchPack } from "@/lib/types";
import { hasIdeaChanged, workspaceRecordsFromBrief } from "@/lib/workspace";
import { NextResponse } from "next/server";

function startupName(idea: string) {
  const words = idea.replace(/[^a-z0-9 ]/gi, " ").split(/\s+/).filter((word) => word.length > 3).slice(0, 2);
  return words.length ? words.map((word) => word[0].toUpperCase() + word.slice(1)).join(" ") : "New Venture";
}

export async function POST(request: Request) {
  try {
    const user = await requireSessionUser();
    const body = await request.json();
    const idea = await getDb().startupIdea.findFirst({
      where: { id: body.startupIdeaId, userId: user.id },
      include: {
        intake: true,
        researchRuns: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });
    if (!idea) return NextResponse.json({ error: "Idea not found" }, { status: 404 });
    const researchRun = idea.researchRuns[0];
    if (!researchRun) return NextResponse.json({ error: "Complete a research run before approval." }, { status: 409 });
    const evidence = EvidenceScoreSchema.parse(JSON.parse(researchRun.scoreJson));
    const research = JSON.parse(researchRun.packJson) as ResearchPack;
    const researchedIntake = JSON.parse(researchRun.intakeJson);
    const modified = hasIdeaChanged(
      { rawIdea: idea.originalIdea, targetUser: idea.intake.targetUser, problem: idea.intake.problem },
      researchedIntake,
    );
    if (!canProceedToDashboard(evidence.score, modified)) return NextResponse.json({ error: "This direction has not passed the approval gate." }, { status: 409 });

    const baseIntake = intakeFromRecord(idea.intake);
    const finalIntake = { ...baseIntake, ...researchedIntake };
    const profile = founderProfileFromIntake(finalIntake);
    const brief = generateLaunchBrief(profile, research, evidence);
    const name = startupName(finalIntake.rawIdea);
    const workspaceRecords = workspaceRecordsFromBrief(brief, evidence);

    await getDb().$transaction([
      getDb().workspaceItem.updateMany({ where: { startupIdeaId: idea.id }, data: { stale: true } }),
      getDb().agentRun.deleteMany({ where: { startupIdeaId: idea.id } }),
      getDb().startupIdea.update({
        where: { id: idea.id },
        data: {
          name,
          finalizedIdea: finalIntake.rawIdea,
          targetUser: finalIntake.targetUser,
          problemStatement: finalIntake.problem,
          status: "approved",
        },
      }),
      ...workspaceRecords.map((record) => getDb().workspaceItem.create({
        data: {
          userId: user.id,
          startupIdeaId: idea.id,
          ...record,
        },
      })),
      ...brief.agents.map((agent) => getDb().agentRun.create({
        data: {
          userId: user.id,
          startupIdeaId: idea.id,
          agentName: agent.name,
          status: agent.status,
          btsLinesJson: JSON.stringify(agent.liveSteps || []),
          outputJson: JSON.stringify(agent),
          sourcesJson: JSON.stringify(agent.sources || []),
        },
      })),
    ]);
    return NextResponse.json({ ok: true, startupName: name });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Approval failed" }, { status: 400 });
  }
}
