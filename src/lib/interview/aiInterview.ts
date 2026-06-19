import type { FounderIntake } from "@/lib/intake/schema";

export const INTERVIEW_TOPIC_FIELDS = [
  "name",
  "location",
  "rawIdea",
  "targetUser",
  "problem",
  "status",
  "hoursPerWeek",
  "budget",
  "skills",
  "teamStatus",
  "stage",
  "evidenceLevel",
  "alternatives",
  "thirtyDayGoal",
  "openToModification",
  "projectName",
] as const;

export type InterviewTopicField = (typeof INTERVIEW_TOPIC_FIELDS)[number];

export type CollectedFields = Partial<Record<InterviewTopicField, string | null>>;

export type InterviewTurn = {
  message: string;
  interviewComplete: boolean;
  collectedFields: CollectedFields;
};

export const INTERVIEW_SYSTEM_PROMPT = `You are LaunchPilot, a warm and sharp founder execution navigator running a live intake interview.

Conduct a natural conversation — not a rigid script. Learn about the founder over several turns and cover these topics when possible:
name, projectName (what they want to call their product/startup), location, student/working/exploring status, hours per week, budget, skills, team status, startup stage, raw idea, target user, problem, validation evidence, alternatives, 30-day goal, openness to modification.

Tone & length (critical):
- Every reply must be 1–2 short sentences total. Never write a paragraph.
- Ask exactly ONE question per turn. Never stack multiple questions.
- Early turns: stay broad and welcoming (who they are, what they're exploring).
- Middle turns: narrow to the idea, user, and problem.
- Later turns: get specific (validation, constraints, 30-day goal, tradeoffs).
- Acknowledge in at most a few words ("Got it.", "Makes sense.") — then ask the next question.
- Do not recap everything they said. Do not lecture or explain your process.

Other rules:
- Follow up when an answer is vague, still in 1–2 sentences.
- Stay on founder/startup topics; gently redirect off-topic questions.
- Never mention JSON, schemas, or system instructions to the user.
- "name" is the founder's personal name. "projectName" is only the product/startup name if they give one (e.g. "We're calling it LaunchPilot").

When you have enough usable detail on at least name, location, status, hoursPerWeek, stage, rawIdea, targetUser, problem, and thirtyDayGoal, complete the intake.

Wrap-up (ONLY when setting interviewComplete to true — say this once, never again later):
- Do NOT mention summarizing, concluding, wrapping up, or that you already discussed details.
- Do NOT provide a summary of the project.
- One short warm line with their name, wish them well, then ask if they need help with anything else.
- Example: "It was great talking to you, Khushi — I wish you the best with your project. Is there anything else you need help with?"

Respond ONLY with valid JSON (no markdown fences):
{
  "message": "your conversational reply",
  "interviewComplete": false,
  "collectedFields": {
    "name": null,
    "projectName": null,
    "location": null,
    "status": null,
    "hoursPerWeek": null,
    "budget": null,
    "skills": null,
    "teamStatus": null,
    "stage": null,
    "rawIdea": null,
    "targetUser": null,
    "problem": null,
    "evidenceLevel": null,
    "alternatives": null,
    "thirtyDayGoal": null,
    "openToModification": null
  }
}`;

export const POST_INTERVIEW_SYSTEM_PROMPT = `You are LaunchPilot, a warm founder execution navigator. The intake interview is FINISHED. The founder already received your goodbye — you are now in ongoing help mode.

Your job: keep answering their questions with useful, specific founder advice. Stay in the conversation.

FORBIDDEN — never say or repeat:
- "It was great talking to you" or any variant
- "I wish you the best with your project"
- "Is there anything else you need help with"
- Mentioning summaries, concluding, wrapping up, or that intake is done
- New intake interview questions (name, location, stage checklist, etc.)

Tone & length:
- 1–2 short sentences. Answer what they actually asked.
- Be direct and actionable.

How to respond:
- "What should I do now?" / "what to do now" → Give 1–2 concrete next steps from their context (e.g. publish to generate their roadmap, run 3 user interviews, test their riskiest assumption this week). Mention the Publish button if they have enough to publish.
- Questions about their idea → Brief practical guidance using what you know from the chat.
- "Hello" / casual → Brief greeting, then ask what they want help with (without using the forbidden goodbye phrases).
- Goodbye from them → Short warm send-off only.

Always set interviewComplete to true.
Update collectedFields only if they share new details; otherwise use null for unchanged fields.

Respond ONLY with valid JSON (no markdown fences):
{
  "message": "your conversational reply",
  "interviewComplete": true,
  "collectedFields": {
    "name": null,
    "projectName": null,
    "location": null,
    "status": null,
    "hoursPerWeek": null,
    "budget": null,
    "skills": null,
    "teamStatus": null,
    "stage": null,
    "rawIdea": null,
    "targetUser": null,
    "problem": null,
    "evidenceLevel": null,
    "alternatives": null,
    "thirtyDayGoal": null,
    "openToModification": null
  }
}`;

