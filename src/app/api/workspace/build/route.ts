import { LAUNCHPILOT_AGENT_NAMES, createQueuedAgentOutputs, generateLaunchBrief } from "@/lib/agents";
import { generateSynthesizedLaunchBrief } from "@/lib/brief/synthesis";
import { requireSessionUser } from "@/lib/auth";
import { latestResearchRun, loadUserState, newId, nowIso, productionBlobStateEnabled, saveUserState } from "@/lib/blobState";
import { getDb } from "@/lib/db";
import { founderProfileFromIntake } from "@/lib/intake/profileAdapter";
import { EvidenceScoreSchema, FounderIntakeSchema } from "@/lib/intake/schema";
import type { AgentOutput, LaunchBrief, ResearchPack } from "@/lib/types";
import { workspaceRecordsFromBrief } from "@/lib/workspace";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

function parseAgentOutput(value: string): AgentOutput | null {
  try { return JSON.parse(value) as AgentOutput; } catch { return null; }
}

function orderedAgents(runs: { agentName: string; outputJson: string; status: string }[], fallback: AgentOutput[]) {
  return LAUNCHPILOT_AGENT_NAMES.map((name) => {
    const run = runs.find((item) => item.agentName === name);
    const parsed = run ? parseAgentOutput(run.outputJson) : null;
    return parsed ? { ...parsed, status: run?.status as AgentOutput["status"] } : fallback.find((item) => item.name === name)!;
  });
}

