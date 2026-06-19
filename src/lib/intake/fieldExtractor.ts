import type { QuestionField } from "./questions";

export type ExtractedField = { field: QuestionField; value: string; confidence: number };

export function extractMultipleFields(answer: string, currentField?: QuestionField): ExtractedField[] {
  const results: ExtractedField[] = [];
  const add = (field: QuestionField, value: string, confidence: number) => {
    if (field !== currentField && !results.some((item) => item.field === field)) results.push({ field, value, confidence });
  };
  const name = answer.match(/\b(?:i am|i'm|my name is|call me)\s+([a-z][a-z '-]{1,30}?)(?=\s+(?:from|in|and|,)|$)/i);
  if (name) add("name", name[1].trim(), 0.88);
  const location = answer.match(/\b(?:from|based in|live in)\s+([a-z][a-z .'-]+(?:,\s*[a-z][a-z .'-]+)?)/i);
  if (location) add("location", location[1].trim(), 0.82);
  if (/\bstudent\b/i.test(answer)) add("status", "student", 0.95);
  else if (/\b(?:working professional|employed|full-time job)\b/i.test(answer)) add("status", "working professional", 0.9);
  else if (/\bfreelancer\b/i.test(answer)) add("status", "freelancer", 0.9);
  const hours = answer.match(/\b(\d{1,2})\s*(?:hours?|hrs?)(?:\s*(?:per|a|\/)\s*week)?/i);
  if (hours) add("hoursPerWeek", hours[1], 0.94);
  const budget = answer.match(/(?:₹|rs\.?|inr)?\s*(\d+(?:,\d{3})*|\d+k)\s*(?:budget|rupees?)?/i);
  if (budget && /budget|₹|rs\.?|inr|\dk/i.test(budget[0])) add("budget", budget[0].trim(), 0.78);
  if (/\b(?:solo|alone|just me)\b/i.test(answer)) add("teamStatus", "solo", 0.94);
  else if (/\b(?:co-?founder|team)\b/i.test(answer)) add("teamStatus", "with a team", 0.86);
  return results;
}
