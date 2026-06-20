import { requireSessionUser } from "@/lib/auth";
import { latestResearchRun, loadUserState, productionBlobStateEnabled } from "@/lib/blobState";
import { getDb } from "@/lib/db";
import { parseWorkspaceItem } from "@/lib/workspace";
import { NextResponse } from "next/server";
export async function GET(request: Request) {
  try {
    const user = await requireSessionUser();
    const requestedId = new URL(request.url).searchParams.get("projectId");
    if (productionBlobStateEnabled()) {
      const state = await loadUserState(user);
      const candidates = state.ideas.filter((idea) => idea.userId === user.id && ["approved", "approved_building"].includes(idea.status) && (!requestedId || idea.id === requestedId));
      const idea = candidates.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
      if (!idea) return NextResponse.json({ error: "No approved direction yet." }, { status: 404 });
      const items = state.workspaceItems.filter((item) => item.startupIdeaId === idea.id && !item.stale).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      const launchBrief = items.find((item) => item.type === "Launch Brief");
      if (!launchBrief) return NextResponse.json({ error: "Workspace is still being prepared." }, { status: 404 });
      const parsed = JSON.parse(launchBrief.contentJson);
      const workspace = items.map((item) => parseWorkspaceItem({ ...item, updatedAt: new Date(item.updatedAt) })).filter(Boolean);
      const agents = state.agentRuns.filter((run) => run.startupIdeaId === idea.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((run) => JSON.parse(run.outputJson));
      const researchRun = latestResearchRun(state, idea.id);
      return NextResponse.json({ idea, ...parsed, brief: { ...parsed.brief, workspace, agents }, agents, researchRun });
    }
    const idea = await getDb().startupIdea.findFirst({
      where: { userId: user.id, status: { in: ["approved", "approved_building"] }, ...(requestedId ? { id: requestedId } : {}) }, orderBy: { updatedAt: "desc" },
      include: { workspaceItems: { where: { stale: false }, orderBy: { updatedAt: "desc" } }, agentRuns: { orderBy: { updatedAt: "desc" } }, researchRuns: { orderBy: { updatedAt: "desc" }, take: 1, include: { sources: true } } },
    });
    if (!idea) return NextResponse.json({ error: "No approved direction yet." }, { status: 404 });
    const launchBrief = idea.workspaceItems.find((item) => item.type === "Launch Brief");
    if (!launchBrief) return NextResponse.json({ error: "Workspace is still being prepared." }, { status: 404 });
    const parsed = JSON.parse(launchBrief.contentJson);
    const workspace = idea.workspaceItems.map(parseWorkspaceItem).filter(Boolean);
    const agents = idea.agentRuns.map((run) => JSON.parse(run.outputJson));
    return NextResponse.json({ idea: { id: idea.id, name: idea.name, finalizedIdea: idea.finalizedIdea, targetUser: idea.targetUser, problemStatement: idea.problemStatement, status: idea.status }, ...parsed, brief: { ...parsed.brief, workspace, agents }, agents, researchRun: idea.researchRuns[0] || null });
  } catch { return NextResponse.json({ error: "Sign in to open your workspace." }, { status: 401 }); }
}
