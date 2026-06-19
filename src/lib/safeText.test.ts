import { describe, expect, it } from "vitest";
import { safeJsonStringify, sanitizeExternalText } from "./safeText";

describe("external text sanitization", () => {
  it("removes control characters and malformed surrogate code units before persistence", () => {
    expect(sanitizeExternalText(`safe\u0000text\uD800`)).toBe("safetext");
    expect(() => JSON.parse(safeJsonStringify({ value: `safe\u0000text\uD800` }))).not.toThrow();
  });
});
