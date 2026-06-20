import { z } from "zod";
import { generateLaunchBrief } from "@/lib/agents";
import { getProviderKeys, providerErrorFromResponse, runWithProviderKey } from "@/lib/providers/keyPool";
import type { EvidenceScore } from "@/lib/intake/schema";
import type { FounderProfile, LaunchBrief, ResearchPack } from "@/lib/types";

const PolishedBriefSchema = z.object({
  executiveSummary: z.string().min(30).max(900),
  oneLineIdea: z.string().min(20).max(260),
  targetUser: z.string().min(10).max(280),
  problemStatement: z.string().min(20).max(420),
  validatedDirection: z.string().min(30).max(700),
  whyThisIsSharper: z.string().min(30).max(700),
  marketRealitySummary: z.string().min(30).max(900),
  nextBestAction: z.string().min(20).max(600),
  riskRegister: z.array(z.object({
    assumption: z.string().min(15).max(360),
    whyItMatters: z.string().min(15).max(360),
    riskLevel: z.enum(["Low", "Medium", "High"]),
    test: z.string().min(15).max(500),
    successSignal: z.string().min(15).max(400),
    stopOrPivotTrigger: z.string().min(15).max(400),
  })).min(1).max(4).optional(),
  mvpPlan: z.object({
    goal: z.string().min(20).max(420),
    manualPilot: z.string().min(20).max(700),
    mustHave: z.array(z.string().min(3).max(180)).min(2).max(6),
    doNotBuildYet: z.array(z.string().min(3).max(180)).min(2).max(8),
    successMetric: z.string().min(15).max(400),
  }).optional(),
  roadmapPlan: z.object({
    next24Hours: z.array(z.string().min(10).max(300)).min(1).max(4),
    sevenDaySprint: z.array(z.string().min(10).max(300)).min(1).max(5),
    thirtyDayPilot: z.array(z.string().min(10).max(300)).min(1).max(5),
    sixtyNinetyDays: z.array(z.string().min(10).max(300)).min(1).max(5),
    stopPivotCriteria: z.string().min(15).max(500),
  }).optional(),
  pitchAssets: z.object({
    oneLinePitch: z.string().min(20).max(260),
    thirtySecondPitch: z.string().min(40).max(900),
    landingHeadline: z.string().min(10).max(180),
    userInterviewMessage: z.string().min(40).max(800),
    slideOutline: z.array(z.string().min(3).max(120)).min(5).max(6),
  }),
});

type PolishedBrief = z.infer<typeof PolishedBriefSchema>;

const timeoutMs = 18_000;

function timeoutSignal() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return { signal: controller.signal, cancel: () => clearTimeout(timer) };
}

function extractJson(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced || text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error("No JSON object returned");
  return JSON.parse(candidate.slice(start, end + 1)) as unknown;
}

function contextForPrompt(base: LaunchBrief) {
  return {
    normalizedBrief: base.normalizedBrief,
    evidenceScore: base.evidenceScore && {
      score: base.evidenceScore.score,
      verdict: base.evidenceScore.verdict,
      reasoning: base.evidenceScore.reasoning,
      strongestSignal: base.evidenceScore.strongestSignal,
      weakestSignal: base.evidenceScore.weakestSignal,
      whatCouldBeWrong: base.evidenceScore.whatCouldBeWrong,
      nextValidationStep: base.evidenceScore.nextValidationStep,
    },
    sources: base.sources.slice(0, 12).map((source) => ({
      title: source.title,
      url: source.url,
      type: source.type,
      label: source.label,
      snippet: source.snippet?.slice(0, 280),
      verified: source.verified,
      limitation: source.limitation,
    })),
    evidenceClaims: base.research.evidenceClaims.slice(0, 12).map((claim) => ({
      claim: claim.claim,
      category: claim.category,
      confidence: claim.confidence,
      limitation: claim.limitation,
    })),
    marketSignals: base.research.marketSignals,
    marketReality: base.marketReality,
    riskRegister: base.riskRegister,
    mvpPlan: base.mvpPlan,
    roadmapPlan: base.roadmapPlan,
  };
}

function prompt(base: LaunchBrief) {
  return [
    "You are LaunchPilot's synthesis layer. Rewrite the saved founder research into polished founder-facing report language.",
    "Do not judge startup success. Do not invent sources, traction, revenue, market size, eligibility, testimonials, or competitors.",
    "Use only the provided facts. If direct competitors are not verified, say that clearly and treat adjacent tools/services as alternatives.",
    "Make every section decision-oriented: distinguish source-backed market context from direct demand evidence, identify the most important evidence gap, and give a concrete next action.",
    "The market reality summary must explain what the sources support, what they do not prove, and the narrow opportunity to test.",
    "Risks must be falsifiable. MVP scope must test one outcome. The roadmap must move from the next 24 hours to a 7-day validation sprint, a 30-day pilot, and only then a 60/90-day automation path.",
    "Include explicit do-not-build-yet boundaries when evidence is weak. Keep language concise, specific, and suitable for a student founder.",
    "Return only valid JSON matching this TypeScript shape:",
    "{ executiveSummary, oneLineIdea, targetUser, problemStatement, validatedDirection, whyThisIsSharper, marketRealitySummary, nextBestAction, riskRegister?, mvpPlan?, roadmapPlan?, pitchAssets: { oneLinePitch, thirtySecondPitch, landingHeadline, userInterviewMessage, slideOutline } }",
    "Context:",
    JSON.stringify(contextForPrompt(base)),
  ].join("\n\n");
}

