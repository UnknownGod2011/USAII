export type ProviderName = "gemini" | "tavily" | "exa" | "serpapi" | "google";
type FailureKind = "auth" | "quota" | "rate_limit" | "transient" | "invalid_request" | "unknown";
export type ProviderFailure = { kind: FailureKind; retryable: boolean; cooldownMs: number; status?: number };

export class ProviderRequestError extends Error {
  status?: number;
  retryAfterMs?: number;
  code?: string;
  constructor(message: string, options: { status?: number; retryAfterMs?: number; code?: string } = {}) {
    super(message);
    this.name = "ProviderRequestError";
    Object.assign(this, options);
  }
}

const names: Record<ProviderName, { singular: string; plural: string }> = {
  gemini: { singular: "GEMINI_API_KEY", plural: "GEMINI_API_KEYS" },
  tavily: { singular: "TAVILY_API_KEY", plural: "TAVILY_API_KEYS" },
  exa: { singular: "EXA_API_KEY", plural: "EXA_API_KEYS" },
  serpapi: { singular: "SERPAPI_API_KEY", plural: "SERPAPI_API_KEYS" },
  google: { singular: "GOOGLE_SEARCH_API_KEY", plural: "GOOGLE_SEARCH_API_KEYS" },
};
const state = (globalThis as typeof globalThis & { __lpPool?: { cursor: Partial<Record<ProviderName, number>>; cooldowns: Map<string, number> } }).__lpPool
  ||= { cursor: {}, cooldowns: new Map<string, number>() };
const parse = (value?: string) => (value || "").split(/[,\n]/).map((key) => key.trim()).filter(Boolean);

export function getProviderKeys(provider: ProviderName, env: NodeJS.ProcessEnv = process.env) {
  const pool = parse(env[names[provider].plural]);
  return pool.length ? pool : parse(env[names[provider].singular]);
}
export function getProviderPoolStatus(provider: ProviderName, env: NodeJS.ProcessEnv = process.env) {
  const count = getProviderKeys(provider, env).length;
  return { available: count > 0, count, mode: count > 1 ? "rotating-pool" : count ? "single-key" : "unavailable" };
}
export function classifyProviderError(provider: ProviderName, error: unknown): ProviderFailure {
  const status = error instanceof ProviderRequestError ? error.status : error && typeof error === "object" && "status" in error ? Number(error.status) : undefined;
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (status === 401 || status === 403 || /invalid api key|unauthorized|authentication/.test(message)) return { kind: "auth", retryable: true, cooldownMs: 900_000, status };
  if (status === 402 || (provider === "tavily" && (status === 432 || status === 433)) || /quota|credit|billing|exhausted/.test(message)) return { kind: "quota", retryable: true, cooldownMs: 600_000, status };
  if (status === 429 || /rate limit|too many requests/.test(message)) return { kind: "rate_limit", retryable: true, cooldownMs: error instanceof ProviderRequestError && error.retryAfterMs || 45_000, status };
  if ((status && status >= 500) || /timeout|network|fetch failed|aborted/.test(message)) return { kind: "transient", retryable: true, cooldownMs: 8_000, status };
  if (status && status >= 400) return { kind: "invalid_request", retryable: false, cooldownMs: 0, status };
  return { kind: "unknown", retryable: false, cooldownMs: 0, status };
}
export async function runWithProviderKey<T>(provider: ProviderName, operation: (key: string, attempt: number) => Promise<T>, options: { keys?: string[]; sleep?: (ms: number) => Promise<void>; maxAttempts?: number } = {}) {
  const keys = options.keys || getProviderKeys(provider);
  if (!keys.length) throw new ProviderRequestError(`${provider} is not configured`, { code: "NOT_CONFIGURED" });
  const now = Date.now();
  const start = (state.cursor[provider] || 0) % keys.length;
  const order = Array.from({ length: keys.length }, (_, offset) => (start + offset) % keys.length)
    .filter((index) => (state.cooldowns.get(`${provider}:${index}`) || 0) <= now);
  if (!order.length) throw new ProviderRequestError(`${provider} key pool is cooling down`, { code: "POOL_COOLDOWN" });
  let last: unknown;
  for (let attempt = 0; attempt < Math.min(options.maxAttempts || keys.length, order.length); attempt += 1) {
    const index = order[attempt];
    try {
      const result = await operation(keys[index], attempt);
      state.cooldowns.delete(`${provider}:${index}`);
      state.cursor[provider] = (index + 1) % keys.length;
      return result;
    } catch (error) {
      last = error;
      const failure = classifyProviderError(provider, error);
      if (failure.cooldownMs) state.cooldowns.set(`${provider}:${index}`, Date.now() + failure.cooldownMs);
      if (!failure.retryable || attempt + 1 >= order.length) break;
      await (options.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms))))(Math.min(2_000, 250 * 2 ** attempt));
    }
  }
  throw last instanceof Error ? last : new ProviderRequestError(`${provider} request failed`);
}
export function providerErrorFromResponse(provider: ProviderName, response: Response, detail?: string) {
  const seconds = Number(response.headers.get("retry-after"));
  return new ProviderRequestError(detail || `${provider} request failed`, { status: response.status, retryAfterMs: Number.isFinite(seconds) ? seconds * 1000 : undefined });
}
export function resetProviderPoolStateForTests() { state.cursor = {}; state.cooldowns.clear(); }
