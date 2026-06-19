import { normalizeFounderBrief } from "./brief/normalize";
import { isIrrelevantFounderQuestion, redirectMessage, sanitizeAdvisorResponse } from "./guardrails";
import type { EvidenceClaim, EvidenceScore } from "./intake/schema";
import type { AgentOutput, FounderProfile, LaunchBrief, ReasoningCard, ResearchPack, WorkspaceItem } from "./types";

const now = () => new Date().toISOString();

export const LAUNCHPILOT_AGENT_NAMES = [
  "Market Reality Agent",
  "Assumption & Risk Agent",
  "MVP Scope Agent",
  "Roadmap Agent",
  "Opportunity Agent",
  "Pitch & Communication Agent",
] as const;

export const AGENT_PROGRESS_LINES: Record<(typeof LAUNCHPILOT_AGENT_NAMES)[number], string[]> = {
  "Market Reality Agent": [
    "Reviewing market sources and current alternatives.",
    "Separating direct competitors from indirect workarounds.",
    "Finding the strongest positioning gap.",
  ],
  "Assumption & Risk Agent": [
    "Identifying assumptions that could invalidate the idea.",
    "Converting risks into user tests.",
    "Ranking tests by urgency.",
  ],
  "MVP Scope Agent": [
    "Reducing the product to one testable workflow.",
    "Separating must-have features from distractions.",
    "Designing a manual pilot before full automation.",
  ],
  "Roadmap Agent": [
    "Building a 24-hour founder action plan.",
    "Mapping a 7-day validation sprint.",
    "Defining stop and pivot criteria.",
  ],
  "Opportunity Agent": [
    "Checking founder support paths.",
    "Avoiding premature investor recommendations.",
    "Marking eligibility as unverified unless sourced.",
  ],
  "Pitch & Communication Agent": [
    "Turning the validated thesis into founder messaging.",
    "Writing an interview message that does not sell.",
    "Creating evidence-safe pitch assets.",
  ],
};

const defaultResearch = (): ResearchPack => ({
  mode: "fallback",
  fetchedAt: new Date().toISOString(),
  logs: ["Live research unavailable. Limited offline analysis prepared."],
  plan: [],
  sources: [{
    id: "offline",
    title: "Limited offline analysis",
    url: "",
    type: "fallback",
    label: "Fallback analysis",
    snippet: "Live research is unavailable right now, so LaunchPilot used a limited offline analysis. Validate these findings before making decisions.",
    provider: "offline",
    verified: false,
    relevanceScore: 0,
    qualityScore: 0.1,
    limitation: "No external source was retrieved.",
  }],
  evidenceClaims: [],
  competitors: [],
  marketSignals: [],
  opportunities: [],
  skillResources: [],
});

const confidence = (claims: EvidenceClaim[]) =>
  claims.some((claim) => claim.confidence === "high") ? "High" as const : claims.some((claim) => claim.confidence === "medium") ? "Medium" as const : "Low" as const;

const relevantClaims = (research: ResearchPack, categories: EvidenceClaim["category"][]) =>
  research.evidenceClaims.filter((claim) => categories.includes(claim.category));

const sourcesFor = (research: ResearchPack, claims: EvidenceClaim[]) => {
  const ids = new Set(claims.flatMap((claim) => claim.sourceIds));
  return research.sources.filter((source) => ids.has(source.id));
};

function reasoning(recommendation: string, why: string, claims: EvidenceClaim[], assumptions: string[], howToValidate: string): ReasoningCard {
  return {
    recommendation,
    why,
    evidenceUsed: claims.length ? claims.map((claim) => claim.claim) : ["Founder intake, constraints, and retained source context"],
    assumptions,
    confidence: confidence(claims),
    whatCouldBeWrong: claims.length
      ? claims.map((claim) => claim.limitation).slice(0, 2).join(" ")
      : "The source set may be incomplete or the exact first user segment may behave differently.",
    howToValidate,
  };
}

