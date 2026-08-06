import { selectGeminiKey } from "./keyPool";
import { z } from "zod";

const gradingComponentSchema = z.object({
  name: z.string(),
  weight: z.string().optional(),
  description: z.string().optional(),
});

const examSchema = z.object({
  name: z.string(),
  date: z.string().optional(),
  time: z.string().optional(),
  location: z.string().optional(),
  weight: z.string().optional(),
  notes: z.string().optional(),
});

const textbookSchema = z.object({
  title: z.string(),
  author: z.string().optional(),
  isbn: z.string().optional(),
  required: z.boolean().default(true),
  notes: z.string().optional(),
});

const scheduleItemSchema = z.object({
  week: z.union([z.string(), z.number()]).optional(),
  date: z.string().optional(),
  topic: z.string(),
  readings: z.string().optional(),
  assignments: z.string().optional(),
  notes: z.string().optional(),
});

const importantDateSchema = z.object({
  label: z.string(),
  date: z.string(),
  notes: z.string().optional(),
});

export const syllabusBreakdownSchema = z.object({
  courseName: z.string(),
  courseCode: z.string().optional(),
  instructor: z.string().optional(),
  semester: z.string().optional(),
  officeHours: z.string().optional(),
  meetingTimes: z.string().optional(),
  location: z.string().optional(),
  description: z.string().optional(),
  grading: z.object({
    components: z.array(gradingComponentSchema),
    scale: z.string().optional(),
    passingGrade: z.string().optional(),
    notes: z.array(z.string()).optional(),
  }),
  exams: z.array(examSchema),
  textbooks: z.array(textbookSchema),
  schedule: z.array(scheduleItemSchema),
  importantDates: z.array(importantDateSchema),
  policies: z.array(z.string()).optional(),
  warnings: z.array(z.string()).optional(),
});

export type SyllabusBreakdown = z.infer<typeof syllabusBreakdownSchema> & {
  parsedAt: string;
  mode: "ai" | "fallback";
};

const SAMPLE_SYLLABUS = `CS 101 - Introduction to Computer Science
Spring 2026 | Instructor: Dr. Jane Smith | Office Hours: Tue/Thu 2-4pm

Grading:
- Homework (30%)
- Midterm Exam (25%) - March 12, 2026
- Final Exam (35%) - May 8, 2026, 9:00 AM
- Participation (10%)

Required Textbook: Introduction to Algorithms by Cormen, Leiserson, Rivest (ISBN 978-0262046305)
Optional: Python Crash Course by Eric Matthes

Week 1 (Jan 13): Course intro, variables
Week 2 (Jan 20): Control flow, functions — HW1 due
Week 3 (Jan 27): Data structures`;

function unique<T>(items: T[]) {
  return [...new Set(items)];
}

function firstMatch(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]?.trim()) return match[1].trim();
  }
  return undefined;
}

function extractGrading(text: string) {
  const components: z.infer<typeof gradingComponentSchema>[] = [];
  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    const weighted = line.match(/^[\s\-*•]*(.+?)\s*[\(:]?\s*(\d{1,3})\s*%\s*[\)]?\s*(.*)$/i);
    if (weighted) {
      components.push({
        name: weighted[1].replace(/[:：]\s*$/, "").trim(),
        weight: `${weighted[2]}%`,
        description: weighted[3]?.trim() || undefined,
      });
      continue;
    }

    const named = line.match(/^[\s\-*•]*(homework|quiz(?:zes)?|exam|midterm|final|project|lab|participation|attendance)[^:]*:\s*(.+)$/i);
    if (named) {
      components.push({ name: named[1], description: named[2].trim() });
    }
  }

  const scale = firstMatch(text, [/grading scale[:\s]+([^\n]+)/i, /letter grades?[:\s]+([^\n]+)/i]);
  const passingGrade = firstMatch(text, [/passing grade[:\s]+([^\n]+)/i, /minimum grade[:\s]+([^\n]+)/i]);

  return {
    components: components.slice(0, 12),
    scale,
    passingGrade,
    notes: components.length ? undefined : ["Grading breakdown not clearly detected. Paste the grading section or ask the assistant."],
  };
}

