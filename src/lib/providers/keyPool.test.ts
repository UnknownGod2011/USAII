import { afterEach, describe, expect, it } from "vitest";
import {
  classifyProviderError,
  getProviderKeys,
  ProviderRequestError,
  resetProviderPoolStateForTests,
  runWithProviderKey,
} from "./keyPool";

describe("provider key pools", () => {
  afterEach(() => resetProviderPoolStateForTests());

  it("prefers a comma-separated plural pool and falls back to the singular key", () => {
    expect(getProviderKeys("tavily", {
      TAVILY_API_KEY: "single",
      TAVILY_API_KEYS: " first, second\nthird ",
    } as unknown as NodeJS.ProcessEnv)).toEqual(["first", "second", "third"]);
    expect(getProviderKeys("tavily", {
      TAVILY_API_KEY: "single",
      TAVILY_API_KEYS: " ",
    } as unknown as NodeJS.ProcessEnv)).toEqual(["single"]);
  });

  it("rotates to the next key after a retryable failure without exposing key values", async () => {
    const attempted: string[] = [];
    const result = await runWithProviderKey("exa", async (key) => {
      attempted.push(key);
      if (attempted.length === 1) throw new ProviderRequestError("request failed", { status: 401 });
      return "ok";
    }, { keys: ["one", "two"], sleep: async () => undefined });

    expect(result).toBe("ok");
    expect(attempted).toEqual(["one", "two"]);
  });

  it("classifies quota, rate-limit, and invalid-request failures", () => {
    expect(classifyProviderError("exa", new ProviderRequestError("credits", { status: 402 })).kind).toBe("quota");
    expect(classifyProviderError("tavily", new ProviderRequestError("limited", { status: 429 })).kind).toBe("rate_limit");
    expect(classifyProviderError("gemini", new ProviderRequestError("bad body", { status: 400 })).retryable).toBe(false);
  });

  it("rotates after a simulated rate limit and supports one configured key per provider", async () => {
    const attempts: string[] = [];
    const result = await runWithProviderKey("tavily", async (key) => {
      attempts.push(key);
      if (attempts.length === 1) throw new ProviderRequestError("limited", { status: 429, retryAfterMs: 1000 });
      return "fallback-key-worked";
    }, { keys: ["primary", "secondary"], sleep: async () => undefined });

    expect(result).toBe("fallback-key-worked");
    expect(attempts).toEqual(["primary", "secondary"]);
    expect(getProviderKeys("gemini", { GEMINI_API_KEY: "one" } as unknown as NodeJS.ProcessEnv)).toEqual(["one"]);
    expect(getProviderKeys("exa", { EXA_API_KEY: "one" } as unknown as NodeJS.ProcessEnv)).toEqual(["one"]);
  });

  it("fails cleanly when every live key is missing", async () => {
    await expect(runWithProviderKey("serpapi", async () => "unused", { keys: [] })).rejects.toMatchObject({
      code: "NOT_CONFIGURED",
    });
  });

  it("does not retry a non-retryable request error", async () => {
    let attempts = 0;
    await expect(runWithProviderKey("gemini", async () => {
      attempts += 1;
      throw new ProviderRequestError("bad body", { status: 400 });
    }, { keys: ["one", "two"], sleep: async () => undefined })).rejects.toThrow("bad body");
    expect(attempts).toBe(1);
  });
});
