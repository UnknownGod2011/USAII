export type EvidenceLabel =
  | "Verified"
  | "Inferred"
  | "Approximate"
  | "Needs validation"
  | "AI may be wrong"
  | "Fallback analysis"
  | "Official source"
  | "Community signal"
  | "Framework-based";

export type IdeaStage = "no idea yet" | "rough idea" | "started building" | "MVP already exists";

export type FounderProfile = {
  name: string;
  location: string;
  status: string;
  ageRange?: string;
  hoursPerWeek: number;
  budget: string;
  skills: string[];
  teamStatus: string;
  ideaStage: IdeaStage;
  rawIdea: string;
  targetUser: string;
  whyItMatters: string;
  currentAlternatives?: string;
  evidence: string[];
  traction: string;
  willingnessToLearn: string;
  riskTolerance: string;
  success30Days: string;
};

export type Source = {
  id: string;
  title: string;
  url: string;
  type: string;
  label: EvidenceLabel;
  snippet?: string;
  fetchedAt?: string;
  provider?: "gemini_grounding" | "google" | "tavily" | "exa" | "serpapi" | "public_api" | "direct" | "offline";
  query?: string;
  verified?: boolean;
  relevanceScore?: number;
  qualityScore?: number;
  limitation?: string;
};

export type ReasoningCard = {
  recommendation: string;
  why: string;
  evidenceUsed: string[];
  assumptions: string[];
  confidence: "Low" | "Medium" | "High";
  whatCouldBeWrong: string;
  howToValidate: string;
};

export type WorkspaceItem = {
  id: string;
  type:
    | "Founder Snapshot"
    | "Refined Idea"
    | "Research Notes"
    | "Competitors / Alternatives"
    | "Assumptions"
    | "Risks"
    | "MVP Plan"
    | "Current Bottleneck"
    | "Founder Reality Check"
    | "Roadmap"
    | "Pitch Assets"
    | "Opportunity Cards"
    | "Saved Decisions"
    | "Sources";
  title: string;
  content: string;
  label: EvidenceLabel;
  confidence: "Low" | "Medium" | "High";
  updatedAt: string;
  sourceIds?: string[];
};

export type AgentOutput = {
  name: string;
  role: string;
  status: "Planned" | "Running" | "Complete";
  liveSteps?: string[];
  finding: string;
  whyItMatters: string;
  label: EvidenceLabel;
  confidence: "Low" | "Medium" | "High";
  reasoning: ReasoningCard;
  plan?: string[];
  sources?: Source[];
  evidenceClaimIds?: string[];
};

export type FounderScore = {
  feasibility: number;
  marketOpportunity: number;
  executionDifficulty: number;
  founderFit: number;
  overall: number;
  label: string;
  notes: string[];
};

export type ResearchPack = {
  mode: "live" | "hybrid" | "fallback";
  fetchedAt: string;
  logs: string[];
  plan: {
    id: string;
    query: string;
    category: "problem" | "demand" | "competitor" | "pricing" | "opportunity" | "feasibility";
    purpose: string;
    preferredSources: string[];
  }[];
  sources: Source[];
  evidenceClaims: import("./intake/schema").EvidenceClaim[];
  competitors: string[];
  marketSignals: string[];
  opportunities: string[];
  skillResources: string[];
  aiSummary?: string;
};

export type LaunchBrief = {
  profile: FounderProfile;
  refinedIdea: string;
  problem: string;
  targetUser: string;
  readinessLabel:
    | "Explore more"
    | "Problem-validation ready"
    | "Prototype-ready"
    | "Pilot-ready"
    | "Fundraising is premature"
    | "Funding-readiness possible later";
  currentBottleneck: string;
  founderScore: FounderScore;
  strongestPoint: string;
  weakestPoint: string;
  nextValidationTask: string;
  competitors: string[];
  opportunities: string[];
  assumptions: string[];
  risks: string[];
  mvpScope: string[];
  roadmap: { horizon: string; actions: string[] }[];
  skillGaps: string[];
  pitchAssets: {
    oneLinePitch: string;
    elevatorPitch: string;
    problemStatement: string;
    interviewMessage: string;
    landingHeadline: string;
    deckOutline: string[];
  };
  responsibleAINotes: string[];
  research: ResearchPack;
  evidenceScore?: import("./intake/schema").EvidenceScore;
  sources: Source[];
  agents: AgentOutput[];
  workspace: WorkspaceItem[];
};
