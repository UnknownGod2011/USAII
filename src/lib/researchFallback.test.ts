import { describe, expect, it } from "vitest";
import { configuredResearchProviderNames, runLiveResearch } from "./research";
import type { FounderProfile } from "./types";

const profile: FounderProfile = {
  name: "Founder",
  location: "Bengaluru, India",
  status: "Student",
  hoursPerWeek: 10,
  budget: "Under INR 5,000",
  skills: ["Research"],
  teamStatus: "Solo",
  ideaStage: "rough idea",
  rawIdea: "Appointment reminders for independent dental clinics",
  targetUser: "Independent dental clinic owners in Bengaluru",
  whyItMatters: "Manual follow-up wastes staff time and causes missed appointments",
  evidence: ["No proof yet"],
  traction: "No proof yet",
  willingnessToLearn: "Open",
  riskTolerance: "Moderate",
  success30Days: "Complete 5 interviews",
};

describe("research provider fallback", () => {
  it("keeps the required provider priority for singular-key configurations", () => {
    expect(configuredResearchProviderNames({
      GEMINI_API_KEY: "g",
      TAVILY_API_KEY: "t",
      EXA_API_KEY: "e",
      SERPAPI_API_KEY: "s",
      GOOGLE_SEARCH_API_KEY: "c",
      GOOGLE_SEARCH_ENGINE_ID: "cx",
    } as unknown as NodeJS.ProcessEnv)).toEqual(["gemini", "tavily", "exa", "serpapi", "google"]);
    expect(configuredResearchProviderNames({ TAVILY_API_KEY: "t" } as unknown as NodeJS.ProcessEnv)).toEqual(["tavily"]);
    expect(configuredResearchProviderNames({ EXA_API_KEY: "e" } as unknown as NodeJS.ProcessEnv)).toEqual(["exa"]);
  });

  it("returns transparent limited offline analysis when every live provider is missing", async () => {
    const previous = {
      GEMINI_API_KEY: process.env.GEMINI_API_KEY,
      GEMINI_API_KEYS: process.env.GEMINI_API_KEYS,
      TAVILY_API_KEY: process.env.TAVILY_API_KEY,
      TAVILY_API_KEYS: process.env.TAVILY_API_KEYS,
      EXA_API_KEY: process.env.EXA_API_KEY,
      EXA_API_KEYS: process.env.EXA_API_KEYS,
      SERPAPI_API_KEY: process.env.SERPAPI_API_KEY,
      SERPAPI_API_KEYS: process.env.SERPAPI_API_KEYS,
      GOOGLE_SEARCH_API_KEY: process.env.GOOGLE_SEARCH_API_KEY,
      GOOGLE_SEARCH_API_KEYS: process.env.GOOGLE_SEARCH_API_KEYS,
      GOOGLE_SEARCH_ENGINE_ID: process.env.GOOGLE_SEARCH_ENGINE_ID,
    };
    Object.keys(previous).forEach((key) => { delete process.env[key]; });
    try {
      const research = await runLiveResearch(profile);
      expect(research.mode).toBe("fallback");
      expect(research.sources).toHaveLength(1);
      expect(research.sources[0].snippet).toContain("Live research is unavailable right now");
    } finally {
      Object.entries(previous).forEach(([key, value]) => {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      });
    }
  });
});
