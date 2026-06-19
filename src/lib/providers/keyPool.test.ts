import { afterEach, describe, expect, it } from "vitest";
import { classifyProviderError, getProviderKeys, ProviderRequestError, resetProviderPoolStateForTests, runWithProviderKey } from "./keyPool";

describe("provider key pools", () => {
  afterEach(resetProviderPoolStateForTests);
  it("prefers plural pools and falls back to one singular key", () => {
    expect(getProviderKeys("tavily", { TAVILY_API_KEY: "single", TAVILY_API_KEYS: " first, second " } as unknown as NodeJS.ProcessEnv)).toEqual(["first", "second"]);
    expect(getProviderKeys("tavily", { TAVILY_API_KEY: "single" } as unknown as NodeJS.ProcessEnv)).toEqual(["single"]);
  });
  it("rotates after retryable authentication and rate-limit failures", async () => {
    const attempted: string[] = [];
    const result = await runWithProviderKey("exa", async (key) => {
      attempted.push(key);
      if (attempted.length === 1) throw new ProviderRequestError("unauthorized", { status: 401 });
      return "ok";
    }, { keys: ["one", "two"], sleep: async () => undefined });
    expect(result).toBe("ok");
    expect(attempted).toEqual(["one", "two"]);
    expect(classifyProviderError("tavily", new ProviderRequestError("limited", { status: 429 })).kind).toBe("rate_limit");
  });
  it("fails cleanly with no configured key", async () => {
    await expect(runWithProviderKey("serpapi", async () => "unused", { keys: [] })).rejects.toMatchObject({ code: "NOT_CONFIGURED" });
  });
});
