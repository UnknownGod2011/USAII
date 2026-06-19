export {
  getProviderKeys as parseProviderKeys,
  getProviderPoolStatus,
  runWithProviderKey,
} from "./providers/keyPool";

export function parseGeminiKeyPool() {
  return (process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "")
    .split(/[,\n]/).map((key) => key.trim()).filter(Boolean);
}

export function selectGeminiKey(index: number, keys = parseGeminiKeyPool()) {
  return keys.length ? keys[index % keys.length] : null;
}

export function keyPoolStatus(keys = parseGeminiKeyPool()) {
  return { available: keys.length > 0, count: keys.length, mode: keys.length > 1 ? "rotating-pool" : keys.length ? "single-key" : "deterministic-fallback" };
}