function extractExams(text: string) {
  const exams: z.infer<typeof examSchema>[] = [];
  const patterns = [
    /((?:midterm|final|exam|quiz|test)[^.\n]{0,40}?)\s*(?:[-–—:]\s*)?(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?|[A-Z][a-z]+ \d{1,2}(?:, \d{4})?)(?:[^.\n]{0,40}?(\d{1,3}\s*%))?/gi,
    /(\d{1,3}\s*%)[^.\n]{0,20}?((?:midterm|final|exam|quiz|test)[^.\n]{0,40}?)\s*(?:[-–—:]\s*)?(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?|[A-Z][a-z]+ \d{1,2}(?:, \d{4})?)/gi,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const name = (match[1] || match[2] || "Assessment").trim();
      const date = (match[2] || match[3] || "").trim();
      const weight = match[3]?.includes("%") ? match[3].trim() : match[1]?.includes("%") ? match[1].trim() : undefined;
      if (/midterm|final|exam|quiz|test/i.test(name)) {
        exams.push({ name, date: date || undefined, weight });
      }
    }
  }

  return unique(exams.map((exam) => JSON.stringify(exam))).map((item) => JSON.parse(item));
}

function extractTextbooks(text: string) {
  const textbooks: z.infer<typeof textbookSchema>[] = [];
  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    if (!/textbook|text book|reading|isbn|required|optional|recommended/i.test(line)) continue;

    const isbn = line.match(/(?:ISBN|isbn)[:\s#-]*([0-9X-]{10,17})/i)?.[1];
    const required = /required|mandatory/i.test(line);
    const optional = /optional|recommended|supplemental/i.test(line);

    let title = line
      .replace(/^[\s\-*•]*/, "")
      .replace(/^(?:required|optional|recommended|supplemental|textbook|text book|reading)[:\s-]*/i, "")
      .replace(/\(?\s*(?:ISBN|isbn)[:\s#-]*[0-9X-]{10,17}\s*\)?/i, "")
      .replace(/\s+by\s+/i, " — ")
      .trim();

    if (!title || title.length < 4) continue;

    textbooks.push({
      title,
      isbn,
      required: required || !optional,
    });
  }

  return textbooks.slice(0, 8);
}

function extractSchedule(text: string) {
  const schedule: z.infer<typeof scheduleItemSchema>[] = [];
  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    const weekMatch = line.match(
      /^(?:week|wk|module|unit)\s*(\d+)[^\w]{0,8}(?:\(?\s*([A-Z][a-z]+ \d{1,2}(?:, \d{4})?|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s*\)?)?[:\s-]+(.+)$/i,
    );
    if (weekMatch) {
      schedule.push({
        week: weekMatch[1],
        date: weekMatch[2]?.trim(),
        topic: weekMatch[3].trim(),
      });
      continue;
    }

    const dateFirst = line.match(/^(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?|[A-Z][a-z]+ \d{1,2}(?:, \d{4})?)[:\s-]+(.+)$/);
    if (dateFirst) {
      schedule.push({ date: dateFirst[1], topic: dateFirst[2].trim() });
    }
  }

  return schedule.slice(0, 24);
}

function extractImportantDates(text: string) {
  const dates: z.infer<typeof importantDateSchema>[] = [];
  const patterns = [
    /((?:drop deadline|add\/drop|withdrawal|project due|assignment due|holiday|no class|break)[^.\n]{0,40}?)[:\s-]+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?|[A-Z][a-z]+ \d{1,2}(?:, \d{4})?)/gi,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      dates.push({ label: match[1].trim(), date: match[2].trim() });
    }
  }

  return unique(dates.map((item) => JSON.stringify(item))).map((item) => JSON.parse(item));
}

export function parseSyllabusFallback(rawText: string): SyllabusBreakdown {
  const text = rawText.trim();
  const firstLine = text.split(/\r?\n/).find((line) => line.trim()) || "Untitled Course";
  const courseName = firstLine.replace(/\s*\|\s*.+$/, "").trim();
  const courseCode = firstMatch(text, [/([A-Z]{2,4}\s?\d{2,4}[A-Z]?)/, /course code[:\s]+([^\n]+)/i]);
  const instructor = firstMatch(text, [/instructor[:\s]+([^\n|]+)/i, /professor[:\s]+([^\n|]+)/i, /dr\.\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?/i]);
  const semester = firstMatch(text, [/((?:spring|summer|fall|winter)\s+\d{4})/i, /semester[:\s]+([^\n|]+)/i]);
  const officeHours = firstMatch(text, [/office hours?[:\s]+([^\n|]+)/i]);
  const meetingTimes = firstMatch(text, [/meets?[:\s]+([^\n]+)/i, /class time[:\s]+([^\n]+)/i, /schedule[:\s]+([^\n]+)/i]);
  const location = firstMatch(text, [/location[:\s]+([^\n|]+)/i, /room[:\s]+([^\n|]+)/i]);
  const grading = extractGrading(text);
  const exams = extractExams(text);
  const textbooks = extractTextbooks(text);
  const schedule = extractSchedule(text);
  const importantDates = extractImportantDates(text);

  const warnings: string[] = [];
  if (!grading.components.length) warnings.push("Grading weights were not clearly detected.");
  if (!exams.length) warnings.push("No exam or quiz dates were detected.");
  if (!textbooks.length) warnings.push("No textbooks were detected.");
  if (!schedule.length) warnings.push("Weekly schedule was not detected. Try including Week 1, Week 2 lines.");

  return {
    courseName,
    courseCode,
    instructor,
    semester,
    officeHours,
    meetingTimes,
    location,
    description: text.slice(0, 280).replace(/\s+/g, " ").trim(),
    grading,
    exams,
    textbooks,
    schedule,
    importantDates,
    policies: [],
    warnings,
    parsedAt: new Date().toISOString(),
    mode: "fallback",
  };
}

async function parseSyllabusWithGemini(rawText: string): Promise<SyllabusBreakdown | null> {
  const key = selectGeminiKey(0);
  if (!key) return null;

  const prompt = `You are a syllabus parsing assistant. Extract structured course information from the syllabus text below.
Return ONLY valid JSON matching this shape:
{
  "courseName": string,
  "courseCode"?: string,
  "instructor"?: string,
  "semester"?: string,
  "officeHours"?: string,
  "meetingTimes"?: string,
  "location"?: string,
  "description"?: string,
  "grading": {
    "components": [{ "name": string, "weight"?: string, "description"?: string }],
    "scale"?: string,
    "passingGrade"?: string,
    "notes"?: string[]
  },
  "exams": [{ "name": string, "date"?: string, "time"?: string, "location"?: string, "weight"?: string, "notes"?: string }],
  "textbooks": [{ "title": string, "author"?: string, "isbn"?: string, "required": boolean, "notes"?: string }],
  "schedule": [{ "week"?: string|number, "date"?: string, "topic": string, "readings"?: string, "assignments"?: string, "notes"?: string }],
  "importantDates": [{ "label": string, "date": string, "notes"?: string }],
  "policies"?: string[],
  "warnings"?: string[]
}

Rules:
- Preserve exact dates and percentages when present.
- If something is missing, use empty arrays and omit optional fields.
- Put unclear or ambiguous items in warnings.
- Do not invent dates or weights that are not supported by the syllabus.

Syllabus:
${rawText.slice(0, 12000)}`;

  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": key,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!response.ok) return null;

  const data = await response.json();
  const rawJson =
    data?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text || "")
      .join("\n")
      .trim() || "";

  try {
    const parsed = syllabusBreakdownSchema.parse(JSON.parse(rawJson));
    return {
      ...parsed,
      parsedAt: new Date().toISOString(),
      mode: "ai",
    };
  } catch {
    return null;
  }
}

export async function parseSyllabus(rawText: string): Promise<SyllabusBreakdown> {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return parseSyllabusFallback(SAMPLE_SYLLABUS);
  }

  const aiResult = await parseSyllabusWithGemini(trimmed);
  if (aiResult) return aiResult;

  return parseSyllabusFallback(trimmed);
}

