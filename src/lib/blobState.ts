import { del, get, put } from "@vercel/blob";
import { randomUUID } from "node:crypto";

export type StoredUser = { id: string; name: string; email: string };

export type StoredIntake = {
  id: string;
  userId: string;
  data: unknown;
  createdAt: string;
  updatedAt: string;
};

export type StoredIdea = {
  id: string;
  userId: string;
  intakeId: string;
  name: string;
  originalIdea: string;
  finalizedIdea: string;
  targetUser: string;
  problemStatement: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type StoredResearchRun = {
  id: string;
  userId: string;
  startupIdeaId: string;
  status: string;
  evidenceScore: number;
  verdict: string;
  strongestSignal: string;
  weakestSignal: string;
  reasoning: string;
  whatCouldBeWrong: string;
  nextValidationStep: string;
  fallbackUsed: boolean;
  breakdownJson: string;
  intakeJson: string;
  researchPlanJson: string;
  evidenceClaimsJson: string;
  logsJson: string;
  packJson: string;
  scoreJson: string;
  sources: StoredResearchSource[];
  createdAt: string;
  updatedAt: string;
};

export type StoredResearchSource = {
  id: string;
  researchRunId: string;
  title: string;
  url: string;
  snippet: string;
  sourceType: string;
  supports: string;
  limitation: string;
  confidence: string;
  provider: string;
  query?: string;
  verified: boolean;
  relevanceScore: number;
  qualityScore: number;
  createdAt: string;
};

export type StoredWorkspaceItem = {
  id: string;
  userId: string;
  startupIdeaId: string;
  type: string;
  title: string;
  contentJson: string;
  markdown: string;
  sourcesJson: string;
  confidence: string;
  stale: boolean;
  createdAt: string;
  updatedAt: string;
};

export type StoredAgentRun = {
  id: string;
  userId: string;
  startupIdeaId: string;
  agentName: string;
  status: string;
  btsLinesJson: string;
  outputJson: string;
  sourcesJson: string;
  createdAt: string;
  updatedAt: string;
};

export type StoredChatMessage = {
  id: string;
  userId: string;
  startupIdeaId: string;
  role: string;
  content: string;
  metadataJson: string;
  createdAt: string;
};

export type UserState = {
  user: StoredUser;
  intakes: StoredIntake[];
  ideas: StoredIdea[];
  researchRuns: StoredResearchRun[];
  workspaceItems: StoredWorkspaceItem[];
  agentRuns: StoredAgentRun[];
  chatMessages: StoredChatMessage[];
};

export function productionBlobStateEnabled() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN && process.env.VERCEL);
}

export function nowIso() {
  return new Date().toISOString();
}

export function newId(prefix: string) {
  return `${prefix}_${randomUUID().replace(/-/g, "")}`;
}

const pathnameFor = (userId: string) => `launchpilot/state/${encodeURIComponent(userId)}.json`;

function emptyState(user: StoredUser): UserState {
  return { user, intakes: [], ideas: [], researchRuns: [], workspaceItems: [], agentRuns: [], chatMessages: [] };
}

async function readJsonFromBlob<T>(pathname: string): Promise<T | null> {
  const blob = await get(pathname, { access: "private", token: process.env.BLOB_READ_WRITE_TOKEN });
  if (!blob?.stream) return null;
  const text = await new Response(blob.stream).text();
  return JSON.parse(text) as T;
}

export async function loadUserState(user: StoredUser): Promise<UserState> {
  if (!productionBlobStateEnabled()) return emptyState(user);
  try {
    const saved = await readJsonFromBlob<UserState>(pathnameFor(user.id));
    if (!saved) return emptyState(user);
    return { ...emptyState(user), ...saved, user: { ...saved.user, ...user } };
  } catch {
    return emptyState(user);
  }
}

export async function saveUserState(state: UserState) {
  if (!productionBlobStateEnabled()) return state;
  await put(pathnameFor(state.user.id), JSON.stringify(state), {
    access: "private",
    allowOverwrite: true,
    contentType: "application/json",
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });
  return state;
}

export async function deleteUserState(userId: string) {
  if (!productionBlobStateEnabled()) return;
  await del(pathnameFor(userId), { token: process.env.BLOB_READ_WRITE_TOKEN }).catch(() => undefined);
}

export function latestByUpdatedAt<T extends { updatedAt: string }>(items: T[]) {
  return [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] || null;
}

export function latestResearchRun(state: UserState, startupIdeaId: string) {
  return latestByUpdatedAt(state.researchRuns.filter((run) => run.startupIdeaId === startupIdeaId));
}
