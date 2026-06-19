export function sanitizeExternalText(value: string) {
  return value
    .replace(/[\uD800-\uDFFF]/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();
}

export function safeJsonStringify(value: unknown) {
  return JSON.stringify(value, (_key, item) =>
    typeof item === "string" ? sanitizeExternalText(item) : item,
  );
}