export function syllabusAssistantReply(question: string, breakdown: SyllabusBreakdown) {
  const lower = question.toLowerCase().trim();
  if (!lower) {
    return "Ask me about grading, exam dates, textbooks, office hours, or the weekly schedule.";
  }

  if (/grade|grading|weight|percent/.test(lower)) {
    if (!breakdown.grading.components.length) {
      return "I couldn't find a clear grading breakdown. Check the original syllabus grading section or re-paste that part.";
    }
    const lines = breakdown.grading.components.map((item) =>
      item.weight ? `${item.name}: ${item.weight}` : item.name,
    );
    const scale = breakdown.grading.scale ? ` Grading scale: ${breakdown.grading.scale}.` : "";
    return `Grading for ${breakdown.courseName}: ${lines.join("; ")}.${scale}`;
  }

  if (/exam|midterm|final|quiz|test/.test(lower)) {
    if (!breakdown.exams.length) {
      return "No exam or quiz dates were extracted. Try pasting the assessment section from your syllabus.";
    }
    return breakdown.exams
      .map((exam) => {
        const parts = [exam.name];
        if (exam.date) parts.push(`on ${exam.date}`);
        if (exam.time) parts.push(`at ${exam.time}`);
        if (exam.weight) parts.push(`(${exam.weight})`);
        return parts.join(" ");
      })
      .join(". ");
  }

  if (/book|textbook|reading|isbn/.test(lower)) {
    if (!breakdown.textbooks.length) {
      return "No textbooks were found. Include the materials section from your syllabus and analyze again.";
    }
    return breakdown.textbooks
      .map((book) => `${book.required ? "Required" : "Optional"}: ${book.title}${book.author ? ` by ${book.author}` : ""}${book.isbn ? ` (ISBN ${book.isbn})` : ""}`)
      .join(". ");
  }

  if (/schedule|week|topic|calendar/.test(lower)) {
    if (!breakdown.schedule.length) {
      return "The weekly schedule wasn't detected. Add lines like 'Week 1: Introduction' or paste the course calendar.";
    }
    return breakdown.schedule
      .slice(0, 8)
      .map((item) => {
        const prefix = item.week ? `Week ${item.week}` : item.date || "Session";
        const extras = [item.readings, item.assignments].filter(Boolean).join("; ");
        return `${prefix}: ${item.topic}${extras ? ` (${extras})` : ""}`;
      })
      .join(". ");
  }

  if (/office hour|instructor|professor|teacher/.test(lower)) {
    const parts = [
      breakdown.instructor ? `Instructor: ${breakdown.instructor}.` : "",
      breakdown.officeHours ? `Office hours: ${breakdown.officeHours}.` : "",
      breakdown.meetingTimes ? `Class meets: ${breakdown.meetingTimes}.` : "",
      breakdown.location ? `Location: ${breakdown.location}.` : "",
    ].filter(Boolean);
    return parts.length ? parts.join(" ") : "Instructor and office hour details were not found in the syllabus.";
  }

  if (/when|date|due|deadline/.test(lower)) {
    const allDates = [
      ...breakdown.exams.map((exam) => ({ label: exam.name, date: exam.date || "TBD" })),
      ...breakdown.importantDates,
    ].filter((item) => item.date);
    if (!allDates.length) return "I couldn't find specific dates. Re-paste the syllabus with assessment and deadline sections.";
    return allDates.map((item) => `${item.label}: ${item.date}`).join(". ");
  }

  return `For ${breakdown.courseName}, your next useful checks are grading weights, exam dates, required textbooks, and the week-by-week schedule. Try asking "What is the grading breakdown?" or "When is the midterm?"`;
}

