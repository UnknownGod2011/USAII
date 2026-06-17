import { evaluateIntake, buildFallbackEvaluation } from "@/lib/evaluation";
import type { IntakeAnswers } from "@/lib/intake-questions";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const answers = { ...(body.answers || {}) } as IntakeAnswers;
  if (typeof body.ideaOverride === "string" && body.ideaOverride.trim()) {
    answers.rawIdea = body.ideaOverride.trim();
  }

  try {
    const evaluation = await evaluateIntake(answers);
    return NextResponse.json(evaluation);
  } catch (error) {
    const evaluation = buildFallbackEvaluation(answers);
    return NextResponse.json({
      ...evaluation,
      error: error instanceof Error ? error.message : "Evaluation fell back to local analysis",
    });
  }
}
