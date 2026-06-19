import { describe, expect, it } from "vitest";
import { isUnexpectedTranscriptScript } from "./transcriptGuard";

describe("isUnexpectedTranscriptScript", () => {
  it("keeps English founder answers", () => {
    expect(isUnexpectedTranscriptScript("I want to build an AI T-shirt design workspace.")).toBe(false);
    expect(isUnexpectedTranscriptScript("No proof yet.")).toBe(false);
  });

  it("rejects transcripts dominated by an unexpected CJK script", () => {
    expect(isUnexpectedTranscriptScript("这是一个错误的转录")).toBe(true);
    expect(isUnexpectedTranscriptScript("テスト音声です")).toBe(true);
  });

  it("does not reject a short accidental symbol", () => {
    expect(isUnexpectedTranscriptScript("AI 设计")).toBe(false);
  });
});
