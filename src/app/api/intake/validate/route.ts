import { AnswerValidationSchema } from "@/lib/intake/schema";
import { validateAnswerFallback } from "@/lib/intake/answerValidator";
import { getProviderPoolStatus, providerErrorFromResponse, runWithProviderKey } from "@/lib/providers/keyPool";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json();
  const fallback = validateAnswerFallback(body.question, body.userAnswer || "");
  if (!getProviderPoolStatus("gemini").available) return NextResponse.json(fallback);

  const prompt = `Validate one founder interview answer. Return JSON only.
Question: ${JSON.stringify(body.question)}
Answer: ${JSON.stringify(body.userAnswer)}
Known context: ${JSON.stringify(body.context || {})}
Use the requested 0-1 thresholds. Honest "no proof yet" is valid for evidence. A no-idea state is valid for idea, target user, and problem. Do not accept nonsense or broad target users.
  Required keys: questionId, originalQuestion, userAnswer, expectedField, isUsable, qualityScore, extractedValue, issues, followUpQuestion, normalizedAnswer.`;
  try {
    const parsed = await runWithProviderKey("gemini", async (key) => {
      const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.1, maxOutputTokens: 500 },
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw providerErrorFromResponse("gemini", response);
      const text = data.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("") || "";
      return AnswerValidationSchema.safeParse({ ...JSON.parse(text), provider: "gemini" });
    });
    return NextResponse.json(parsed.success ? parsed.data : fallback);
  } catch {
    return NextResponse.json(fallback);
  }
}
