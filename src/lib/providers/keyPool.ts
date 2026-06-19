export type ProviderName = "gemini" | "tavily" | "exa" | "serpapi" | "google";

type ProviderEnv = {
  singular: string;
  plural: string;
};

type FailureKind = "auth" | "quota" | "rate_limit" | "transient" | "invalid_request" | "unknown";

export type ProviderFailure = {
  kind: FailureKind;
  retryable: boolean;
  cooldownMs: number;
  status?: number;
};

export class ProviderRequestError extends Error {
  status?: number;
  retryAfterMs?: number;
  code?: string;

  constructor(message: string, options: { status?: number; retryAfterMs?: number; code?: string } = {}) {
    super(message);
    this.name = "ProviderRequestError";
    this.status = options.status;
    this.retryAfterMs = options.retryAfterMs;
    this.code = options.code;
  }
}

const providerEnv: Record<ProviderName, ProviderEnv> = {
  gemini: { singular: "GEMINI_API_KEY", plural: "GEMINI_API_KEYS" },
  tavily: { singular: "TAVILY_API_KEY", plural: "TAVILY_API_KEYS" },
  exa: { singular: "EXA_API_KEY", plural: "EXA_API_KEYS" },
  serpapi: { singular: "SERPAPI_API_KEY", plural: "SERPAPI_API_KEYS" },
  google: { singular: "GOOGLE_SEARCH_API_KEY", plural: "GOOGLE_SEARCH_API_KEYS" },
};

type PoolState = {
  cursor: Partial<Record<ProviderName, number>>;
  cooldowns: Map<string, number>;
};

const globalPoolState = globalThis as typeof globalThis & { __launchPilotProviderPool?: PoolState };
const state = globalPoolState.__launchPilotProviderPool || {
  cursor: {},
  cooldowns: new Map<string, number>(),
};
globalPoolState.__launchPilotProviderPool = state;

function parseKeys(value: string | undefined) {
  return (value || "")
    .split(/[,\n]/)
    .map((key) => key.trim())
    .filter(Boolean);
}

export function getProviderKeys(provider: ProviderName, env: NodeJS.ProcessEnv = process.env) {
  const names = providerEnv[provider];
  const pooled = parseKeys(env[names.plural]);
  return pooled.length ? pooled : parseKeys(env[names.singular]);
}

export function getProviderPoolStatus(provider: ProviderName, env: NodeJS.ProcessEnv = process.env) {
  const keys = getProviderKeys(provider, env);
  return {
    available: keys.length > 0,
    count: keys.length,
    mode: keys.length > 1 ? "rotating-pool" : keys.length === 1 ? "single-key" : "unavailable",
  };
}

function statusFromError(error: unknown) {
  if (error instanceof ProviderRequestError) return error.status;
  if (error && typeof error === "object" && "status" in error && typeof error.status === "number") return error.status;
  return undefined;
}

export function classifyProviderError(provider: ProviderName, error: unknown): ProviderFailure {
  const status = statusFromError(error);
  const retryAfterMs = error instanceof ProviderRequestError ? error.retryAfterMs : undefined;
  const message = error instanceof Error ? error.message.toLowerCase() : "";

  if (status === 401 || status === 403 || /invalid api key|api key not valid|unauthorized|authentication/.test(message)) {
    return { kind: "auth", retryable: true, cooldownMs: 15 * 60_000, status };
  }
  if (
    status === 402
    || (provider === "tavily" && (status === 432 || status === 433))
    || /quota|credit|billing|exhausted|monthly searches/.test(message)
  ) {
    return { kind: "quota", retryable: true, cooldownMs: 10 * 60_000, status };
  }
  if (status === 429 || /rate limit|too many requests|throughput/.test(message)) {
    return { kind: "rate_limit", retryable: true, cooldownMs: retryAfterMs || 45_000, status };
  }
  if ((status && status >= 500) || /timeout|fetch failed|network|socket|aborted/.test(message)) {
    return { kind: "transient", retryable: true, cooldownMs: 8_000, status };
  }
  if (status && status >= 400 && status < 500) {
    return { kind: "invalid_request", retryable: false, cooldownMs: 0, status };
  }
  return { kind: "unknown", retryable: false, cooldownMs: 0, status };
}

function cooldownId(provider: ProviderName, index: number) {
  return `${provider}:${index}`;
}

function orderedIndexes(provider: ProviderName, keyCount: number, now: number) {
  const start = (state.cursor[provider] || 0) % keyCount;
  const indexes = Array.from({ length: keyCount }, (_, offset) => (start + offset) % keyCount);
  return indexes.filter((index) => (state.cooldowns.get(cooldownId(provider, index)) || 0) <= now);
}

function defaultSleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runWithProviderKey<T>(
  provider: ProviderName,
  operation: (key: string, attempt: number) => Promise<T>,
  options: {
    keys?: string[];
    now?: () => number;
    sleep?: (ms: number) => Promise<void>;
    maxAttempts?: number;
  } = {},
) {
  const keys = options.keys || getProviderKeys(provider);
  if (!keys.length) throw new ProviderRequestError(`${provider} is not configured`, { code: "NOT_CONFIGURED" });

  const now = options.now || Date.now;
  const sleep = options.sleep || defaultSleep;
  const order = orderedIndexes(provider, keys.length, now());
  if (!order.length) throw new ProviderRequestError(`${provider} key pool is cooling down`, { code: "POOL_COOLDOWN" });
  const maxAttempts = Math.max(1, Math.min(options.maxAttempts || keys.length, keys.length));
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const index = order[attempt % order.length];
    try {
      const result = await operation(keys[index], attempt);
      state.cooldowns.delete(cooldownId(provider, index));
      state.cursor[provider] = (index + 1) % keys.length;
      return result;
    } catch (error) {
      lastError = error;
      const failure = classifyProviderError(provider, error);
      if (failure.cooldownMs) state.cooldowns.set(cooldownId(provider, index), now() + failure.cooldownMs);
      if (!failure.retryable || attempt + 1 >= maxAttempts) break;
      const delay = Math.min(failure.cooldownMs, 250 * (2 ** attempt), 2_000);
      if (delay > 0) await sleep(delay);
    }
  }

  throw lastError instanceof Error ? lastError : new ProviderRequestError(`${provider} request failed`);
}

export function providerErrorFromResponse(provider: ProviderName, response: Response, detail?: string) {
  const retryAfter = response.headers.get("retry-after");
  const parsedRetryAfter = retryAfter ? Number(retryAfter) : Number.NaN;
  const retryAfterMs = Number.isFinite(parsedRetryAfter) ? parsedRetryAfter * 1000 : undefined;
  return new ProviderRequestError(
    detail || `${provider} request failed`,
    { status: response.status, retryAfterMs },
  );
}

export function resetProviderPoolStateForTests() {
  state.cursor = {};
  state.cooldowns.clear();
}
