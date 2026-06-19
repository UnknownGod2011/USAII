import type { AnswerValidation, FounderIntake } from "./schema";
import type { QuestionField } from "./questions";

export type InterviewState = {
  currentQuestionIndex: number;
  answers: Partial<Record<QuestionField, string>>;
  validations: AnswerValidation[];
  retryCount: Record<number, number>;
  skippedFields: QuestionField[];
  confirmedFields: QuestionField[];
  transcript: Array<{ role: "assistant" | "user"; content: string; timestamp: number }>;
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
    confirmedFields: [],
    transcript: [
      {
        role: "assistant",
        content:
          "Hey! I'm LaunchPilot, your founder execution navigator. I'll ask you 15 focused questions to understand you, your idea, and your constraints. Then I'll run real research to validate if your idea is ready or needs refinement. Ready?",
        timestamp: Date.now(),
      },
    ],
    extractedFieldsCache: {},
    isComplete: false,
    mode,
  };
}

export function addMessage(
  state: InterviewState,
  role: "assistant" | "user",
  content: string
): InterviewState {
  return {
    ...state,
    transcript: [
      ...state.transcript,
      {
        role,
        content,
        timestamp: Date.now(),
      },
    ],
  };
}

export function setAnswer(
  state: InterviewState,
  field: QuestionField,
  value: string,
  validation: AnswerValidation
): InterviewState {
  return {
    ...state,
    answers: {
      ...state.answers,
      [field]: value,
    },
    validations: [...state.validations, validation],
    confirmedFields: [...state.confirmedFields, field],
  };
}

export function incrementRetry(state: InterviewState, questionIndex: number): InterviewState {
  return {
    ...state,
    retryCount: {
      ...state.retryCount,
      [questionIndex]: (state.retryCount[questionIndex] || 0) + 1,
    },
  };
}

export function skipField(state: InterviewState, field: QuestionField): InterviewState {
  return {
    ...state,
    skippedFields: [...state.skippedFields, field],
  };
}

export function cacheExtractedField(
  state: InterviewState,
  field: QuestionField,
  value: string
): InterviewState {
  return {
    ...state,
    extractedFieldsCache: {
      ...state.extractedFieldsCache,
      [field]: value,
    },
  };
}

export function markComplete(state: InterviewState): InterviewState {
  return {
    ...state,
    isComplete: true,
  };
}

export function getProgress(state: InterviewState): {
  current: number;
  total: number;
  percentage: number;
} {
  const total = 15;
  const current = state.confirmedFields.length;
  return {
    current,
    total,
    percentage: Math.round((current / total) * 100),
  };
}

export function convertToFounderIntake(state: InterviewState): Partial<FounderIntake> {
  const intake: {
    name?: string;
    locationCountry?: string;
    locationCity?: string;
    status?: string;
    hoursPerWeek?: number;
    budget?: string;
    skills?: string[];
    teamStatus?: string;
    stage?: "no idea yet" | "rough idea" | "started building" | "MVP exists" | "users exist" | "revenue exists";
    rawIdea?: string;
    targetUser?: string;
    problem?: string;
    evidenceLevel?: string;
    alternatives?: string;
    thirtyDayGoal?: string;
    openToModification?: boolean;
    transcript?: string[];
    answerValidations?: AnswerValidation[];
    skippedOrUnclearFields?: string[];
  } = {
    name: state.answers.name || "",
    locationCountry: "",
    locationCity: "",
    status: state.answers.status || "",
    hoursPerWeek: state.answers.hoursPerWeek ? parseInt(state.answers.hoursPerWeek, 10) : 0,
    budget: state.answers.budget || "unclear",
    skills: state.answers.skills ? state.answers.skills.split(",").map((s) => s.trim()) : [],
    teamStatus: state.answers.teamStatus || "solo",
    stage: (state.answers.stage as FounderIntake["stage"]) || "rough idea",
    rawIdea: state.answers.rawIdea || "",
    targetUser: state.answers.targetUser || "",
    problem: state.answers.problem || "",
    evidenceLevel: state.answers.evidenceLevel || "no formal validation",
    alternatives: state.answers.alternatives || "",
    thirtyDayGoal: state.answers.thirtyDayGoal || "",
    openToModification: state.answers.openToModification === "yes" || state.answers.openToModification === "true",
    transcript: state.transcript.map((t) => `${t.role}: ${t.content}`),
    answerValidations: state.validations,
    skippedOrUnclearFields: state.skippedFields,
  };

  // Parse location if provided
  if (state.answers.location) {
    const parts = state.answers.location.split(",").map((p) => p.trim());
    if (parts.length > 1) {
      intake.locationCity = parts[0];
      intake.locationCountry = parts[1];
    } else {
      intake.locationCountry = parts[0];
    }
  }

  return intake;
}

export function saveInterviewState(state: InterviewState): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("launchpilot-interview-state", JSON.stringify(state));
  }
}

export function loadInterviewState(): InterviewState | null {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("launchpilot-interview-state");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function clearInterviewState(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem("launchpilot-interview-state");
  }
}
