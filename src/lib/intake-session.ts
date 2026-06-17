import type { IntakeAnswers } from "./intake-questions";

export const INTAKE_SESSION_KEY = "launchpilot-intake-session";

export type IntakeSession = {
  validatedCount: number;
  answers: IntakeAnswers;
  phase: "interview" | "complete" | "researching" | "verdict";
  currentQuestion: string;
  askedQuestions?: string[];
  totalQuestions?: number;
};

export function saveIntakeSession(session: IntakeSession) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(INTAKE_SESSION_KEY, JSON.stringify(session));
}

export function loadIntakeSession(): IntakeSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(INTAKE_SESSION_KEY);
    return raw ? (JSON.parse(raw) as IntakeSession) : null;
  } catch {
    return null;
  }
}

export function clearIntakeSession() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(INTAKE_SESSION_KEY);
}
