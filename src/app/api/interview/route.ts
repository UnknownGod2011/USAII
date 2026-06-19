import { validateAnswer } from "@/lib/intake/answerValidator";
import type { Question, QuestionField } from "@/lib/intake/questions";
import { INTERVIEW_TOPIC_FIELDS, type CollectedFields, type InterviewTopicField } from "@/lib/interview/aiInterview";
import { NextResponse } from "next/server";

const ordered = INTERVIEW_TOPIC_FIELDS.filter((field) => field !== "projectName");
const prompts: Record<Exclude<InterviewTopicField, "projectName">, string> = {
  name: "What should LaunchPilot call you?",
  location: "Where are you based? Country and city is enough.",
  rawIdea: "What are you trying to build, or do you not have an idea yet?",
  targetUser: "Who do you think this is for?",
  problem: "What painful problem does it solve for them?",
  status: "What is your current situation — student, working, freelancing, or already building full-time?",
  hoursPerWeek: "How many focused hours can you realistically protect each week?",
  budget: "What budget can you use for testing this direction right now? A rough range is fine.",
  skills: "What useful skills or domain access do you already have?",
  teamStatus: "Are you building solo or with a team?",
  stage: "Which stage are you at: no idea yet, rough idea, started building, MVP exists, users exist, or revenue exists?",
  evidenceLevel: "What proof do you currently have? 'No proof yet' is an honest valid answer.",
  alternatives: "What do people use today instead of your idea?",
  thirtyDayGoal: "What one measurable result would count as progress in the next 30 days?",
  openToModification: "Are you open to narrowing, changing, or rejecting this version if the evidence is weak?",
};
function promptFor(field: Exclude<InterviewTopicField, "projectName">, fields: CollectedFields) {
  const noIdea = fields.rawIdea === "no idea yet";
  if (noIdea && field === "targetUser") return "Problem Discovery Mode: which communities or groups can you personally access?";
  if (noIdea && field === "problem") return "What repeated problems have you personally noticed in those communities?";
  if (noIdea && field === "alternatives") return "Which users from that community can you reach in the next seven days?";
  return prompts[field];
}
function asQuestion(field: Exclude<InterviewTopicField, "projectName">): Question {
  const index = ordered.indexOf(field) + 1;
  return {
    id: index, field: field === "location" ? "location" : field as QuestionField,
    question: prompts[field], conversationalVariant: prompts[field], expectedAnswerType: "longText",
    isCritical: ["name", "location", "rawIdea", "targetUser", "problem", "evidenceLevel", "openToModification"].includes(field),
    exampleGoodAnswer: "", exampleBadAnswer: "", whyItMatters: "",
  };
}
function normalizeValue(field: Exclude<InterviewTopicField, "projectName">, value: unknown, fallback: string) {
  if (field === "location" && value && typeof value === "object") {
    const location = value as { city?: string; country?: string };
    return [location.city, location.country].filter(Boolean).join(", ") || fallback;
  }
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value) : fallback;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const fields = { ...(body.collectedFields || {}) } as CollectedFields;
    const missing = ordered.find((field) => !fields[field]);
    const lastUser = [...messages].reverse().find((message: { role?: string; content?: string }) => message.role === "user" && typeof message.content === "string");

    if (!lastUser || !missing) {
      const first = missing || "name";
      return NextResponse.json({ message: promptFor(first, fields), interviewComplete: false, collectedFields: fields });
    }

    const validation = await validateAnswer(asQuestion(missing), lastUser.content, {});
    if (!validation.isUsable) {
      return NextResponse.json({ message: validation.followUpQuestion || `I need a clearer answer. ${promptFor(missing, fields)}`, interviewComplete: false, collectedFields: fields });
    }

    fields[missing] = normalizeValue(missing, validation.extractedValue, validation.normalizedAnswer);
    const next = ordered.find((field) => !fields[field]);
    if (!next) {
      return NextResponse.json({
        message: `Thanks, ${fields.name || "founder"}. Your intake is complete — I’m moving directly into evidence validation now.`,
        interviewComplete: true,
        collectedFields: fields,
      });
    }
    return NextResponse.json({ message: `Got it. ${promptFor(next, fields)}`, interviewComplete: false, collectedFields: fields });
  } catch {
    return NextResponse.json({ error: "The interview could not process that answer. Please retry." }, { status: 500 });
  }
}