function scoreFromProfile(profile: FounderProfile, evidence?: EvidenceScore) {
  const feasibility = evidence?.breakdown.feasibility ?? Math.min(80, 35 + profile.hoursPerWeek * 2 + profile.skills.length * 5);
  const marketOpportunity = evidence ? Math.round((evidence.breakdown.demandEvidence + evidence.breakdown.competitorGap) / 35 * 100) : 45;
  const founderFit = evidence ? Math.round(evidence.breakdown.founderMarketFit / 10 * 100) : 50;
  const overall = evidence?.score ?? Math.round((feasibility + marketOpportunity + founderFit) / 3);
  return {
    feasibility,
    marketOpportunity,
    executionDifficulty: Math.max(20, 100 - feasibility),
    founderFit,
    overall,
    label: evidence?.verdict.replaceAll("_", " ") || "Validation required",
    notes: [
      "This is an evidence-readiness score, not a prediction of startup success.",
      evidence?.scoreCapReason || "Improve it with direct user behavior, not longer answers.",
    ],
  };
}

function toWorkspace(type: WorkspaceItem["type"], title: string, content: string, confidenceValue: WorkspaceItem["confidence"], label: WorkspaceItem["label"], sourceIds?: string[]): WorkspaceItem {
  return { id: type.toLowerCase().replace(/[^a-z0-9]+/g, "-"), type, title, content, label, confidence: confidenceValue, updatedAt: now(), sourceIds };
}