export async function POST(request: Request) {
  try {
    const user = await requireSessionUser();
    const { projectId } = await request.json();
    if (productionBlobStateEnabled()) {
      const state = await loadUserState(user);
      const idea = state.ideas
        .filter((item) => item.userId === user.id && (!projectId || item.id === projectId) && ["approved", "approved_building"].includes(item.status))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
      const run = idea ? latestResearchRun(state, idea.id) : null;
      if (!idea || !run) return NextResponse.json({ error: "Complete validation before building the workspace." }, { status: 404 });

      const evidence = EvidenceScoreSchema.parse(JSON.parse(run.scoreJson));
      const research = JSON.parse(run.packJson) as ResearchPack;
      const intake = FounderIntakeSchema.parse(JSON.parse(run.intakeJson));
      const profile = founderProfileFromIntake(intake);
      const deterministicBrief = generateLaunchBrief(profile, research, evidence);
      const now = nowIso();

      if (!state.agentRuns.some((agent) => agent.startupIdeaId === idea.id)) {
        state.agentRuns.push(...createQueuedAgentOutputs(deterministicBrief).map((agent) => ({
          id: newId("agent"),
          userId: user.id,
          startupIdeaId: idea.id,
          agentName: agent.name,
          status: "Queued",
          btsLinesJson: JSON.stringify(agent.liveSteps || []),
          outputJson: JSON.stringify(agent),
          sourcesJson: JSON.stringify([]),
          createdAt: now,
          updatedAt: now,
        })));
      }

      const latestRuns = state.agentRuns.filter((agent) => agent.startupIdeaId === idea.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const nextName = LAUNCHPILOT_AGENT_NAMES.find((name) => {
        const runRecord = latestRuns.find((item) => item.agentName === name);
        return !runRecord || runRecord.status.toLowerCase() !== "complete";
      });

      let completedAgent: AgentOutput | null = null;
      if (nextName) {
        completedAgent = deterministicBrief.agents.find((agent) => agent.name === nextName) || null;
        const existing = latestRuns.find((item) => item.agentName === nextName);
        if (completedAgent && existing) {
          existing.status = "Complete";
          existing.btsLinesJson = JSON.stringify(completedAgent.liveSteps || []);
          existing.outputJson = JSON.stringify(completedAgent);
          existing.sourcesJson = JSON.stringify(completedAgent.sources || []);
          existing.updatedAt = nowIso();
        }
      }

      const updatedRuns = state.agentRuns.filter((agent) => agent.startupIdeaId === idea.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const fallbackAgents = createQueuedAgentOutputs(deterministicBrief);
      const allComplete = LAUNCHPILOT_AGENT_NAMES.every((name) => updatedRuns.find((item) => item.agentName === name)?.status.toLowerCase() === "complete");
      const finalBrief = allComplete ? await generateSynthesizedLaunchBrief(profile, research, evidence) : deterministicBrief;
      const brief: LaunchBrief = { ...finalBrief, agents: orderedAgents(updatedRuns, fallbackAgents) };

      if (allComplete) {
        const records = workspaceRecordsFromBrief(brief, evidence);
        state.workspaceItems.forEach((item) => { if (item.startupIdeaId === idea.id) item.stale = true; });
        idea.name = brief.normalizedBrief.cleanStartupTitle;
        idea.finalizedIdea = brief.normalizedBrief.refinedIdea;
        idea.targetUser = brief.normalizedBrief.targetUserSegment;
        idea.problemStatement = brief.normalizedBrief.problemStatement;
        idea.status = "approved";
        idea.updatedAt = nowIso();
        state.workspaceItems.push(...records.map((record) => ({
          id: newId("workspace"),
          userId: user.id,
          startupIdeaId: idea.id,
          stale: false,
          createdAt: nowIso(),
          updatedAt: nowIso(),
          ...record,
        })));
      } else {
        const saved = state.workspaceItems.find((item) => item.startupIdeaId === idea.id && item.type === "Launch Brief" && !item.stale);
        if (saved) {
          saved.title = brief.normalizedBrief.cleanStartupTitle;
          saved.contentJson = JSON.stringify({ brief, evidence, normalizedBrief: brief.normalizedBrief });
          saved.updatedAt = nowIso();
        }
        idea.status = "approved_building";
        idea.updatedAt = nowIso();
      }

      await saveUserState(state);
      return NextResponse.json({ ok: true, complete: allComplete, completedAgent, brief, projectId: idea.id });
    }
    const idea = await getDb().startupIdea.findFirst({
      where: { userId: user.id, ...(projectId ? { id: projectId } : {}), status: { in: ["approved", "approved_building"] } },
      orderBy: { updatedAt: "desc" },
      include: {
        agentRuns: true,
        workspaceItems: { where: { stale: false } },
        researchRuns: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });
    if (!idea || !idea.researchRuns[0]) return NextResponse.json({ error: "Complete validation before building the workspace." }, { status: 404 });

    const run = idea.researchRuns[0];
    const evidence = EvidenceScoreSchema.parse(JSON.parse(run.scoreJson));
    const research = JSON.parse(run.packJson) as ResearchPack;
    const intake = FounderIntakeSchema.parse(JSON.parse(run.intakeJson));
    const profile = founderProfileFromIntake(intake);
    const deterministicBrief = generateLaunchBrief(profile, research, evidence);

    if (!idea.agentRuns.length) {
      await getDb().agentRun.createMany({
        data: createQueuedAgentOutputs(deterministicBrief).map((agent) => ({
          userId: user.id,
          startupIdeaId: idea.id,
          agentName: agent.name,
          status: "Queued",
          btsLinesJson: JSON.stringify(agent.liveSteps || []),
          outputJson: JSON.stringify(agent),
          sourcesJson: JSON.stringify([]),
        })),
      });
    }

    const latestRuns = await getDb().agentRun.findMany({ where: { startupIdeaId: idea.id }, orderBy: { createdAt: "asc" } });
    const nextName = LAUNCHPILOT_AGENT_NAMES.find((name) => {
      const runRecord = latestRuns.find((item) => item.agentName === name);
      return !runRecord || runRecord.status.toLowerCase() !== "complete";
    });

    let completedAgent: AgentOutput | null = null;
    if (nextName) {
      completedAgent = deterministicBrief.agents.find((agent) => agent.name === nextName) || null;
      if (completedAgent) {
        const existing = latestRuns.find((item) => item.agentName === nextName);
        if (existing) {
          await getDb().agentRun.update({
            where: { id: existing.id },
            data: {
              status: "Complete",
              btsLinesJson: JSON.stringify(completedAgent.liveSteps || []),
              outputJson: JSON.stringify(completedAgent),
              sourcesJson: JSON.stringify(completedAgent.sources || []),
            },
          });
        } else {
          await getDb().agentRun.create({
            data: {
              userId: user.id,
              startupIdeaId: idea.id,
              agentName: completedAgent.name,
              status: "Complete",
              btsLinesJson: JSON.stringify(completedAgent.liveSteps || []),
              outputJson: JSON.stringify(completedAgent),
              sourcesJson: JSON.stringify(completedAgent.sources || []),
            },
          });
        }
      }
    }

    const updatedRuns = await getDb().agentRun.findMany({ where: { startupIdeaId: idea.id }, orderBy: { createdAt: "asc" } });
    const fallbackAgents = createQueuedAgentOutputs(deterministicBrief);
    const allComplete = LAUNCHPILOT_AGENT_NAMES.every((name) => updatedRuns.find((item) => item.agentName === name)?.status.toLowerCase() === "complete");
    const finalBrief = allComplete ? await generateSynthesizedLaunchBrief(profile, research, evidence) : deterministicBrief;
    const brief: LaunchBrief = { ...finalBrief, agents: orderedAgents(updatedRuns, fallbackAgents) };

    if (allComplete) {
      const records = workspaceRecordsFromBrief(brief, evidence);
      await getDb().$transaction([
        getDb().workspaceItem.updateMany({ where: { startupIdeaId: idea.id }, data: { stale: true } }),
        getDb().startupIdea.update({
          where: { id: idea.id },
          data: {
            name: brief.normalizedBrief.cleanStartupTitle,
            finalizedIdea: brief.normalizedBrief.refinedIdea,
            targetUser: brief.normalizedBrief.targetUserSegment,
            problemStatement: brief.normalizedBrief.problemStatement,
            status: "approved",
          },
        }),
        ...records.map((record) => getDb().workspaceItem.create({ data: { userId: user.id, startupIdeaId: idea.id, ...record } })),
      ]);
    } else {
      await getDb().workspaceItem.updateMany({
        where: { startupIdeaId: idea.id, type: "Launch Brief", stale: false },
        data: { title: brief.normalizedBrief.cleanStartupTitle, contentJson: JSON.stringify({ brief, evidence, normalizedBrief: brief.normalizedBrief }) },
      });
      await getDb().startupIdea.update({ where: { id: idea.id }, data: { status: "approved_building" } });
    }

    return NextResponse.json({ ok: true, complete: allComplete, completedAgent, brief, projectId: idea.id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not build the workspace." }, { status: 400 });
  }
}
