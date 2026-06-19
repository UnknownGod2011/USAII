import { createQueuedAgentOutputs, generateLaunchBrief } from "@/lib/agents";
import { requireSessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { founderProfileFromIntake } from "@/lib/intake/profileAdapter";
import { EvidenceScoreSchema, FounderIntakeSchema } from "@/lib/intake/schema";
import type { ResearchPack } from "@/lib/types";
import { workspaceRecordsFromBrief } from "@/lib/workspace";
import { NextResponse } from "next/server";

const nameFor = (idea: string) => idea.replace(/[^a-z0-9 ]/gi, " ").split(/\s+/).filter((word) => word.length > 3).slice(0, 2).map((word) => word[0].toUpperCase() + word.slice(1)).join(" ") || "New Venture";
export async function POST(request: Request) {
  try {
    const user = await requireSessionUser();
    const body = await request.json();
    if (!body.confirmed) return NextResponse.json({ error: "Confirm the selected direction before continuing." }, { status: 400 });
    const idea = await getDb().startupIdea.findFirst({ where: { id: body.startupIdeaId, userId: user.id }, include: { researchRuns: { orderBy: { createdAt: "desc" }, take: 1 } } });
    if (!idea || !idea.researchRuns[0]) return NextResponse.json({ error: "Complete validation before opening the dashboard." }, { status: 409 });
    const run = idea.researchRuns[0];
    const evidence = EvidenceScoreSchema.parse(JSON.parse(run.scoreJson));
    const research = JSON.parse(run.packJson) as ResearchPack;
    const intake = FounderIntakeSchema.parse(JSON.parse(run.intakeJson));
    const profile = founderProfileFromIntake(intake);
    const completeBrief = generateLaunchBrief(profile, research, evidence);
    const brief = { ...completeBrief, agents: createQueuedAgentOutputs(completeBrief) };
    const name = completeBrief.normalizedBrief.cleanStartupTitle || nameFor(intake.rawIdea);
    const records = workspaceRecordsFromBrief(brief, evidence);
    await getDb().$transaction([
      getDb().workspaceItem.updateMany({ where: { startupIdeaId: idea.id }, data: { stale: true } }),
      getDb().agentRun.deleteMany({ where: { startupIdeaId: idea.id } }),
      getDb().startupIdea.update({ where: { id: idea.id }, data: { name, finalizedIdea: completeBrief.normalizedBrief.refinedIdea, targetUser: completeBrief.normalizedBrief.targetUserSegment, problemStatement: completeBrief.normalizedBrief.problemStatement, status: "approved_building" } }),
      ...records.map((record) => getDb().workspaceItem.create({ data: { userId: user.id, startupIdeaId: idea.id, ...record } })),
      ...brief.agents.map((agent) => getDb().agentRun.create({ data: { userId: user.id, startupIdeaId: idea.id, agentName: agent.name, status: agent.status, btsLinesJson: JSON.stringify(agent.liveSteps || []), outputJson: JSON.stringify(agent), sourcesJson: JSON.stringify(agent.sources || []) } })),
    ]);
    return NextResponse.json({ ok: true, startupName: name, startupIdeaId: idea.id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Approval failed." }, { status: 400 });
  }
}