function agentByName(name: (typeof LAUNCHPILOT_AGENT_NAMES)[number], briefContext: {
  profile: FounderProfile;
  research: ResearchPack;
  evidence?: EvidenceScore;
  normalized: ReturnType<typeof normalizeFounderBrief>;
  assumptions: string[];
  risks: string[];
}): AgentOutput {
  const { research, evidence, normalized, assumptions } = briefContext;
  const demand = relevantClaims(research, ["problem", "demand"]);
  const competitorClaims = relevantClaims(research, ["competitor", "pricing"]);
  const feasibilityClaims = relevantClaims(research, ["feasibility", "risk"]);
  const opportunityClaims = relevantClaims(research, ["opportunity"]);
  const bottleneck = evidence?.scoreCapReason?.includes("direct user") ? "Demand evidence" : evidence?.weakestSignal || normalized.researchFocus;
  const sourceSubset = (claims: EvidenceClaim[]) => sourcesFor(research, claims).slice(0, 5);
  const common = {
    status: "Complete" as const,
    liveSteps: AGENT_PROGRESS_LINES[name],
  };

  if (name === "Market Reality Agent") {
    const noDirect = normalized.noDirectCompetitorMessage;
    return {
      ...common,
      name,
      role: "Maps direct competitors, adjacent alternatives, and the positioning gap.",
      finding: noDirect || normalized.marketRealitySummary,
      whyItMatters: "A founder needs to beat what users already do, not a generic category.",
      label: research.mode === "fallback" ? "Fallback analysis" : "Verified",
      confidence: normalized.directCompetitors.length ? "Medium" : "Low",
      reasoning: reasoning(
        `${normalized.firstValidationStep} In each interview, ask which alternative was used last, what the handoff required, and what still took too long.`,
        "Sources and founder-reported alternatives were separated so articles and repositories are not treated as market competitors.",
        competitorClaims,
        [assumptions[0]],
        normalized.firstValidationStep,
      ),
      plan: [
        normalized.marketRealitySummary,
        normalized.positioning,
        "Ask users which alternative they used in their most recent workflow.",
      ],
      sources: sourceSubset(competitorClaims),
      evidenceClaimIds: competitorClaims.map((claim) => claim.id),
    };
  }

  if (name === "Assumption & Risk Agent") {
    return {
      ...common,
      name,
      role: "Turns uncertainty into falsifiable founder tests.",
      finding: `Highest-priority assumption: ${normalized.riskRegister[0]?.assumption || assumptions[0]}`,
      whyItMatters: "A strong early roadmap should reduce the weakest evidence, not add features.",
      label: "Needs validation",
      confidence: "High",
      reasoning: reasoning(
        `${normalized.firstValidationStep} Record recent behavior, time lost, and a concrete success signal before asking whether users like the concept.`,
        evidence?.weakestSignal || "The evidence is still pre-validation.",
        demand,
        assumptions,
        normalized.firstValidationStep,
      ),
      plan: normalized.riskRegister.map((risk) => `${risk.riskLevel}: ${risk.assumption} -> ${risk.test}`),
      sources: sourceSubset(demand),
      evidenceClaimIds: demand.map((claim) => claim.id),
    };
  }

  if (name === "MVP Scope Agent") {
    return {
      ...common,
      name,
      role: "Defines the smallest testable workflow and explicit non-goals.",
      finding: normalized.mvpPlan.manualPilot,
      whyItMatters: "The MVP should test the value proposition, not imitate a complete company.",
      label: "Framework-based",
      confidence: "High",
      reasoning: reasoning(
        `Run this pilot before expanding scope: ${normalized.mvpPlan.manualPilot} Measure it with: ${normalized.mvpPlan.successMetric}`,
        `Founder constraints: ${normalized.founderConstraints.join("; ")}.`,
        feasibilityClaims,
        [assumptions[1] || "The first outcome can be delivered manually."],
        normalized.mvpPlan.successMetric,
      ),
      plan: [...normalized.mvpPlan.mustHave, `Do not build yet: ${normalized.mvpPlan.doNotBuildYet.join(", ")}`],
      sources: sourceSubset(feasibilityClaims),
      evidenceClaimIds: feasibilityClaims.map((claim) => claim.id),
    };
  }

  if (name === "Roadmap Agent") {
    return {
      ...common,
      name,
      role: "Creates a bottleneck-first 24-hour, 7-day, 30-day, and 90-day plan.",
      finding: `Current bottleneck: ${bottleneck}. Next action: ${normalized.nextBestAction}`,
      whyItMatters: "The roadmap should move the weakest evidence dimension first.",
      label: "Framework-based",
      confidence: "High",
      reasoning: reasoning(
        `Start today with: ${normalized.nextBestAction} Use the 7-day sprint to change ${bottleneck.toLowerCase()}, not to add features.`,
        evidence?.reasoning || "Evidence remains limited, so the roadmap stays conservative.",
        research.evidenceClaims,
        assumptions,
        normalized.nextBestAction,
      ),
      plan: [
        ...normalized.roadmapPlan.next24Hours.map((item) => `24h: ${item}`),
        ...normalized.roadmapPlan.sevenDaySprint.map((item) => `7d: ${item}`),
        `Stop/pivot: ${normalized.roadmapPlan.stopPivotCriteria}`,
      ],
      sources: research.sources.slice(0, 5),
      evidenceClaimIds: research.evidenceClaims.map((claim) => claim.id),
    };
  }

  if (name === "Opportunity Agent") {
    return {
      ...common,
      name,
      role: "Finds support programs and communities without overstating eligibility.",
      finding: `${normalized.opportunities.map((item) => item.name).join(", ") || "No sourced program was retained."}. Investor outreach is premature until validation improves.`,
      whyItMatters: "Programs can support execution, but they do not prove demand.",
      label: opportunityClaims.length ? "Official source" : "Needs validation",
      confidence: confidence(opportunityClaims),
      reasoning: reasoning(
        `${normalized.opportunities.length ? `Verify current eligibility for ${normalized.opportunities.map((item) => item.name).join(", ")} on official pages.` : "Find one relevant founder community with a current official page."} Do this after the first direct validation step, not instead of it.`,
        "Program status, location fit, and eligibility can change.",
        opportunityClaims,
        ["The recorded location and venture structure are accurate."],
        "Open each official page and verify current eligibility.",
      ),
      plan: normalized.opportunities.map((item) => `${item.name}: ${item.nextAction}`),
      sources: sourceSubset(opportunityClaims),
      evidenceClaimIds: opportunityClaims.map((claim) => claim.id),
    };
  }

  return {
    ...common,
    name,
    role: "Creates evidence-safe pitch and interview messaging.",
    finding: normalized.cleanPitchContext,
    whyItMatters: "Clear messaging recruits interviews without inventing traction, market size, revenue, or funding interest.",
    label: "Inferred",
    confidence: "Medium",
    reasoning: reasoning(
      `Lead with this evidence-safe thesis: ${normalized.cleanPitchContext} Use the interview message to recruit learning conversations without pitching or implying traction.`,
      "The evidence does not justify unsupported market, revenue, or funding claims.",
      [...demand, ...competitorClaims],
      [assumptions[0]],
      normalized.firstValidationStep,
    ),
    plan: [
      normalized.oneLineIdea,
      normalized.cleanPitchContext,
      "Use interview messaging that asks about recent behavior instead of selling.",
    ],
    sources: sourceSubset([...demand, ...competitorClaims]),
    evidenceClaimIds: [...demand, ...competitorClaims].map((claim) => claim.id),
  };
}

