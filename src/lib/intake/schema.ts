import { z } from "zod";

export const AnswerValidationSchema = z.object({
  questionId: z.number().int().min(1).max(15),
  originalQuestion: z.string(),
  userAnswer: z.string(),
  expectedField: z.string(),
  isUsable: z.boolean(),
  qualityScore: z.number().min(0).max(1),
  extractedValue: z.unknown(),
  issues: z.array(z.string()),
  followUpQuestion: z.string().optional(),
  normalizedAnswer: z.string(),
  provider: z.enum(["gemini", "deterministic-fallback"]).default("deterministic-fallback"),
});
export type AnswerValidation = z.infer<typeof AnswerValidationSchema>;

export const FounderIntakeSchema = z.object({
  name: z.string().min(2),
  locationCountry: z.string().min(2),
  locationCity: z.string().optional(),
  status: z.string().min(2),
  hoursPerWeek: z.number().min(0).max(168),
  budget: z.string().min(2),
  skills: z.array(z.string()),
  teamStatus: z.string().min(2),
  stage: z.enum(["no idea yet", "rough idea", "started building", "MVP exists", "users exist", "revenue exists"]),
  rawIdea: z.string().min(2),
  targetUser: z.string().min(2),
  problem: z.string().min(2),
  evidenceLevel: z.string().min(2),
  alternatives: z.string().min(2),
  thirtyDayGoal: z.string().min(2),
  openToModification: z.boolean(),
  accessibleCommunities: z.string().optional(),
  noticedProblems: z.string().optional(),
  reachableUsers: z.string().optional(),
  transcript: z.array(z.string()).default([]),
  answerValidations: z.array(AnswerValidationSchema).default([]),
  skippedOrUnclearFields: z.array(z.string()).default([]),
});
export type FounderIntake = z.infer<typeof FounderIntakeSchema>;

export const ResearchSourceSchema = z.object({
  id: z.string().optional(),
  title: z.string(),
  url: z.string(),
  snippet: z.string(),
  sourceType: z.enum(["official", "competitor", "community_signal", "review", "market_report", "blog", "dataset", "fallback"]),
  supports: z.string(),
  limitation: z.string(),
  confidence: z.enum(["low", "medium", "high"]),
  provider: z.enum(["gemini_grounding", "google", "tavily", "exa", "serpapi", "public_api", "direct", "offline"]).default("offline"),
  query: z.string().optional(),
  verified: z.boolean().default(false),
  relevanceScore: z.number().min(0).max(1).default(0),
  qualityScore: z.number().min(0).max(1).default(0),
});
export type ResearchSource = z.infer<typeof ResearchSourceSchema>;

export const EvidenceClaimSchema = z.object({
  id: z.string(),
  claim: z.string(),
  category: z.enum(["problem", "target_user", "demand", "competitor", "pricing", "feasibility", "opportunity", "risk"]),
  evidenceType: z.enum(["founder_statement", "official", "competitor_primary", "review", "community_signal", "market_report", "dataset", "inference"]),
  sourceIds: z.array(z.string()),
  support: z.enum(["supports", "contradicts", "context_only"]),
  confidence: z.enum(["low", "medium", "high"]),
  limitation: z.string(),
  relevanceScore: z.number().min(0).max(1),
  qualityScore: z.number().min(0).max(1),
});
export type EvidenceClaim = z.infer<typeof EvidenceClaimSchema>;

export const EvidenceScoreSchema = z.object({
  score: z.number().min(0).max(100),
  verdict: z.enum(["strong", "promising_needs_modification", "weak", "reject"]),
  reasoning: z.string(),
  strongestSignal: z.string(),
  weakestSignal: z.string(),
  whatCouldBeWrong: z.string(),
  nextValidationStep: z.string(),
  breakdown: z.object({
    problemPainClarity: z.number().min(0).max(20),
    targetUserSharpness: z.number().min(0).max(15),
    demandEvidence: z.number().min(0).max(20),
    competitorGap: z.number().min(0).max(15),
    feasibility: z.number().min(0).max(15),
    founderMarketFit: z.number().min(0).max(10),
    riskLevel: z.number().min(0).max(5),
  }),
  sources: z.array(ResearchSourceSchema),
  researchMode: z.enum(["live", "hybrid", "fallback"]),
  evidenceByDimension: z.record(z.string(), z.array(z.string())).default({}),
  scoreCapReason: z.string().optional(),
});
export type EvidenceScore = z.infer<typeof EvidenceScoreSchema>;

export type IdeaRevision = {
  improvedIdea: string;
  targetUser: string;
  problem: string;
  whyStronger: string;
  whatChanged: string;
  remainingRisk: string;
};
