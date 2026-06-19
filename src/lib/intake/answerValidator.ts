import type { Question } from "./questions";
import type { AnswerValidation } from "./schema";

/**
 * AI-powered answer quality validator
 * This validates whether user answers are meaningful, usable, and not garbage
 */

export async function validateAnswer(
  question: Question,
  userAnswer: string,
  _context: Record<string, string>
): Promise<AnswerValidation> {
  void _context;
  // Normalize answer
  const normalized = userAnswer.trim().toLowerCase();

  // Initialize validation result
  const validation: AnswerValidation = {
    questionId: question.id,
    originalQuestion: question.question,
    userAnswer,
    expectedField: question.field,
    isUsable: false,
    qualityScore: 0,
    extractedValue: null,
    issues: [],
    normalizedAnswer: userAnswer.trim(),
    provider: "deterministic-fallback",
  };

  // Check for obvious garbage answers
  const garbagePatterns = [
    /^[0-9.,\s]*$/, // Only numbers/punctuation
    /^[.!?;,\-_]+$/, // Only punctuation
    /^[a-z]{1,2}$/i, // Single or two letters (unless name question)
    /^(idk|dunno|na|n\/a|nope|nah|hmm|uh|um)$/i,
  ];

  const isGarbage = garbagePatterns.some((pattern) => pattern.test(normalized));

  if (isGarbage && question.field !== "name") {
    validation.issues.push("Answer appears to be incomplete or not meaningful");
    validation.qualityScore = 0.1;
    validation.followUpQuestion = generateFollowUp(question, "garbage");
    return validation;
  }

  // Field-specific validation
  switch (question.field) {
    case "name":
      return validateName(userAnswer, validation);
    case "location":
      return validateLocation(userAnswer, validation);
    case "hoursPerWeek":
      return validateHoursPerWeek(userAnswer, validation);
    case "targetUser":
      return validateTargetUser(userAnswer, validation);
    case "rawIdea":
      return validateRawIdea(userAnswer, validation);
    case "problem":
      return validateProblem(userAnswer, validation);
    case "evidenceLevel":
      return validateEvidenceLevel(userAnswer, validation);
    default:
      return validateGenericText(question, userAnswer, validation);
  }
}

function validateName(answer: string, validation: AnswerValidation): AnswerValidation {
  const normalized = answer.trim();

  // Check for obvious non-names
  const badPatterns = [
    /^[0-9]+$/,
    /^[.!?;,]+$/,
    /^(idk|random|aaa+|test|user|noname)$/i,
    /^(what|why|how|when|where)/i,
  ];

  if (badPatterns.some((p) => p.test(normalized))) {
    validation.issues.push("Not a valid name");
    validation.qualityScore = 0.2;
    validation.followUpQuestion = "I didn't catch a usable name. What should I call you during this founder plan?";
    return validation;
  }

  if (normalized.length < 2) {
    validation.issues.push("Name too short");
    validation.qualityScore = 0.3;
    validation.followUpQuestion = "Could you give me your actual name or nickname?";
    return validation;
  }

  // Accept it
  validation.isUsable = true;
  validation.qualityScore = 0.9;
  validation.extractedValue = normalized;
  validation.normalizedAnswer = normalized;
  return validation;
}

function validateLocation(answer: string, validation: AnswerValidation): AnswerValidation {
  const normalized = answer.trim();

  // Check for garbage
  if (normalized.length < 3) {
    validation.issues.push("Location too vague");
    validation.qualityScore = 0.2;
    validation.followUpQuestion = "Which country and city are you building from?";
    return validation;
  }

  const badPatterns = [/^(earth|world|online|internet|nowhere|idk)$/i];

  if (badPatterns.some((p) => p.test(normalized))) {
    validation.issues.push("Location not specific enough");
    validation.qualityScore = 0.3;
    validation.followUpQuestion = "I need at least a country name. Where are you based?";
    return validation;
  }

  // Extract country and city if possible
  // Simple heuristic: "Mumbai, India" or "India" or "San Francisco, USA"
  const parts = normalized.split(",").map((p) => p.trim());
  validation.extractedValue = {
    country: parts.length > 1 ? parts[parts.length - 1] : parts[0],
    city: parts.length > 1 ? parts[0] : undefined,
  };

  validation.isUsable = true;
  validation.qualityScore = parts.length > 1 ? 0.9 : 0.7;
  validation.normalizedAnswer = normalized;
  return validation;
}

