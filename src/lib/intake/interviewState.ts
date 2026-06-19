import type { QuestionField } from "./questions";
import type { AnswerValidation, FounderIntake } from "./schema";

export type InterviewMessage = {
  role: "assistant" | "user";
  content: string;
  status?: "validating" | "saved" | "clarify";
  timestamp: number;
};

export type InterviewState = {
  currentQuestionIndex: number;
  answers: Partial<Record<QuestionField, string>>;
  validations: AnswerValidation[];
  retryCount: Record<number, number>;
  skippedFields: QuestionField[];
  transcript: InterviewMessage[];
  extractedFieldsCache: Partial<Record<QuestionField, string>>;
  isComplete: boolean;
  mode: "chat" | "voice";
};

export function createInitialState(mode: "chat" | "voice"): InterviewState {
  return {
    currentQuestionIndex: 0,
    answers: {},
    validations: [],
    retryCount: {},
    skippedFields: [],
    transcript: [],
    extractedFieldsCache: {},
    isComplete: false,
    mode,
  };
}

export function convertToFounderIntake(state: InterviewState): FounderIntake {
  const location = (state.answers.location || "").split(",").map((part) => part.trim()).filter(Boolean);
  const hours = Number(state.answers.hoursPerWeek?.match(/\d+/)?.[0] || 0);
  const stageText = (state.answers.stage || "rough idea").toLowerCase();
  const stage = stageText.includes("no idea") ? "no idea yet"
    : stageText.includes("started") ? "started building"
      : stageText.includes("mvp") ? "MVP exists"
        : stageText.includes("revenue") ? "revenue exists"
          : stageText.includes("users") ? "users exist"
            : "rough idea";
  return {
    name: state.answers.name || "",
    locationCountry: location.at(-1) || "",
    locationCity: location.length > 1 ? location[0] : undefined,
    status: state.answers.status || "unclear / skipped",
    hoursPerWeek: hours,
    budget: state.answers.budget || "unclear / skipped",
    skills: (state.answers.skills || "").split(/,| and /).map((item) => item.trim()).filter(Boolean),
    teamStatus: state.answers.teamStatus || "unclear / skipped",
    stage,
    rawIdea: state.answers.rawIdea || "no idea yet",
    targetUser: state.answers.targetUser || "no idea yet",
    problem: state.answers.problem || "no idea yet",
    evidenceLevel: state.answers.evidenceLevel || "No proof yet",
    alternatives: state.answers.alternatives || "unclear / skipped",
    thirtyDayGoal: state.answers.thirtyDayGoal || "unclear / skipped",
    openToModification: /yes|open|true/i.test(state.answers.openToModification || ""),
    transcript: state.transcript.map((message) => `${message.role}: ${message.content}`),
    answerValidations: state.validations,
    skippedOrUnclearFields: state.skippedFields,
  };
}

export function getProgress(state: InterviewState) {
  return {
    current: Math.min(state.currentQuestionIndex + 1, 15),
    completed: state.currentQuestionIndex,
    total: 15,
    percentage: Math.round((state.currentQuestionIndex / 15) * 100),
  };
}

export function saveInterviewState(state: InterviewState) {
  if (typeof window !== "undefined") localStorage.setItem("launchpilot-interview-state", JSON.stringify(state));
}
