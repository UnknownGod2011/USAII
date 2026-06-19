import { describe, expect, it } from "vitest";
import { validateAnswer } from "./answerValidator";
import { CORE_QUESTIONS } from "./questions";

describe("founder interview workflow", () => {
  it("captures idea, target user, and problem as questions 3 to 5", () => {
    expect(CORE_QUESTIONS.slice(0, 5).map((question) => question.field)).toEqual(["name", "location", "rawIdea", "targetUser", "problem"]);
  });
  it("rejects accidental answers but accepts honest weak evidence and no-idea answers", async () => {
    expect((await validateAnswer(CORE_QUESTIONS[0], "0", {})).isUsable).toBe(false);
    expect((await validateAnswer(CORE_QUESTIONS[2], "app", {})).isUsable).toBe(false);
    expect((await validateAnswer(CORE_QUESTIONS[3], "everyone", {})).isUsable).toBe(false);
    expect((await validateAnswer(CORE_QUESTIONS[2], "I do not have an idea yet", {})).normalizedAnswer).toBe("no idea yet");
    expect((await validateAnswer(CORE_QUESTIONS[11], "No proof yet", {})).isUsable).toBe(true);
  });
});