export function createQueuedAgentOutputs(base?: Partial<LaunchBrief>): AgentOutput[] {
  return LAUNCHPILOT_AGENT_NAMES.map((name) => ({
    name,
    role: name === "Market Reality Agent"
      ? "Maps competitors and alternatives."
      : name === "Assumption & Risk Agent"
        ? "Turns uncertainty into tests."
        : name === "MVP Scope Agent"
          ? "Defines the smallest pilot."
          : name === "Roadmap Agent"
            ? "Builds the execution timeline."
            : name === "Opportunity Agent"
              ? "Finds support paths."
              : "Creates evidence-safe messaging.",
    status: "Queued",
    liveSteps: AGENT_PROGRESS_LINES[name],
    finding: "Queued for workspace synthesis.",
    whyItMatters: "This agent will run against the persisted founder intake, research, and source ledger.",
    label: "Framework-based",
    confidence: "Medium",
    reasoning: {
      recommendation: "Waiting for this agent to run.",
      why: "The dashboard builds the Launch Brief from saved evidence.",
      evidenceUsed: base?.sources?.slice(0, 3).map((source) => source.title) || [],
      assumptions: [],
      confidence: "Medium",
      whatCouldBeWrong: "The source set may remain incomplete.",
      howToValidate: base?.nextValidationTask || "Run the next validation step.",
    },
    plan: AGENT_PROGRESS_LINES[name],
    sources: [],
    evidenceClaimIds: [],
  }));
}

