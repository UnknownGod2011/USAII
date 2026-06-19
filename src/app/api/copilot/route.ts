import { requireSessionUser } from "@/lib/auth";
import { answerWithWorkspace } from "@/lib/copilot";
import { getDb } from "@/lib/db";
import { isIrrelevantFounderQuestion, redirectMessage } from "@/lib/guardrails";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const user = await requireSessionUser();
    const { question = "" } = await request.json();
    if (isIrrelevantFounderQuestion(question)) return NextResponse.json({ answer: redirectMessage });
    const idea = await getDb().startupIdea.findFirst({
      where: { userId: user.id, status: "approved" },
      orderBy: { updatedAt: "desc" },
      include: {
        workspaceItems: { where: { stale: false }, orderBy: { updatedAt: "desc" } },
        researchRuns: { orderBy: { createdAt: "desc" }, take: 1, include: { sources: true } },
        chatMessages: true,
      },
    });
    if (!idea || !idea.workspaceItems.length) return NextResponse.json({ answer: "Finish and approve an evidence-reviewed direction first." }, { status: 409 });
    const result = await answerWithWorkspace(question, idea.workspaceItems, idea.researchRuns[0]?.sources || []);
    await getDb().chatMessage.createMany({
      data: [
        { userId: user.id, startupIdeaId: idea.id, role: "user", content: question, metadataJson: "{}" },
        { userId: user.id, startupIdeaId: idea.id, role: "assistant", content: result.answer, metadataJson: JSON.stringify({ contextual: true, references: result.references }) },
      ],
    });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
