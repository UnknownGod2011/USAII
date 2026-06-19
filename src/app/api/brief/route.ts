import { requireSessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { parseWorkspaceItem } from "@/lib/workspace";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const user = await requireSessionUser();
    const item = await getDb().workspaceItem.findFirst({
      where: { userId: user.id, type: "Launch Brief", stale: false },
      orderBy: { updatedAt: "desc" },
      include: { startupIdea: { include: { workspaceItems: { where: { stale: false }, orderBy: { updatedAt: "desc" } } } } },
    });
    if (!item) return NextResponse.json({ error: "No approved Launch Brief." }, { status: 404 });
    const parsed = JSON.parse(item.contentJson);
    const workspace = item.startupIdea.workspaceItems.map(parseWorkspaceItem).filter(Boolean);
    return NextResponse.json({ ...parsed, brief: { ...parsed.brief, workspace } });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
