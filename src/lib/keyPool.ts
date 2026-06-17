export function parseGeminiKeyPool(raw = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "") {
  return raw
    .split(/[,\n]/)
    .map((key) => key.trim())
    .filter(Boolean);
}

export function selectGeminiKey(index: number, keys = parseGeminiKeyPool()) {
  if (!keys.length) return null;
  return keys[index % keys.length];
}

export function keyPoolStatus(keys = parseGeminiKeyPool()) {
  return {
    available: keys.length > 0,
    count: keys.length,
    mode: keys.length > 0 ? "env-key-pool" : "ai-unavailable",
  };
}
