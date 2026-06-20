import { createQueuedAgentOutputs, generateLaunchBrief } from "@/lib/agents";
import { requireSessionUser } from "@/lib/auth";
import { latestResearchRun, loadUserState, newId, nowIso, productionBlobStateEnabled, saveUserState } from "@/lib/blobState";
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
    if (productionBlobStateEnabled()) {
      const state = await loadUserState(user);
      const idea = state.ideas.find((item) => item.id === body.startupIdeaId && item.userId === user.id);
      const run = idea ? latestResearchRun(state, idea.id) : null;
      if (!idea || !run) return NextResponse.json({ error: "Complete validation before opening the dashboard." }, { status: 409 });
      const evidence = EvidenceScoreSchema.parse(JSON.parse(run.scoreJson));
      const research = JSON.parse(run.packJson) as ResearchPack;
      const intake = FounderIntakeSchema.parse(JSON.parse(run.intakeJson));
      const profile = founderProfileFromIntake(intake);
      const completeBrief = generateLaunchBrief(profile, research, evidence);
      const brief = { ...completeBrief, agents: createQueuedAgentOutputs(completeBrief) };
      const name = completeBrief.normalizedBrief.cleanStartupTitle || nameFor(intake.rawIdea);
      const records = workspaceRecordsFromBrief(brief, evidence);
      const now = nowIso();
      state.workspaceItems.forEach((item) => { if (item.startupIdeaId === idea.id) item.stale = true; });
      state.agentRuns = state.agentRuns.filter((item) => item.startupIdeaId !== idea.id);
      idea.name = name;
      idea.finalizedIdea = completeBrief.normalizedBrief.refinedIdea;
      idea.targetUser = completeBrief.normalizedBrief.targetUserSegment;
      idea.problemStatement = completeBrief.normalizedBrief.problemStatement;
      idea.status = "approved_building";
      idea.updatedAt = now;
      state.workspaceItems.push(...records.map((record) => ({
        id: newId("workspace"),
        userId: user.id,
        startupIdeaId: idea.id,
        stale: false,
        createdAt: now,
        updatedAt: now,
        ...record,
      })));
      state.agentRuns.push(...brief.agents.map((agent) => ({
        id: newId("agent"),
        userId: user.id,
        startupIdeaId: idea.id,
        agentName: agent.name,
        status: agent.status,
        btsLinesJson: JSON.stringify(agent.liveSteps || []),
        outputJson: JSON.stringify(agent),
        sourcesJson: JSON.stringify(agent.sources || []),
        createdAt: now,
        updatedAt: now,
      })));
      await saveUserState(state);
      return NextResponse.json({ ok: true, startupName: name, startupIdeaId: idea.id });
    }
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
