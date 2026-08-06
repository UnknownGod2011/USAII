import { describe, expect, it } from "vitest";
import { parseSyllabusFallback, syllabusAssistantReply, SAMPLE_SYLLABUS } from "./syllabus";

describe("parseSyllabusFallback", () => {
  it("extracts grading, exams, textbooks, and schedule from sample syllabus", () => {
    const result = parseSyllabusFallback(SAMPLE_SYLLABUS);

    expect(result.courseName).toContain("CS 101");
    expect(result.instructor).toContain("Jane Smith");
    expect(result.grading.components.length).toBeGreaterThanOrEqual(3);
    expect(result.exams.some((exam) => /midterm|final/i.test(exam.name))).toBe(true);
    expect(result.textbooks.some((book) => /Algorithms/i.test(book.title))).toBe(true);
    expect(result.schedule.length).toBeGreaterThanOrEqual(2);
    expect(result.mode).toBe("fallback");
  });
});

describe("syllabusAssistantReply", () => {
  it("answers grading and exam questions from parsed breakdown", () => {
    const breakdown = parseSyllabusFallback(SAMPLE_SYLLABUS);

    expect(syllabusAssistantReply("What is the grading breakdown?", breakdown)).toMatch(/Homework|30%/i);
    expect(syllabusAssistantReply("When is the final exam?", breakdown)).toMatch(/final/i);
    expect(syllabusAssistantReply("What textbooks do I need?", breakdown)).toMatch(/Algorithms/i);
  });
});
