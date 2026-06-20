import { requireSessionUser } from "@/lib/auth";
import { loadUserState, productionBlobStateEnabled } from "@/lib/blobState";
import { getDb } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const user = await requireSessionUser();
    if (productionBlobStateEnabled()) {
      const state = await loadUserState(user);
      const projects = state.ideas
        .filter((idea) => idea.userId === user.id)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map((idea) => ({
          id: idea.id,
          name: idea.name,
          status: idea.status,
          description: idea.finalizedIdea || idea.originalIdea,
          targetUser: idea.targetUser,
          updatedAt: idea.updatedAt,
          href: ["approved", "approved_building"].includes(idea.status)
            ? `/dashboard?projectId=${encodeURIComponent(idea.id)}`
            : `/validation?ideaId=${encodeURIComponent(idea.id)}`,
        }));
      return NextResponse.json({ projects });
    }
    const ideas = await getDb().startupIdea.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" } });
    return NextResponse.json({
      projects: ideas.map((idea) => ({
        id: idea.id,
        name: idea.name,
        status: idea.status,
        description: idea.finalizedIdea || idea.originalIdea,
        targetUser: idea.targetUser,
        updatedAt: idea.updatedAt.toISOString(),
        href: ["approved", "approved_building"].includes(idea.status)
          ? `/dashboard?projectId=${encodeURIComponent(idea.id)}`
          : `/validation?ideaId=${encodeURIComponent(idea.id)}`,
      })),
    });
  } catch {
    return NextResponse.json({ error: "Sign in to view projects." }, { status: 401 });
  }
}
