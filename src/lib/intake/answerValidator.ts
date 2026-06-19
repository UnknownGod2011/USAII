import type { Question } from "./questions";
import type { AnswerValidation } from "./schema";

const lowEffort = /^(?:[0-9]+|[.!?,_-]+|idk|dunno|random|aaa+|test|yes|no|maybe|nah|nope)$/i;

function result(
  question: Question,
  answer: string,
  score: number,
  extractedValue: unknown,
  issues: string[] = [],
  followUpQuestion?: string,
  normalizedAnswer = answer.trim(),
): AnswerValidation {
  return {
    questionId: question.id,
    originalQuestion: question.question,
    userAnswer: answer,
    expectedField: question.field,
    isUsable: score >= 0.65,
    qualityScore: score,
    extractedValue,
    issues,
    followUpQuestion,
    normalizedAnswer,
    provider: "deterministic-fallback",
  };
}

export function validateAnswerFallback(question: Question, userAnswer: string): AnswerValidation {
  const answer = userAnswer.trim();
  const lower = answer.toLowerCase();
  if (!answer || lowEffort.test(answer)) {
    return result(question, answer, 0.15, null, ["Answer is empty, accidental, or too low-effort"], `I might have missed that. ${question.conversationalVariant}`);
  }

  switch (question.field) {
    case "name": {
      const name = answer.replace(/^(?:i am|i'm|my name is|call me)\s+/i, "").split(/\s+from\s+/i)[0].trim();
      if (name.length < 2 || /\d/.test(name) || /^(?:what|why|how)\b/i.test(name)) {
        return result(question, answer, 0.2, null, ["No usable name found"], "I didn't catch a usable name. What should I call you during this founder plan?");
      }
      return result(question, answer, 0.92, name, [], undefined, name);
    }
    case "location": {
      if (/^(?:earth|world|online|somewhere|nowhere)$/i.test(answer) || answer.length < 3) {
        return result(question, answer, 0.25, null, ["Country is missing"], "Which country are you based in? You can add your city too.");
      }
      const parts = answer.replace(/^i(?:'m| am)?\s+(?:from|in|based in)\s+/i, "").split(",").map((part) => part.trim());
      return result(question, answer, parts.length > 1 ? 0.9 : 0.72, { country: parts.at(-1), city: parts.length > 1 ? parts[0] : undefined }, [], undefined, parts.join(", "));
    }
    case "hoursPerWeek": {
      const number = answer.match(/\d+/)?.[0];
      if (!number) {
        return result(question, answer, /not sure/i.test(answer) ? 0.5 : 0.25, null, ["No realistic hour estimate"], "That's okay. Choose a rough range: less than 3, 3-7, 7-15, or 15+ hours per week.");
      }
      const hours = Number(number);
      if (hours === 0 || hours > 100) return result(question, answer, 0.45, hours, ["Estimate needs confirmation"], "Give me the realistic focused time you can protect each week.");
      return result(question, answer, 0.9, hours, [], undefined, `${hours} hours per week`);
    }
    case "rawIdea": {
      if (/no idea|still exploring|do not have an idea|don't have an idea/i.test(lower)) return result(question, answer, 0.9, "no idea yet", [], undefined, "no idea yet");
      if (/^(?:app|ai|startup|website|make money|something with students)$/i.test(answer) || answer.length < 18) {
        return result(question, answer, 0.2, null, ["Idea is too vague"], "Give me one clear sentence: who is it for, and what problem would it solve?");
      }
      return result(question, answer, answer.length > 45 ? 0.9 : 0.7, answer);
    }
    case "targetUser": {
      if (/no idea|not defined/i.test(lower)) return result(question, answer, 0.82, "no idea yet", [], undefined, "no idea yet");
      if (/^(?:everyone|anyone|people|users|students|businesses|companies)$/i.test(answer)) {
        return result(question, answer, 0.25, null, ["Target user is too broad"], "That's too broad. Which specific type of user would feel this pain first?");
      }
      return result(question, answer, answer.length > 15 ? 0.86 : 0.68, answer);
    }
    case "problem": {
      if (/no idea|not defined/i.test(lower)) return result(question, answer, 0.82, "no idea yet", [], undefined, "no idea yet");
      if (answer.length < 14 || /^(?:hard|bad|annoying|nothing)$/i.test(answer)) {
        return result(question, answer, 0.28, null, ["Problem is not specific enough"], "What specific frustration, cost, delay, or risk does this remove?");
      }
      return result(question, answer, answer.length > 35 ? 0.9 : 0.7, answer);
    }
    case "evidenceLevel": {
      if (/no proof|none|only my own|belief/i.test(lower)) return result(question, answer, 0.88, "low evidence", [], undefined, "No proof yet");
      return result(question, answer, answer.length > 5 ? 0.86 : 0.5, answer, answer.length > 5 ? [] : ["Evidence is unclear"], "Choose the closest evidence level, including 'no proof yet'.");
    }
    case "openToModification": {
      if (/^(?:yes|yep|yeah|absolutely|open|sure)/i.test(lower)) return result(question, answer, 0.95, true, [], undefined, "yes");
      if (/^(?:no|not open|keep)/i.test(lower)) return result(question, answer, 0.9, false, [], undefined, "no");
      return result(question, answer, 0.35, null, ["Could not determine yes or no"], "Please choose clearly: yes, I am open, or no, keep the current idea.");
    }
    case "stage": {
      const stages = ["no idea yet", "rough idea", "started building", "mvp exists", "users exist", "revenue exists"];
      const stage = stages.find((item) => lower.includes(item.replace(" exists", "")));
      return stage ? result(question, answer, 0.9, stage, [], undefined, stage === "mvp exists" ? "MVP exists" : stage) : result(question, answer, 0.35, null, ["Stage is unclear"], "Choose the closest stage from the options.");
    }
    case "budget":
      if (/not sure/i.test(lower)) return result(question, answer, 0.75, "Not sure", [], undefined, "Not sure");
      return answer.length > 2 ? result(question, answer, 0.82, answer) : result(question, answer, 0.3, null, ["Budget is unclear"], "Choose the closest budget range.");
    case "thirtyDayGoal":
      if (!/\d/.test(answer)) return result(question, answer, 0.5, answer, ["Goal is not measurable"], "Add one number: how many interviews, signups, testers, or sales would count as progress?");
      return result(question, answer, 0.85, answer);
    default:
      if (answer.length < 3) return result(question, answer, 0.25, null, ["Answer is too short"], `Could you answer that in one clear sentence? ${question.conversationalVariant}`);
      return result(question, answer, answer.length > 12 ? 0.82 : 0.68, answer);
  }
}

export async function validateAnswer(question: Question, userAnswer: string, context: Record<string, unknown>) {
  if (typeof window !== "undefined") {
    try {
      const response = await fetch("/api/intake/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, userAnswer, context }),
      });
      if (response.ok) return (await response.json()) as AnswerValidation;
    } catch {
      // Network failure falls through to the deterministic validator.
    }
  }
  return validateAnswerFallback(question, userAnswer);
}

export function shouldContinueToNext(validation: AnswerValidation, retryCount: number, critical = false) {
  if (validation.qualityScore >= 0.65) return { continue: true, action: "accept" as const };
  if (retryCount >= 2 && !critical) return { continue: true, action: "skip" as const, message: "I will mark that as unclear for now and keep moving." };
  if (validation.qualityScore >= 0.4) return { continue: false, action: "followup" as const, message: validation.followUpQuestion };
  return { continue: false, action: "retry" as const, message: validation.followUpQuestion };
}
