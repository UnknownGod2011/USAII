import { describe, expect, it } from "vitest";
import { runLiveResearch } from "./research";
import type { FounderProfile } from "./types";

const profile: FounderProfile = {
  name: "Founder", location: "Mumbai, India", status: "Student", hoursPerWeek: 10, budget: "Under INR 5,000",
  skills: ["research"], teamStatus: "Solo", ideaStage: "rough idea", rawIdea: "A focused study planner",
  targetUser: "First-year engineering students", whyItMatters: "They waste revision time choosing weak topics",
  evidence: ["No proof yet"], traction: "No proof yet", willingnessToLearn: "Open", riskTolerance: "Moderate", success30Days: "Five interviews",
};

describe("research provider fallback", () => {
  it("returns transparent limited analysis when all providers are missing", async () => {
    const names = ["GEMINI_API_KEY", "GEMINI_API_KEYS", "TAVILY_API_KEY", "TAVILY_API_KEYS", "EXA_API_KEY", "EXA_API_KEYS", "SERPAPI_API_KEY", "SERPAPI_API_KEYS", "GOOGLE_SEARCH_API_KEY", "GOOGLE_SEARCH_API_KEYS", "GOOGLE_SEARCH_ENGINE_ID"];
    const saved = Object.fromEntries(names.map((name) => [name, process.env[name]]));
    names.forEach((name) => delete process.env[name]);
    try {
      const research = await runLiveResearch(profile);
      expect(research.mode).toBe("fallback");
      expect(research.sources[0].snippet).toContain("Live research is unavailable right now");
    } finally {
      Object.entries(saved).forEach(([name, value]) => { if (value === undefined) delete process.env[name]; else process.env[name] = value; });
    }
  });
});
