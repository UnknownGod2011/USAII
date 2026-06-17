import { getOpeningState, submitIntakeAnswer, type IntakeInterviewState } from "@/lib/interview";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  try {
    if (body.init) {
      const opening = await getOpeningState();
      if (process.env.NODE_ENV !== "production") {
        console.log("[interview:init]", opening);
      }
      return NextResponse.json(opening);
    }

    const state: IntakeInterviewState = {
      validatedCount: typeof body.validatedCount === "number" ? body.validatedCount : 0,
      answers: body.answers || {},
      phase: body.phase || "interview",
      currentQuestion: typeof body.currentQuestion === "string" ? body.currentQuestion : null,
      askedQuestions: Array.isArray(body.askedQuestions) ? body.askedQuestions.map(String) : [],
    };

    const result = await submitIntakeAnswer(state, String(body.answer || ""));

    if (process.env.NODE_ENV !== "production") {
      console.log("[interview:submit]", {
        validatedCount: result.validatedCount,
        valid: result.validation.valid,
        mode: result.validation.mode,
        questionNumber: result.questionNumber,
        phase: result.phase,
        currentQuestion: result.currentQuestion,
        profilePatchKeys: Object.keys(result.answers || {}),
        assistantPreview: result.assistantMessage.slice(0, 100),
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gemini interview request failed.";
    if (process.env.NODE_ENV !== "production") {
      console.error("[interview:error]", message);
    }
    return NextResponse.json({
      phase: "interview",
      validatedCount: typeof body.validatedCount === "number" ? body.validatedCount : 0,
      totalQuestions: 18,
      validation: { valid: false, feedback: message, mode: "gemini" },
      assistantMessage: message,
      currentQuestion: typeof body.currentQuestion === "string" ? body.currentQuestion : null,
      questionNumber: null,
      answers: body.answers || {},
      askedQuestions: Array.isArray(body.askedQuestions) ? body.askedQuestions.map(String) : [],
      isComplete: false,
      error: message,
    });
  }
}
