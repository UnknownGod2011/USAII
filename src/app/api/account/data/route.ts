import { requireSessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const user = await requireSessionUser();
    const data = await getDb().user.findUnique({
      where: { id: user.id },
      include: {
        intakes: { include: { answerValidations: true } },
        ideas: { include: { researchRuns: { include: { sources: true } }, workspaceItems: true, agentRuns: true, chatMessages: true } },
      },
    });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function DELETE() {
  try {
    const user = await requireSessionUser();
    await getDb().founderIntake.deleteMany({ where: { userId: user.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
