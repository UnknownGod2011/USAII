import { copilotReply } from "./agents";
import { isIrrelevantFounderQuestion, redirectMessage } from "./guardrails";
import { getProviderKeys, providerErrorFromResponse, runWithProviderKey } from "./providers/keyPool";
import type { LaunchBrief } from "./types";

const timeoutMs = 10_000;
export type CopilotHistoryItem = { role: "user" | "assistant"; content: string };

function contextPacket(question: string, brief: LaunchBrief, history: CopilotHistoryItem[]) {
  return {
    question,
    conversationHistory: history.slice(-8),
    normalizedBrief: brief.normalizedBrief,
    evidence: brief.evidenceScore && {
      score: brief.evidenceScore.score,
      verdict: brief.evidenceScore.verdict,
      reasoning: brief.evidenceScore.reasoning,
      strongestSignal: brief.evidenceScore.strongestSignal,
      weakestSignal: brief.evidenceScore.weakestSignal,
      whatCouldBeWrong: brief.evidenceScore.whatCouldBeWrong,
    },
    risks: brief.riskRegister,
    mvp: brief.mvpPlan,
    roadmap: brief.roadmapPlan,
    marketReality: brief.marketReality,
    agents: brief.agents.map((agent) => ({ name: agent.name, finding: agent.finding, recommendation: agent.reasoning.recommendation })),
    sources: brief.sources.slice(0, 10).map((source) => ({ title: source.title, url: source.url, type: source.type, label: source.label, limitation: source.limitation })),
  };
}

function safeSystemPrompt() {
  return [
    "You are LaunchPilot Copilot. Answer only from the provided Launch Brief context.",
    "Be specific, founder-facing, and action-oriented.",
    "Use the recent conversation history for follow-up questions and do not repeat an answer unless the user asks.",
    "If the saved evidence is missing or weak, name the missing evidence instead of filling the gap with assumptions.",
    "Prefer a short recommendation followed by concrete steps, a success signal, and a caution when those are relevant.",
    "Do not invent traction, revenue, market size, eligibility, funding interest, or sources.",
    "For investor questions, recommend validation first if the project is pre-validation.",
    "For dropout or high-risk life decisions, be cautious and recommend keeping school/job as default while validating unless there is strong external evidence.",
    "For unrelated questions, redirect to the founder plan.",
  ].join(" ");
}

async function callGemini(question: string, brief: LaunchBrief, history: CopilotHistoryItem[]) {
  return runWithProviderKey("gemini", async (key) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const model = process.env.GEMINI_SYNTHESIS_MODEL || "gemini-3.5-flash";
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${safeSystemPrompt()}\n\nContext:\n${JSON.stringify(contextPacket(question, brief, history))}\n\nAnswer in 3-7 concise sentences.` }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 500 },
        }),
      });
      if (!response.ok) throw providerErrorFromResponse("gemini", response);
      const data = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
      return data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim() || "";
    } finally {
      clearTimeout(timer);
    }
  });
}

async function callOpenAICompatible(question: string, brief: LaunchBrief, history: CopilotHistoryItem[], apiKey: string, url: string, model: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          { role: "system", content: safeSystemPrompt() },
          { role: "user", content: `Context:\n${JSON.stringify(contextPacket(question, brief, history))}\n\nAnswer in 3-7 concise sentences.` },
        ],
      }),
    });
    if (!response.ok) throw new Error(`Copilot provider failed with ${response.status}`);
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content?.trim() || "";
  } finally {
    clearTimeout(timer);
  }
}

export async function answerCopilotQuestion(question: string, brief: LaunchBrief, history: CopilotHistoryItem[] = []) {
  if (isIrrelevantFounderQuestion(question)) return { answer: redirectMessage, mode: "guardrail" as const };

  if (getProviderKeys("gemini").length) {
    try {
      const answer = await callGemini(question, brief, history);
      if (answer) return { answer, mode: "gemini-context" as const };
    } catch { /* use fallback */ }
  }

  const xaiKey = process.env.XAI_API_KEY?.trim() || process.env.GROK_API_KEY?.trim();
  if (xaiKey) {
    try {
      const answer = await callOpenAICompatible(question, brief, history, xaiKey, "https://api.x.ai/v1/chat/completions", process.env.GROK_MODEL || "grok-3-mini");
      if (answer) return { answer, mode: "xai-context" as const };
    } catch { /* use fallback */ }
  }

  const groqKey = process.env.GROQ_API_KEY?.trim();
  if (groqKey) {
    try {
      const answer = await callOpenAICompatible(question, brief, history, groqKey, "https://api.groq.com/openai/v1/chat/completions", process.env.GROQ_MODEL || "llama-3.3-70b-versatile");
      if (answer) return { answer, mode: "groq-context" as const };
    } catch { /* use fallback */ }
  }

  return { answer: copilotReply(question, brief), mode: "contextual-fallback" as const };
}