export function generateLaunchBrief(profile: FounderProfile, research: ResearchPack = defaultResearch(), evidence?: EvidenceScore): LaunchBrief {
  const normalized = normalizeFounderBrief(profile, evidence, research);
  const assumptions = normalized.riskRegister.map((risk) => risk.assumption);
  const risks = normalized.riskRegister.map((risk) => `${risk.riskLevel}: ${risk.assumption}. Test: ${risk.test}`);
  const agents = LAUNCHPILOT_AGENT_NAMES.map((name) => agentByName(name, { profile, research, evidence, normalized, assumptions, risks }));
  const bottleneck = evidence?.scoreCapReason?.includes("direct user") ? "Demand evidence" : evidence?.weakestSignal || "Unvalidated demand from a specific target user";
  const score = scoreFromProfile(profile, evidence);
  const competitorNames = [
    ...normalized.directCompetitors.map((row) => row.name),
    ...normalized.indirectAlternatives.map((row) => row.name),
  ].slice(0, 10);
  const roadmap = [
    { horizon: "Next 24 hours", actions: normalized.roadmapPlan.next24Hours },
    { horizon: "7-day sprint", actions: normalized.roadmapPlan.sevenDaySprint },
    { horizon: "30-day pilot", actions: normalized.roadmapPlan.thirtyDayPilot },
    { horizon: "60/90-day direction", actions: normalized.roadmapPlan.sixtyNinetyDays },
  ];
  const pitchAssets = {
    oneLinePitch: normalized.oneLineIdea,
    elevatorPitch: `${normalized.oneLineIdea} The first validation focus is ${normalized.researchFocus.toLowerCase()}`,
    problemStatement: normalized.problemStatement,
    interviewMessage: `Hi, I am researching custom workflows for ${normalized.primaryUser.toLowerCase()}. Could I ask about your last relevant order or task, what tools you used, how long revisions took, and where the workflow slowed down? I am researching, not selling.`,
    landingHeadline: normalized.positioning,
    deckOutline: [
      "User and problem",
      "Current behavior and alternatives",
      "Evidence score and source limits",
      "Narrow first workflow",
      "Manual pilot and success metric",
      "Next ask: user access, not unsupported funding claims",
    ],
  };
  const responsibleAINotes = [
    "The Evidence Score measures readiness to test, not probability of startup success.",
    "Search results and synthesis can be incomplete, stale, biased, or wrong.",
    "Do not claim traction, revenue, market size, or eligibility unless independently verified.",
    "Validate important claims with direct user behavior before spending money or making high-risk life decisions.",
  ];
  const workspace: WorkspaceItem[] = [
    toWorkspace("Founder Snapshot", `${profile.name} - ${profile.status}`, `${profile.location}; ${normalized.founderConstraints.join("; ")}.`, "High", "Inferred"),
    toWorkspace("Refined Idea", normalized.cleanStartupTitle, normalized.refinedIdea, "Medium", "Needs validation"),
    toWorkspace("Research Notes", "Evidence verdict", `${evidence?.score ?? "Unscored"}/100. ${evidence?.reasoning || "Limited analysis."}`, evidence && evidence.score >= 70 ? "Medium" : "Low", research.mode === "fallback" ? "Fallback analysis" : "Verified", research.sources.map((source) => source.id)),
    toWorkspace("Competitors / Alternatives", "Market reality", normalized.marketRealitySummary, normalized.directCompetitors.length ? "Medium" : "Low", normalized.directCompetitors.length ? "Verified" : "Needs validation", research.sources.map((source) => source.id)),
    toWorkspace("Assumptions", "Riskiest assumptions", assumptions.join("\n"), "High", "Needs validation"),
    toWorkspace("Risks", "Risk register", risks.join("\n"), "High", "AI may be wrong"),
    toWorkspace("MVP Plan", "Smallest testable version", `${normalized.mvpPlan.goal}\n${normalized.mvpPlan.manualPilot}`, "High", "Framework-based"),
    toWorkspace("Current Bottleneck", evidence?.weakestSignal || "Direct user evidence", normalized.nextBestAction, "High", "Framework-based"),
    toWorkspace("Founder Reality Check", evidence?.verdict.replaceAll("_", " ") || "Validation required", `${normalized.marketRealitySummary}\nVC outreach is premature until direct demand improves.`, "High", "Framework-based"),
    toWorkspace("Roadmap", "Bottleneck-first roadmap", roadmap.map((phase) => `${phase.horizon}: ${phase.actions.join(" ")}`).join("\n"), "High", "Framework-based"),
    toWorkspace("Pitch Assets", "Evidence-safe messaging", `${pitchAssets.oneLinePitch}\n\n${pitchAssets.elevatorPitch}\n\n${pitchAssets.interviewMessage}`, "Medium", "Inferred"),
    toWorkspace("Opportunity Cards", "Programs and communities", normalized.opportunities.map((item) => `${item.name}: ${item.nextAction}`).join("\n"), "Medium", "Needs validation"),
    toWorkspace("Saved Decisions", "Human approval boundary", "The founder approved this direction for validation. LaunchPilot does not contact users, spend money, submit applications, or make education/funding decisions.", "High", "Verified"),
    toWorkspace("Sources", "Source ledger", research.sources.map((source) => `${source.title} - ${source.label} - ${source.limitation || "Review before relying on it."}`).join("\n") || "No external sources were available.", research.mode === "live" ? "High" : "Medium", research.mode === "fallback" ? "Fallback analysis" : "Verified", research.sources.map((source) => source.id)),
  ];
  const readinessLabel: LaunchBrief["readinessLabel"] =
    profile.ideaStage === "no idea yet" ? "Explore more" : evidence?.score && evidence.score >= 80 ? "Pilot-ready" : "Problem-validation ready";

  return {
    profile,
    normalizedBrief: normalized,
    executiveSummary: `${normalized.cleanStartupTitle}: ${normalized.oneLineIdea} ${normalized.marketRealitySummary}`,
    validatedDirection: normalized.refinedIdea,
    whyThisIsSharper: normalized.whyThisIsSharper,
    refinedIdea: normalized.refinedIdea,
    problem: normalized.problemStatement,
    targetUser: normalized.targetUserSegment,
    readinessLabel,
    currentBottleneck: bottleneck,
    founderScore: score,
    strongestPoint: evidence?.strongestSignal || normalized.valueProposition,
    weakestPoint: bottleneck,
    nextValidationTask: normalized.nextBestAction,
    competitors: competitorNames,
    marketReality: {
      summary: normalized.marketRealitySummary,
      directCompetitors: normalized.directCompetitors,
      indirectAlternatives: normalized.indirectAlternatives,
      positioningGap: normalized.positioning,
      noDirectCompetitorMessage: normalized.noDirectCompetitorMessage,
    },
    opportunities: normalized.opportunities.map((item) => `${item.name} - ${item.nextAction}`),
    assumptions,
    risks,
    riskRegister: normalized.riskRegister,
    mvpScope: normalized.mvpPlan.mustHave,
    mvpPlan: normalized.mvpPlan,
    roadmap,
    roadmapPlan: normalized.roadmapPlan,
    opportunityLayer: normalized.opportunities,
    skillGaps: ["Behavior-focused customer interviewing", "Evidence logging", "Rapid manual pilot delivery"],
    pitchAssets,
    responsibleAINotes,
    research,
    evidenceScore: evidence,
    sources: research.sources,
    agents,
    workspace,
  };
}