function validateHoursPerWeek(answer: string, validation: AnswerValidation): AnswerValidation {
  const normalized = answer.trim().toLowerCase();

  // Try to extract a number
  const numberMatch = normalized.match(/(\d+)/);

  if (!numberMatch) {
    // Check for descriptive answers
    if (/(not sure|unclear|depends|varies)/i.test(normalized)) {
      validation.qualityScore = 0.5;
      validation.followUpQuestion =
        "That's okay. Give me a rough range — less than 3, 3–7, 7–15, or 15+ hours per week?";
      return validation;
    }

    if (/(a lot|many|lots|plenty)/i.test(normalized)) {
      validation.qualityScore = 0.6;
      validation.followUpQuestion = "Great! Can you put a rough number on it? Like 10, 15, 20 hours per week?";
      return validation;
    }

    validation.issues.push("No clear hour estimate");
    validation.qualityScore = 0.2;
    validation.followUpQuestion = "How many hours per week can you realistically spend? Just a rough number.";
    return validation;
  }

  const hours = parseInt(numberMatch[1], 10);

  if (hours === 0) {
    validation.issues.push("Zero hours is not actionable");
    validation.qualityScore = 0.3;
    validation.followUpQuestion = "If you have zero hours available, it might not be the right time. Do you mean less than 5 hours?";
    return validation;
  }

  if (hours > 80) {
    validation.qualityScore = 0.6;
    validation.followUpQuestion = `${hours} hours seems very high. Realistically, how many focused hours per week?`;
    return validation;
  }

  validation.isUsable = true;
  validation.qualityScore = 0.9;
  validation.extractedValue = hours;
  validation.normalizedAnswer = `${hours} hours per week`;
  return validation;
}

function validateTargetUser(answer: string, validation: AnswerValidation): AnswerValidation {
  const normalized = answer.trim().toLowerCase();

  // Check for overly broad answers
  const tooBroad = [
    /^(everyone|anybody|anyone|people|users|customers|all)$/i,
    /^(students|businesses|companies)$/i, // Too generic without qualifier
  ];

  if (tooBroad.some((p) => p.test(normalized))) {
    validation.issues.push("Target user too broad");
    validation.qualityScore = 0.3;
    validation.followUpQuestion =
      "That's too broad. Which specific type of student/business/user would feel this pain first?";
    return validation;
  }

  if (normalized.length < 5) {
    validation.issues.push("Answer too short");
    validation.qualityScore = 0.2;
    validation.followUpQuestion = "Be more specific. Who exactly is the first user you'd help?";
    return validation;
  }

  // Good answers have qualifiers
  const hasQualifier =
    /first.year|college|working|professional|freelance|small|startup|tier|local|young|early.stage|beginner/i.test(
      answer
    );

  validation.isUsable = true;
  validation.qualityScore = hasQualifier ? 0.9 : 0.7;
  validation.extractedValue = answer.trim();
  validation.normalizedAnswer = answer.trim();
  return validation;
}

function validateRawIdea(answer: string, validation: AnswerValidation): AnswerValidation {
  const normalized = answer.trim().toLowerCase();

  // Check for "no idea yet" - this is acceptable
  if (/(no idea|do not have an idea|don't have an idea|don't know|not sure|still exploring)/i.test(normalized)) {
    validation.isUsable = true;
    validation.qualityScore = 0.8;
    validation.extractedValue = "no idea yet";
    validation.normalizedAnswer = "no idea yet";
    return validation;
  }

  // Check for garbage
  const garbage = [/^(app|ai|startup|tech|business|product|website)$/i, /^(make money|get rich|be successful)$/i];

  if (garbage.some((p) => p.test(normalized))) {
    validation.issues.push("Idea description too vague");
    validation.qualityScore = 0.2;
    validation.followUpQuestion = "Give me at least one sentence. Who is it for, and what problem would it solve?";
    return validation;
  }

  if (answer.trim().length < 15) {
    validation.issues.push("Description too short");
    validation.qualityScore = 0.3;
    validation.followUpQuestion = "Describe it in at least one full sentence. What does it do, and who needs it?";
    return validation;
  }

  // Good enough
  validation.isUsable = true;
  validation.qualityScore = answer.trim().length > 50 ? 0.9 : 0.7;
  validation.extractedValue = answer.trim();
  validation.normalizedAnswer = answer.trim();
  return validation;
}

