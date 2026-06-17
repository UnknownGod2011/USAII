import { isIrrelevantFounderQuestion } from "./guardrails";
import { type IntakeAnswers, type IntakeField } from "./intake-questions";
import { selectGeminiKey } from "./keyPool";

export type InterviewPhase = "interview" | "complete" | "researching" | "verdict";
export type InterviewMode = "gemini";

export type IntakeInterviewState = {
  validatedCount: number;
  answers: IntakeAnswers;
  phase: InterviewPhase;
  currentQuestion?: string | null;
  askedQuestions?: string[];
};

export type IntakeSubmitResult = {
  phase: InterviewPhase;
  validatedCount: number;
  totalQuestions: number;
  validation: {
    valid: boolean;
    feedback: string;
    mode: InterviewMode;
    relevance?: "relevant" | "unclear" | "off_topic";
  };
  assistantMessage: string;
  currentQuestion: string | null;
  questionNumber: number | null;
  answers: IntakeAnswers;
  askedQuestions: string[];
  isComplete: boolean;
  error?: string;
};

const TARGET_QUESTION_COUNT = 18;
const MODEL_CANDIDATES = [
  process.env.GEMINI_INTERVIEW_MODEL || "",
  "gemini-2.5-flash",
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
  "gemini-2.0-flash",
].filter(Boolean);

const intakeFields: IntakeField[] = [
  "name",
  "startupName",
  "location",
  "status",
  "hoursPerWeek",
  "budget",
  "skills",
  "teamStatus",
  "ideaStage",
  "rawIdea",
  "targetUser",
  "whyItMatters",
  "evidence",
  "competitorsKnown",
  "traction",
  "success30Days",
];

function textFromGemini(data: unknown) {
  const candidate = (data as { candidates?: { content?: { parts?: { text?: string }[] } }[] })?.candidates?.[0];
  return candidate?.content?.parts?.map((part) => part.text || "").join("\n").trim() || "";
}

function parseJsonObject(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Gemini did not return JSON.");
    return JSON.parse(match[0]);
  }
}

function cleanPatch(raw: unknown): IntakeAnswers {
  if (!raw || typeof raw !== "object") return {};
  const patch: IntakeAnswers = {};
  for (const field of intakeFields) {
    const value = (raw as Record<string, unknown>)[field];
    if (typeof value === "string" && value.trim()) {
      patch[field] = value.trim();
    } else if (Array.isArray(value)) {
      const joined = value.map((item) => String(item).trim()).filter(Boolean).join(", ");
      if (joined) patch[field] = joined;
    } else if (typeof value === "number") {
      patch[field] = String(value);
    }
  }
  return patch;
}

function fallbackCurrentQuestion(state: IntakeInterviewState) {
  return state.currentQuestion || state.askedQuestions?.at(-1) || null;
}

async function callGemini(prompt: string, turnIndex: number) {
  const key = selectGeminiKey(turnIndex);
  if (!key) {
    throw new Error("Gemini API key is not configured. Add GEMINI_API_KEY or GEMINI_API_KEYS, then retry.");
  }

  let lastError = "Gemini request failed.";
  for (const model of MODEL_CANDIDATES) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: model.startsWith("gemini-3") ? 1 : 0.35,
          maxOutputTokens: 900,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!response.ok) {
      lastError = `${model}: ${response.status} ${response.statusText}`;
      continue;
    }

    const data = await response.json();
    const text = textFromGemini(data);
    if (!text) {
      lastError = `${model}: empty response`;
      continue;
    }
    return parseJsonObject(text);
  }

  throw new Error(lastError);
}

function systemPromptBase() {
  return `You are LaunchPilot's adaptive founder interview engine.
Run a natural interview that gathers enough structured profile data for market research and founder-fit scoring.

Coverage goals:
- founder background, skills, location/status, weekly time, budget, team status
- startup stage, idea, target user, painful problem, evidence/traction, known competitors
- ambition, goals, and what a successful next validation sprint means

Behavior:
- Ask one concise question at a time.
- Adapt the next question to the founder's previous answers. Do not follow a fixed script.
- Aim for roughly 15-20 total accepted answers, but complete when the profile is actually sufficient.
- Do not mark complete until the idea, target user, pain, feasibility constraints, and founder context are clear enough for research.
- If the answer is unrelated, nonsense, or a system test, say "Sorry, I didn't quite get that" and re-ask the same question.
- Accept honest uncertainty when it answers the question, such as no budget, no evidence yet, or not sure.
- Never silently fall back to deterministic questions.

Return JSON only.`;
}

export async function getOpeningState(): Promise<IntakeSubmitResult> {
  const parsed = await callGemini(
    `${systemPromptBase()}

Start the interview. Return:
{
  "feedback": "short warm opening",
  "nextQuestion": "the first adaptive question",
  "profilePatch": {},
  "isComplete": false
}`,
    0,
  );

  const nextQuestion = String(parsed.nextQuestion || "").trim();
  if (!nextQuestion) throw new Error("Gemini did not provide an opening question.");

  return {
    phase: "interview",
    validatedCount: 0,
    totalQuestions: TARGET_QUESTION_COUNT,
    validation: { valid: true, feedback: String(parsed.feedback || "Let's begin."), mode: "gemini" },
    assistantMessage: `${String(parsed.feedback || "Let's begin.").trim()} ${nextQuestion}`.trim(),
    currentQuestion: nextQuestion,
    questionNumber: 1,
    answers: {},
    askedQuestions: [nextQuestion],
    isComplete: false,
  };
}

