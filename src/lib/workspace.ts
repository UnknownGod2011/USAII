import type { EvidenceScore } from "./intake/schema";
import type { LaunchBrief, WorkspaceItem } from "./types";
export function workspaceRecordsFromBrief(brief: LaunchBrief, evidence: EvidenceScore) {
  return [{
    type: "Launch Brief", title: brief.normalizedBrief.cleanStartupTitle.slice(0, 90), contentJson: JSON.stringify({ brief, evidence, normalizedBrief: brief.normalizedBrief }),
    markdown: `# ${brief.normalizedBrief.cleanStartupTitle}\n\n${brief.normalizedBrief.oneLineIdea}\n\nEvidence Score: ${evidence.score}/100\n\nVerdict: ${evidence.verdict.replaceAll("_", " ")}\n\nCurrent bottleneck: ${brief.currentBottleneck}\n\nNext step: ${brief.normalizedBrief.nextBestAction}`,
    sourcesJson: JSON.stringify(evidence.sources), confidence: evidence.score >= 80 ? "high" : evidence.score >= 60 ? "medium" : "low",
  }, ...brief.workspace.map((item) => ({
    type: item.type, title: item.title, contentJson: JSON.stringify(item), markdown: `## ${item.type}\n\n### ${item.title}\n\n${item.content}`,
    sourcesJson: JSON.stringify(item.sourceIds || []), confidence: item.confidence.toLowerCase(),
  }))];
}
export function parseWorkspaceItem(record: { id: string; type: string; title: string; contentJson: string; markdown: string; sourcesJson: string; confidence: string; updatedAt: Date }) {
  if (record.type === "Launch Brief") return null;
  try { return { ...(JSON.parse(record.contentJson) as WorkspaceItem), id: record.id, updatedAt: record.updatedAt.toISOString() }; }
  catch { return { id: record.id, type: record.type as WorkspaceItem["type"], title: record.title, content: record.markdown, label: "Needs validation" as const, confidence: record.confidence === "high" ? "High" as const : record.confidence === "medium" ? "Medium" as const : "Low" as const, updatedAt: record.updatedAt.toISOString(), sourceIds: JSON.parse(record.sourcesJson || "[]") as string[] }; }
}