function validateProblem(answer: string, validation: AnswerValidation): AnswerValidation {
  const normalized = answer.trim().toLowerCase();

  if (normalized.length < 10) {
    validation.issues.push("Problem statement too short");
    validation.qualityScore = 0.3;
    validation.followUpQuestion = "What specific frustration or pain does this solve? One clear sentence.";
    return validation;
  }

  const tooVague = [/^(bad|not good|annoying|hard|difficult)$/i, /^(nothing|idk|dunno)$/i];

  if (tooVague.some((p) => p.test(normalized))) {
    validation.issues.push("Problem not specific enough");
    validation.qualityScore = 0.3;
    validation.followUpQuestion = "What exactly is painful about the current situation?";
    return validation;
  }

  validation.isUsable = true;
  validation.qualityScore = answer.trim().length > 40 ? 0.9 : 0.7;
  validation.extractedValue = answer.trim();
  validation.normalizedAnswer = answer.trim();
  return validation;
}

function validateEvidenceLevel(answer: string, validation: AnswerValidation): AnswerValidation {
  const normalized = answer.trim().toLowerCase();

  // All evidence levels are acceptable, even "no proof"
  const evidenceLevels = [
    "only my own belief",
    "personal experience",
    "friends told me",
    "online communities",
    "competitors exist",
    "surveys",
    "interviews",
    "users",
    "revenue",
    "research",
    "data",
    "no proof",
    "none",
  ];

  const hasEvidence = evidenceLevels.some((level) => normalized.includes(level));

  if (normalized.length < 3) {
    validation.issues.push("Evidence level unclear");
    validation.qualityScore = 0.3;
    validation.followUpQuestion =
      "How do you know this problem is real? Personal experience, user feedback, community posts, data?";
    return validation;
  }

  validation.isUsable = true;
  validation.qualityScore = hasEvidence ? 0.9 : 0.7;
  validation.extractedValue = answer.trim();
  validation.normalizedAnswer = answer.trim();
  return validation;
}

function validateGenericText(
  question: Question,
  answer: string,
  validation: AnswerValidation
): AnswerValidation {
  const normalized = answer.trim();

  if (normalized.length < 3) {
    validation.issues.push("Answer too short");
    validation.qualityScore = 0.2;
    validation.followUpQuestion = `I might be misunderstanding. Could you answer "${question.conversationalVariant}" in one clear sentence?`;
    return validation;
  }

  // Accept it
  validation.isUsable = true;
  validation.qualityScore = normalized.length > 20 ? 0.8 : 0.6;
  validation.extractedValue = normalized;
  validation.normalizedAnswer = normalized;
  return validation;
}

function generateFollowUp(question: Question, reason: "garbage" | "unclear" | "tooBroad"): string {
  if (reason === "garbage") {
    return `I didn't catch a clear answer. ${question.conversationalVariant}`;
  }
  if (reason === "tooBroad") {
    return `That's a bit too broad. ${question.conversationalVariant}`;
  }
  return question.conversationalVariant;
}

/**
 * Check if we should continue to the next question or ask a follow-up
 */
export function shouldContinueToNext(validation: AnswerValidation, retryCount: number): {
  continue: boolean;
  action: "accept" | "followup" | "retry" | "skip";
  message?: string;
} {
  // Max 2 retries per question
  if (retryCount >= 2) {
    if (validation.qualityScore < 0.4) {
      return {
        continue: true,
        action: "skip",
        message: "Let's move on for now. We can revisit this later.",
      };
    }
  }

  if (validation.qualityScore >= 0.65) {
    return {
      continue: true,
      action: "accept",
    };
  }

  if (validation.qualityScore >= 0.4) {
    return {
      continue: false,
      action: "followup",
      message: validation.followUpQuestion,
    };
  }

  return {
    continue: false,
    action: "retry",
    message: validation.followUpQuestion,
  };
}
