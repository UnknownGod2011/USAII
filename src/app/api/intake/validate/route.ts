import { validateAnswer } from "@/lib/intake/answerValidator";
import { NextResponse } from "next/server";
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  if (!body.question) return NextResponse.json({ error: "Question is required." }, { status: 400 });
  return NextResponse.json(await validateAnswer(body.question, String(body.userAnswer || ""), body.context || {}));
}
