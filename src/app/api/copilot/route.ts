import { requireSessionUser } from "@/lib/auth";
import { answerCopilotQuestion } from "@/lib/copilot";
import { getDb } from "@/lib/db";
import { isIrrelevantFounderQuestion, redirectMessage } from "@/lib/guardrails";
import type { LaunchBrief } from "@/lib/types";
import { NextResponse } from "next/server";

function relevantReferences(question: string, brief: LaunchBrief) {
  const terms = question.toLowerCase().split(/\W+/).filter((term) => term.length > 3);
  return [...brief.sources]
    .filter((source) => source.url)
    .sort((left, right) => {
      const leftText = `${left.title} ${left.type} ${left.snippet || ""}`.toLowerCase();
      const rightText = `${right.title} ${right.type} ${right.snippet || ""}`.toLowerCase();
      const leftScore = terms.filter((term) => leftText.includes(term)).length + (left.verified ? 1 : 0);
      const rightScore = terms.filter((term) => rightText.includes(term)).length + (right.verified ? 1 : 0);
      return rightScore - leftScore;
    })
    .slice(0, 3)
    .map((source) => ({ id: source.id, label: source.title, url: source.url }));
}

export async function POST(request: Request) {
  try {
    const user = await requireSessionUser();
    const { question = "", startupIdeaId } = await request.json();
    if (isIrrelevantFounderQuestion(question)) return NextResponse.json({ answer: redirectMessage, references: [] });
    const idea = await getDb().startupIdea.findFirst({ where: { userId: user.id, status: { in: ["approved", "approved_building"] }, ...(startupIdeaId ? { id: startupIdeaId } : {}) }, orderBy: { updatedAt: "desc" }, include: { workspaceItems: { where: { stale: false } } } });
    const saved = idea?.workspaceItems.find((item) => item.type === "Launch Brief");
    if (!idea || !saved) return NextResponse.json({ answer: "Finish and approve an evidence-reviewed direction first.", references: [] }, { status: 409 });
    const brief = (JSON.parse(saved.contentJson) as { brief: LaunchBrief }).brief;
    const { answer, mode } = await answerCopilotQuestion(question, brief);
    await getDb().chatMessage.createMany({ data: [
      { userId: user.id, startupIdeaId: idea.id, role: "user", content: question, metadataJson: "{}" },
      { userId: user.id, startupIdeaId: idea.id, role: "assistant", content: answer, metadataJson: JSON.stringify({ contextual: true, mode }) },
    ] });
    return NextResponse.json({ answer, references: relevantReferences(question, brief) });
  } catch { return NextResponse.json({ error: "Sign in to use Copilot." }, { status: 401 }); }
}