export async function submitIntakeAnswer(state: IntakeInterviewState, rawAnswer: string): Promise<IntakeSubmitResult> {
  const currentQuestion = fallbackCurrentQuestion(state);
  const askedQuestions = state.askedQuestions?.length ? state.askedQuestions : currentQuestion ? [currentQuestion] : [];

  if (!currentQuestion || state.phase !== "interview") {
    return {
      phase: state.phase,
      validatedCount: state.validatedCount,
      totalQuestions: TARGET_QUESTION_COUNT,
      validation: { valid: true, feedback: "Interview already complete.", mode: "gemini" },
      assistantMessage: "Thanks for answering — let me carry out some real market research now.",
      currentQuestion: null,
      questionNumber: null,
      answers: state.answers,
      askedQuestions,
      isComplete: true,
    };
  }

  const answer = rawAnswer.trim();
  if (isIrrelevantFounderQuestion(answer)) {
    const feedback = "Sorry, I didn't quite get that.";
    return {
      phase: "interview",
      validatedCount: state.validatedCount,
      totalQuestions: TARGET_QUESTION_COUNT,
      validation: { valid: false, feedback, mode: "gemini", relevance: "off_topic" },
      assistantMessage: `${feedback} ${currentQuestion}`,
      currentQuestion,
      questionNumber: state.validatedCount + 1,
      answers: state.answers,
      askedQuestions,
      isComplete: false,
    };
  }

  const parsed = await callGemini(
    `${systemPromptBase()}

Current structured profile:
${JSON.stringify(state.answers, null, 2)}

Questions already asked:
${askedQuestions.map((question, index) => `${index + 1}. ${question}`).join("\n")}

Current question:
${currentQuestion}

Founder answer:
${answer}

Return JSON only:
{
  "accepted": true,
  "relevance": "relevant",
  "feedback": "short warm acknowledgement, or Sorry, I didn't quite get that if invalid",
  "profilePatch": {
    "name": "only if learned",
    "startupName": "only if the founder gives a startup/project/company name",
    "location": "only if learned",
    "status": "only if learned",
    "hoursPerWeek": "only if learned",
    "budget": "only if learned",
    "skills": "only if learned",
    "teamStatus": "only if learned",
    "ideaStage": "only if learned",
    "rawIdea": "only if learned",
    "targetUser": "only if learned",
    "whyItMatters": "only if learned",
    "evidence": "only if learned",
    "competitorsKnown": "only if learned",
    "traction": "only if learned",
    "success30Days": "only if learned"
  },
  "nextQuestion": "ask the next adaptive question, or null if complete",
  "isComplete": false,
  "missingFields": ["important missing profile fields"]
}

If the answer is off-topic or nonsense:
- accepted must be false
- relevance must be "off_topic" or "unclear"
- profilePatch must be {}
- nextQuestion must repeat or gently sharpen the current question
- isComplete must be false`,
    state.validatedCount + askedQuestions.length,
  );

  const accepted = Boolean(parsed.accepted);
  const relevance = parsed.relevance === "off_topic" || parsed.relevance === "unclear" ? parsed.relevance : "relevant";
  const feedback = String(parsed.feedback || (accepted ? "Got it." : "Sorry, I didn't quite get that.")).trim();

  if (!accepted || relevance !== "relevant") {
    const reask = String(parsed.nextQuestion || currentQuestion).trim();
    return {
      phase: "interview",
      validatedCount: state.validatedCount,
      totalQuestions: TARGET_QUESTION_COUNT,
      validation: { valid: false, feedback, mode: "gemini", relevance },
      assistantMessage: `${feedback} ${reask}`.trim(),
      currentQuestion: reask,
      questionNumber: state.validatedCount + 1,
      answers: state.answers,
      askedQuestions,
      isComplete: false,
    };
  }

  const profilePatch = cleanPatch(parsed.profilePatch);
  const answers: IntakeAnswers = { ...state.answers, ...profilePatch };
  const nextCount = state.validatedCount + 1;
  const isComplete = Boolean(parsed.isComplete);

  if (isComplete) {
    return {
      phase: "complete",
      validatedCount: nextCount,
      totalQuestions: TARGET_QUESTION_COUNT,
      validation: { valid: true, feedback, mode: "gemini", relevance: "relevant" },
      assistantMessage: `${feedback} Thanks for answering — let me carry out some real market research now.`.trim(),
      currentQuestion: null,
      questionNumber: null,
      answers,
      askedQuestions,
      isComplete: true,
    };
  }

  const nextQuestion = String(parsed.nextQuestion || "").trim();
  if (!nextQuestion) throw new Error("Gemini did not provide the next interview question.");

  return {
    phase: "interview",
    validatedCount: nextCount,
    totalQuestions: TARGET_QUESTION_COUNT,
    validation: { valid: true, feedback, mode: "gemini", relevance: "relevant" },
    assistantMessage: `${feedback} ${nextQuestion}`.trim(),
    currentQuestion: nextQuestion,
    questionNumber: nextCount + 1,
    answers,
    askedQuestions: [...askedQuestions, nextQuestion],
    isComplete: false,
  };
}

// Backward-compatible exports used elsewhere.
export { intakeToFounderProfile as mergeToFounderProfile } from "./intake-questions";