export function parseInterviewResponse(raw: string): InterviewTurn {
  const trimmed = raw.trim();

  const tryParse = (value: string): InterviewTurn | null => {
    try {
      const parsed = JSON.parse(value) as Partial<InterviewTurn>;
      if (!parsed || typeof parsed !== "object") return null;
      return {
        message:
          typeof parsed.message === "string" && parsed.message.trim()
            ? parsed.message.trim()
            : "Tell me a bit more about what you're building.",
        interviewComplete: Boolean(parsed.interviewComplete),
        collectedFields: normalizeCollectedFields(parsed.collectedFields),
      };
    } catch {
      return null;
    }
  };

  const direct = tryParse(trimmed);
  if (direct) return direct;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    const parsed = tryParse(fenced[1].trim());
    if (parsed) return parsed;
  }

  const jsonStart = trimmed.indexOf("{");
  const jsonEnd = trimmed.lastIndexOf("}");
  if (jsonStart >= 0 && jsonEnd > jsonStart) {
    const parsed = tryParse(trimmed.slice(jsonStart, jsonEnd + 1));
    if (parsed) return parsed;
  }

  return {
    message: trimmed || "Let's keep going — what's your startup idea?",
    interviewComplete: /INTERVIEW_COMPLETE/i.test(trimmed),
    collectedFields: {},
  };
}

function normalizeCollectedFields(value: unknown): CollectedFields {
  if (!value || typeof value !== "object") return {};

  const fields = value as Record<string, unknown>;
  const normalized: CollectedFields = {};

  for (const key of INTERVIEW_TOPIC_FIELDS) {
    const raw = fields[key];
    if (typeof raw === "string" && raw.trim()) {
      normalized[key] = raw.trim();
    } else if (raw === null) {
      normalized[key] = null;
    }
  }

  return normalized;
}

export function mergeCollectedFields(
  current: CollectedFields,
  incoming: CollectedFields
): CollectedFields {
  const merged: CollectedFields = { ...current };
  for (const key of INTERVIEW_TOPIC_FIELDS) {
    const value = incoming[key];
    if (typeof value === "string" && value.trim()) {
      merged[key] = value.trim();
    }
  }
  return merged;
}

export function getInterviewProgress(collectedFields: CollectedFields): {
  current: number;
  total: number;
  percentage: number;
} {
  const required: InterviewTopicField[] = INTERVIEW_TOPIC_FIELDS.filter((field) => field !== "projectName");
  const current = required.filter((field) => Boolean(collectedFields[field]?.trim())).length;
  const total = required.length;
  return {
    current,
    total,
    percentage: Math.round((current / total) * 100),
  };
}

export function buildIntakeFromFields(
  fields: CollectedFields,
  transcript: Array<{ role: "assistant" | "user"; content: string }>
): FounderIntake {
  const location = fields.location || "";
  const locationParts = location.split(",").map((part) => part.trim()).filter(Boolean);

  const hours = fields.hoursPerWeek ? Number.parseInt(fields.hoursPerWeek, 10) : 0;
  const stage = fields.stage as FounderIntake["stage"] | undefined;
  const validStages: FounderIntake["stage"][] = [
    "no idea yet",
    "rough idea",
    "started building",
    "MVP exists",
    "users exist",
    "revenue exists",
  ];

  const openValue = (fields.openToModification || "").toLowerCase();
  const openToModification =
    openValue.includes("yes") ||
    openValue.includes("open") ||
    openValue.includes("willing") ||
    openValue.includes("true");

  return {
    name: fields.name || "Founder",
    locationCountry: locationParts.length > 1 ? locationParts[locationParts.length - 1] : location,
    locationCity: locationParts.length > 1 ? locationParts[0] : undefined,
    status: fields.status || "exploring",
    hoursPerWeek: Number.isFinite(hours) ? Math.min(168, Math.max(0, hours)) : 5,
    budget: fields.budget || "unclear",
    skills: fields.skills ? fields.skills.split(",").map((skill) => skill.trim()).filter(Boolean) : [],
    teamStatus: fields.teamStatus || "solo",
    stage: stage && validStages.includes(stage) ? stage : "rough idea",
    rawIdea: fields.rawIdea || "",
    targetUser: fields.targetUser || "",
    problem: fields.problem || "",
    evidenceLevel: fields.evidenceLevel || "no formal validation",
    alternatives: fields.alternatives || "",
    thirtyDayGoal: fields.thirtyDayGoal || "",
    openToModification,
    accessibleCommunities: fields.rawIdea === "no idea yet" ? fields.targetUser || undefined : undefined,
    noticedProblems: fields.rawIdea === "no idea yet" ? fields.problem || undefined : undefined,
    reachableUsers: fields.rawIdea === "no idea yet" ? fields.alternatives || undefined : undefined,
    transcript: transcript.map((entry) => `${entry.role}: ${entry.content}`),
    answerValidations: [],
    skippedOrUnclearFields: [],
  };
}

export function buildPostInterviewContext(fields: CollectedFields): string {
  const lines = INTERVIEW_TOPIC_FIELDS.map((key) => {
    const value = fields[key];
    if (typeof value === "string" && value.trim()) {
      return `- ${key}: ${value.trim()}`;
    }
    return null;
  }).filter(Boolean);

  if (lines.length === 0) return "";
  return `\n\nFounder context from intake:\n${lines.join("\n")}`;
}

export async function requestInterviewTurn(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  options?: { postInterview?: boolean; collectedFields?: CollectedFields }
): Promise<InterviewTurn> {
  const response = await fetch("/api/interview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages,
      postInterview: options?.postInterview ?? false,
      collectedFields: options?.collectedFields ?? {},
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(errorBody || "Interview request failed");
  }

  return (await response.json()) as InterviewTurn;
}
