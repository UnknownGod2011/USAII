const CJK_SCRIPT = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]/gu;
const LATIN_LETTER = /[a-z]/giu;

export function isUnexpectedTranscriptScript(text: string): boolean {
  const compact = text.replace(/\s+/g, "");
  if (compact.length < 2) return false;

  const cjkCount = compact.match(CJK_SCRIPT)?.length ?? 0;
  const latinCount = compact.match(LATIN_LETTER)?.length ?? 0;

  return cjkCount >= 2 && cjkCount > latinCount;
}
