import { describe, expect, it } from "vitest";
import { isLikelyMarketCompetitor, isMarketCompetitorUrl } from "./research";

describe("competitor classification", () => {
  it("excludes repositories, articles, social posts, and news from competitor lists", () => {
    expect(isMarketCompetitorUrl("https://github.com/example/study-planner")).toBe(false);
    expect(isLikelyMarketCompetitor("Why engineering students fail: a broken system", "https://example.com/blog/why-students-fail")).toBe(false);
    expect(isLikelyMarketCompetitor("Study advice post", "https://www.linkedin.com/posts/example")).toBe(false);
  });

  it("keeps actual product listings as competitor candidates", () => {
    expect(isLikelyMarketCompetitor("Engineering Exam Preparation App", "https://play.google.com/store/apps/details?id=com.example")).toBe(true);
    expect(isLikelyMarketCompetitor("Focused Study Planner Software", "https://example.com/study-planner")).toBe(true);
  });
});