export function problemDiscoveryCards(profile: FounderProfile) {
  return [{
    problem: "A repeated workflow problem has not been selected yet.",
    who: profile.targetUser || "a community you can access",
    evidenceType: "Founder context",
    whyItMayMatter: "Accessible users make validation possible before solution design.",
    confidence: "Low",
    whatCouldBeWrong: "The community may not have an urgent repeated problem.",
    howToValidate: "Ask eight people for the last frustrating workflow they completed.",
    label: "Fallback analysis",
  }];
}

export function copilotReply(question: string, brief: LaunchBrief) {
  if (isIrrelevantFounderQuestion(question)) return redirectMessage;
  const lower = question.toLowerCase();
  const normalized = brief.normalizedBrief;
  if (lower.includes("drop out")) {
    return sanitizeAdvisorResponse(`Do not make a dropout decision from this project. No. Based on the current evidence, stay enrolled and validate this for 30-60 days before making any high-risk life decision. The workspace does not establish stable revenue, runway, or repeat demand. Next: ${normalized.nextBestAction}`);
  }
  if (/investor|fund|yc|raise/.test(lower)) {
    return `I cannot predict investor or accelerator interest. Not yet: you are pre-validation. First complete interviews and a manual pilot, then use behavioral evidence before fundraising. Next: ${normalized.nextBestAction}`;
  }
  if (/competitor|alternative/.test(lower)) {
    if (brief.marketReality.noDirectCompetitorMessage) {
      const adjacent = brief.marketReality.indirectAlternatives.map((row) => row.name).slice(0, 5).join(", ");
      return `${brief.marketReality.noDirectCompetitorMessage} Adjacent alternatives include ${adjacent || "manual workarounds and broad tools"}. The opportunity is to test: ${normalized.positioning}`;
    }
    return `The strongest alternatives retained were: ${brief.marketReality.directCompetitors.map((row) => row.name).join(", ")}. Verify which one users actually rely on before claiming differentiation.`;
  }
  if (/score|low|verdict|why/.test(lower)) {
    return `${brief.evidenceScore?.reasoning || "The score reflects limited direct evidence."} Weakest signal: ${brief.weakestPoint}. What could be wrong: ${brief.evidenceScore?.whatCouldBeWrong || "The source set may be incomplete."} Next: ${normalized.nextBestAction}`;
  }
  if (/today|next|24/.test(lower)) {
    return normalized.nextBestAction;
  }
  if (/mvp|pilot|prototype|build first|feature/.test(lower)) {
    return `Run this narrow pilot first: ${brief.mvpPlan.manualPilot} Must-have scope: ${brief.mvpPlan.mustHave.join(", ")}. Do not build yet: ${brief.mvpPlan.doNotBuildYet.join(", ")}. Success signal: ${brief.mvpPlan.successMetric}`;
  }
  if (/recruit|interviewee|find users|reach users|outreach/.test(lower)) {
    return `Recruit the first five interviewees from channels you can reach this week: two local print shops, one campus merch club, one Instagram or WhatsApp apparel seller, and one referral from a designer or printer. Send this evidence-safe message: ${brief.pitchAssets.interviewMessage} Ask for 15 minutes, do not demo the product, and log their last order, revision time, tools, handoff problems, and whether the issue repeated.`;
  }
  if (/interview notes|notes after|after each call|record after|synthesi[sz]e interview|capture from interview/.test(lower)) {
    return `Use one evidence log per interview with seven fields: participant and context; their last real apparel order; tools and workarounds used; revision and handoff time; the most painful repeated moment; behavioral evidence or an exact short quote; and the next follow-up. End each note with Signal, Uncertainty, and Decision. Do not combine interviews until all five are complete; then count repeated behaviors, separate one-off opinions, and update the risk register only from patterns you can trace back to the notes.`;
  }
  if (/risk|assumption|could fail|wrong/.test(lower)) {
    const risk = brief.riskRegister[0];
    return risk
      ? `The highest-priority assumption is: ${risk.assumption} Why it matters: ${risk.whyItMatters} Test it by: ${risk.test} Continue only if: ${risk.successSignal} Stop or pivot trigger: ${risk.stopOrPivotTrigger.replace(/^if\s+/i, "")}`
      : `The current risk is ${brief.currentBottleneck.toLowerCase()}. Test it with: ${normalized.nextBestAction}`;
  }
  if (/roadmap|week|30 day|60 day|90 day|plan/.test(lower)) {
    return `Next 24 hours: ${brief.roadmapPlan.next24Hours.join(" ")} Seven-day sprint: ${brief.roadmapPlan.sevenDaySprint.join(" ")} Thirty-day pilot: ${brief.roadmapPlan.thirtyDayPilot.join(" ")} Stop or pivot if: ${brief.roadmapPlan.stopPivotCriteria}`;
  }
  if (/pitch|headline|message|describe|explain idea/.test(lower)) {
    return `One-line pitch: ${brief.pitchAssets.oneLinePitch} Landing headline: ${brief.pitchAssets.landingHeadline} For user interviews, use: ${brief.pitchAssets.interviewMessage}`;
  }
  if (/source|evidence|proof|research/.test(lower)) {
    const sourceSummary = brief.sources.slice(0, 4).map((source) => `${source.title} (${source.type}, ${source.label.toLowerCase()})`).join("; ");
    return `The workspace retained ${brief.sources.length} source records. The strongest signal is ${brief.strongestPoint.toLowerCase()}, while the weakest is ${brief.weakestPoint.toLowerCase()}. Representative sources: ${sourceSummary || "limited offline analysis"}. These sources provide context, not proof of demand; validate with direct user behavior.`;
  }
  if (/program|scheme|community|mentor|support/.test(lower)) {
    return brief.opportunityLayer.length
      ? brief.opportunityLayer.map((item) => `${item.name}: ${item.whyRelevant} Next action: ${item.nextAction} ${item.eligibilityUncertainty}`).join(" ")
      : "No verified program was retained. Prioritize user access and validation before applications or investor outreach.";
  }
  return `Your current bottleneck is ${brief.currentBottleneck.toLowerCase()}. The next useful action is: ${normalized.nextBestAction}`;
}
