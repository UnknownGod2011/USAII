import { parseSyllabus, syllabusAssistantReply } from "@/lib/syllabus";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const text = typeof body.text === "string" ? body.text : "";
  const question = typeof body.question === "string" ? body.question : "";

  if (question && body.breakdown) {
    return NextResponse.json({
      answer: syllabusAssistantReply(question, body.breakdown),
    });
  }

  const breakdown = await parseSyllabus(text);
  return NextResponse.json({ breakdown });
}
