import type { EvidenceScore } from "./intake/schema";
import type { LaunchBrief, WorkspaceItem } from "./types";

export function hasIdeaChanged(
  original: { rawIdea: string; targetUser: string; problem: string },
  researched: { rawIdea: string; targetUser: string; problem: string },
) {
  return original.rawIdea !== researched.rawIdea
    || original.targetUser !== researched.targetUser
    || original.problem !== researched.problem;
}

function confidence(value: WorkspaceItem["confidence"]) {
  return value.toLowerCase();
}

export function workspaceRecordsFromBrief(brief: LaunchBrief, evidence: EvidenceScore) {
  const summary = {
    type: "Launch Brief",
    title: brief.refinedIdea.slice(0, 90),
    contentJson: JSON.stringify({ brief, evidence }),
    markdown: `# Launch Brief\n\n${brief.refinedIdea}\n\nEvidence Score: ${evidence.score}/100\n\nCurrent bottleneck: ${brief.currentBottleneck}\n\nNext step: ${brief.nextValidationTask}`,
    sourcesJson: JSON.stringify(evidence.sources),
    confidence: evidence.score >= 80 ? "high" : evidence.score >= 60 ? "medium" : "low",
  };
  const sections = brief.workspace.map((item) => ({
    type: item.type,
    title: item.title,
    contentJson: JSON.stringify(item),
    markdown: `## ${item.type}\n\n### ${item.title}\n\n${item.content}`,
    sourcesJson: JSON.stringify(item.sourceIds || []),
    confidence: confidence(item.confidence),
  }));
  return [summary, ...sections];
}

export function parseWorkspaceItem(record: {
  id: string;
  type: string;
  title: string;
  contentJson: string;
  markdown: string;
  sourcesJson: string;
  confidence: string;
  updatedAt: Date;
}) {
  try {
    if (record.type === "Launch Brief") return null;
    const parsed = JSON.parse(record.contentJson) as WorkspaceItem;
    return { ...parsed, id: record.id, updatedAt: record.updatedAt.toISOString() };
  } catch {
    return {
      id: record.id,
      type: record.type as WorkspaceItem["type"],
      title: record.title,
      content: record.markdown,
      label: "Needs validation" as const,
      confidence: record.confidence === "high" ? "High" as const : record.confidence === "medium" ? "Medium" as const : "Low" as const,
      updatedAt: record.updatedAt.toISOString(),
      sourceIds: JSON.parse(record.sourcesJson || "[]") as string[],
    };
  }
}