async function callGemini(base: LaunchBrief): Promise<PolishedBrief> {
  return runWithProviderKey("gemini", async (key) => {
    const model = process.env.GEMINI_SYNTHESIS_MODEL || "gemini-3.5-flash";
    const { signal, cancel } = timeoutSignal();
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        signal,
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt(base) }] }],
          generationConfig: { temperature: 0.15, maxOutputTokens: 2800, responseMimeType: "application/json" },
        }),
      });
      if (!response.ok) throw providerErrorFromResponse("gemini", response);
      const data = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
      const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
      return PolishedBriefSchema.parse(extractJson(text));
    } finally {
      cancel();
    }
  });
}

async function callOpenAICompatible(base: LaunchBrief, apiKey: string, url: string, model: string) {
  const { signal, cancel } = timeoutSignal();
  try {
    const response = await fetch(url, {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "Return only valid JSON. Do not invent facts, sources, traction, revenue, market size, funding, or competitors." },
          { role: "user", content: prompt(base) },
        ],
      }),
    });
    if (!response.ok) throw new Error(`LLM request failed with ${response.status}`);
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    return PolishedBriefSchema.parse(extractJson(data.choices?.[0]?.message?.content || ""));
  } finally {
    cancel();
  }
}

async function tryPolish(base: LaunchBrief): Promise<PolishedBrief | null> {
  if (getProviderKeys("gemini").length) {
    try { return await callGemini(base); } catch { /* fall through */ }
  }
  const xaiKey = process.env.XAI_API_KEY?.trim() || process.env.GROK_API_KEY?.trim();
  if (xaiKey) {
    try { return await callOpenAICompatible(base, xaiKey, "https://api.x.ai/v1/chat/completions", process.env.GROK_MODEL || "grok-3-mini"); } catch { /* fall through */ }
  }
  const groqKey = process.env.GROQ_API_KEY?.trim();
  if (groqKey) {
    try { return await callOpenAICompatible(base, groqKey, "https://api.groq.com/openai/v1/chat/completions", process.env.GROQ_MODEL || "llama-3.3-70b-versatile"); } catch { /* fall through */ }
  }
  return null;
}

function mergePolish(base: LaunchBrief, polished: PolishedBrief | null): LaunchBrief {
  if (!polished) return base;
  const normalizedBrief = {
    ...base.normalizedBrief,
    oneLineIdea: polished.oneLineIdea,
    targetUserSegment: polished.targetUser,
    problemStatement: polished.problemStatement,
    refinedIdea: polished.validatedDirection,
    whyThisIsSharper: polished.whyThisIsSharper,
    marketRealitySummary: polished.marketRealitySummary,
    nextBestAction: polished.nextBestAction,
    firstValidationStep: polished.nextBestAction,
    cleanPitchContext: polished.pitchAssets.oneLinePitch,
  };
  return {
    ...base,
    normalizedBrief,
    executiveSummary: polished.executiveSummary,
    targetUser: polished.targetUser,
    problem: polished.problemStatement,
    refinedIdea: polished.validatedDirection,
    validatedDirection: polished.validatedDirection,
    whyThisIsSharper: polished.whyThisIsSharper,
    nextValidationTask: polished.nextBestAction,
    marketReality: { ...base.marketReality, summary: polished.marketRealitySummary },
    riskRegister: polished.riskRegister || base.riskRegister,
    risks: (polished.riskRegister || base.riskRegister).map((risk) => `${risk.riskLevel}: ${risk.assumption}. Test: ${risk.test}`),
    mvpPlan: polished.mvpPlan || base.mvpPlan,
    mvpScope: (polished.mvpPlan || base.mvpPlan).mustHave,
    roadmapPlan: polished.roadmapPlan || base.roadmapPlan,
    roadmap: [
      { horizon: "Next 24 hours", actions: (polished.roadmapPlan || base.roadmapPlan).next24Hours },
      { horizon: "7-day sprint", actions: (polished.roadmapPlan || base.roadmapPlan).sevenDaySprint },
      { horizon: "30-day pilot", actions: (polished.roadmapPlan || base.roadmapPlan).thirtyDayPilot },
      { horizon: "60/90-day direction", actions: (polished.roadmapPlan || base.roadmapPlan).sixtyNinetyDays },
    ],
    pitchAssets: {
      ...base.pitchAssets,
      oneLinePitch: polished.pitchAssets.oneLinePitch,
      elevatorPitch: polished.pitchAssets.thirtySecondPitch,
      landingHeadline: polished.pitchAssets.landingHeadline,
      interviewMessage: polished.pitchAssets.userInterviewMessage,
      deckOutline: polished.pitchAssets.slideOutline,
    },
  };
}

export async function generateSynthesizedLaunchBrief(profile: FounderProfile, research: ResearchPack, evidence?: EvidenceScore): Promise<LaunchBrief> {
  const base = generateLaunchBrief(profile, research, evidence);
  const polished = await tryPolish(base);
  return mergePolish(base, polished);
}
