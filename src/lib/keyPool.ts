import { getProviderKeys, getProviderPoolStatus } from "./providers/keyPool";

export function parseGeminiKeyPool(raw?: string) {
  if (raw !== undefined) {
    return raw.split(/[,\n]/).map((key) => key.trim()).filter(Boolean);
  }
  return getProviderKeys("gemini");
}

export function selectGeminiKey(index: number, keys = getProviderKeys("gemini")) {
  if (!keys.length) return null;
  return keys[index % keys.length];
}

export function keyPoolStatus(keys?: string[]) {
  if (keys !== undefined) {
    return {
      available: keys.length > 0,
      count: keys.length,
      mode: keys.length > 1 ? "rotating-pool" : keys.length === 1 ? "single-key" : "deterministic-fallback",
    };
  }
  const status = getProviderPoolStatus("gemini");
  return {
    available: status.available,
    count: status.count,
    mode: status.mode,
  };
}

export {
  classifyProviderError,
  getProviderKeys,
  getProviderPoolStatus,
  providerErrorFromResponse,
  ProviderRequestError,
  resetProviderPoolStateForTests,
  runWithProviderKey,
} from "./providers/keyPool";