export function breakdownToMarkdown(breakdown: SyllabusBreakdown) {
  return `# ${breakdown.courseName}

${breakdown.courseCode ? `**Course code:** ${breakdown.courseCode}\n` : ""}${breakdown.instructor ? `**Instructor:** ${breakdown.instructor}\n` : ""}${breakdown.semester ? `**Semester:** ${breakdown.semester}\n` : ""}${breakdown.meetingTimes ? `**Meeting times:** ${breakdown.meetingTimes}\n` : ""}${breakdown.location ? `**Location:** ${breakdown.location}\n` : ""}${breakdown.officeHours ? `**Office hours:** ${breakdown.officeHours}\n` : ""}

## Grading
${breakdown.grading.components.map((item) => `- ${item.name}${item.weight ? ` (${item.weight})` : ""}${item.description ? `: ${item.description}` : ""}`).join("\n") || "- Not detected"}

## Exams & Assessments
${breakdown.exams.map((exam) => `- ${exam.name}${exam.date ? ` — ${exam.date}` : ""}${exam.weight ? ` (${exam.weight})` : ""}`).join("\n") || "- Not detected"}

## Textbooks
${breakdown.textbooks.map((book) => `- ${book.required ? "Required" : "Optional"}: ${book.title}${book.author ? ` by ${book.author}` : ""}${book.isbn ? ` (ISBN ${book.isbn})` : ""}`).join("\n") || "- Not detected"}

## Schedule
${breakdown.schedule.map((item) => `- ${item.week ? `Week ${item.week}` : item.date || "Session"}: ${item.topic}${item.assignments ? ` — ${item.assignments}` : ""}`).join("\n") || "- Not detected"}

## Important Dates
${breakdown.importantDates.map((item) => `- ${item.label}: ${item.date}`).join("\n") || "- Not detected"}

---
Parsed ${new Date(breakdown.parsedAt).toLocaleString()} (${breakdown.mode === "ai" ? "AI" : "rule-based fallback"})
`;
}

export { SAMPLE_SYLLABUS };
