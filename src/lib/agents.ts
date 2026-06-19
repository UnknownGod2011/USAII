import { isIrrelevantFounderQuestion, redirectMessage, sanitizeAdvisorResponse } from "./guardrails";
import type { EvidenceClaim, EvidenceScore } from "./intake/schema";
import type { AgentOutput, FounderProfile, LaunchBrief, ReasoningCard, ResearchPack, Source, WorkspaceItem } from "./types";

const now = () => new Date().toISOString();
const isIndia = (profile: FounderProfile) => /india|bengaluru|bangalore|delhi|mumbai|pune|hyderabad|chennai|kolkata/i.test(profile.location);
const noDirectValidation = (profile: FounderProfile) =>
  !/revenue|paying|users exist|active users|pilot|preorder|interview|survey/i.test(`${profile.evidence.join(" ")} ${profile.traction}`);

function fallbackResearch(profile: FounderProfile): ResearchPack {
  return {
    mode: "fallback",
    fetchedAt: now(),
    logs: ["Live research was not supplied to the execution graph.", "Prepared a limited offline plan from founder constraints."],
    plan: [],
    sources: [{
      id: "offline-analysis",
      title: "Limited offline analysis",
      url: "",
      type: "fallback",
      label: "Fallback analysis",
      snippet: "No external source was supplied to this execution run.",
      fetchedAt: now(),
      provider: "offline",
      verified: false,
      relevanceScore: 0,
      qualityScore: 0.1,
      limitation: "No external market evidence is available.",
    }],
    evidenceClaims: [
      {
        id: "claim-founder-problem",
        claim: `${profile.targetUser} experiences: ${profile.whyItMatters}`,
        category: "problem",
        evidenceType: "founder_statement",
        sourceIds: [],
        support: "supports",
        confidence: "low",
        limitation: "Founder hypothesis only.",
        relevanceScore: 1,
        qualityScore: 0.35,
      },
    ],
    competitors: [],
    marketSignals: [],
    opportunities: [],
    skillResources: [],
  };
}

function displayConfidence(claims: EvidenceClaim[]): "Low" | "Medium" | "High" {
  const usable = claims.filter((claim) => claim.sourceIds.length && claim.support === "supports");
  if (usable.some((claim) => claim.confidence === "high")) return "High";
  if (usable.some((claim) => claim.confidence === "medium")) return "Medium";
  return "Low";
}

function labelForSources(sources: Source[]): AgentOutput["label"] {
  if (!sources.length) return "Needs validation";
  if (sources.some((source) => source.label === "Verified" || source.label === "Official source")) return "Verified";
  if (sources.some((source) => source.label === "Community signal")) return "Community signal";
  return "Needs validation";
}

function claimsFor(research: ResearchPack, categories: EvidenceClaim["category"][]) {
  return research.evidenceClaims.filter((claim) => categories.includes(claim.category));
}

function sourceIds(claims: EvidenceClaim[]) {
  return Array.from(new Set(claims.flatMap((claim) => claim.sourceIds)));
}

function sourcesFor(research: ResearchPack, claims: EvidenceClaim[]) {
  const ids = new Set(sourceIds(claims));
  return research.sources.filter((source) => ids.has(source.id));
}

function reasoning(
  recommendation: string,
  why: string,
  claims: EvidenceClaim[],
  assumptions: string[],
  howToValidate: string,
): ReasoningCard {
  return {
    recommendation,
    why,
    evidenceUsed: claims.length ? claims.slice(0, 5).map((claim) => `${claim.id}: ${claim.claim}`) : ["No external evidence claim supports this recommendation yet."],
    assumptions,
    confidence: displayConfidence(claims),
    whatCouldBeWrong: claims.length
      ? claims.map((claim) => claim.limitation).filter(Boolean).slice(0, 2).join(" ")
      : "The recommendation is based on founder context and may change after direct user evidence is collected.",
    howToValidate,
  };
}

function founderScore(profile: FounderProfile, evidence?: EvidenceScore) {
  if (evidence) {
    return {
      feasibility: Math.round((evidence.breakdown.feasibility / 15) * 100),
      marketOpportunity: Math.round(((evidence.breakdown.problemPainClarity + evidence.breakdown.demandEvidence + evidence.breakdown.competitorGap) / 55) * 100),
      executionDifficulty: Math.max(0, 100 - Math.round((evidence.breakdown.feasibility / 15) * 100)),
      founderFit: Math.round((evidence.breakdown.founderMarketFit / 10) * 100),
      overall: evidence.score,
      label: evidence.verdict === "strong" ? "Ready for a validation sprint" : evidence.verdict === "promising_needs_modification" ? "Promising, modification required" : "Evidence is not strong enough yet",
      notes: [
        "This is an evidence-readiness score, not a success prediction.",
        evidence.scoreCapReason || "The score reflects the current source and founder evidence.",
      ],
    };
  }
  const timeFit = profile.hoursPerWeek >= 10 ? 65 : profile.hoursPerWeek >= 5 ? 52 : 35;
  return {
    feasibility: timeFit,
    marketOpportunity: 30,
    executionDifficulty: 100 - timeFit,
    founderFit: Math.min(70, 35 + profile.skills.length * 6),
    overall: Math.min(59, Math.round((timeFit + 30 + profile.skills.length * 6) / 3)),
    label: "Limited offline readiness",
    notes: ["No completed evidence score was supplied. This is not a success prediction."],
  };
}

function readiness(profile: FounderProfile, evidence?: EvidenceScore): LaunchBrief["readinessLabel"] {
  if (profile.ideaStage === "no idea yet") return "Explore more";
  if (!evidence || evidence.score < 60 || noDirectValidation(profile)) return "Problem-validation ready";
  if (profile.traction.toLowerCase().includes("revenue")) return "Pilot-ready";
  if (profile.ideaStage === "MVP already exists") return "Pilot-ready";
  return "Prototype-ready";
}

function bottleneckFromEvidence(profile: FounderProfile, evidence?: EvidenceScore) {
  if (profile.ideaStage === "no idea yet") return "No sharply chosen problem yet";
  if (!evidence) return noDirectValidation(profile) ? "Unvalidated demand from a specific target user" : "Insufficient market evidence";
  const entries = Object.entries(evidence.breakdown) as [keyof EvidenceScore["breakdown"], number][];
  const normalized: Record<keyof EvidenceScore["breakdown"], number> = {
    problemPainClarity: evidence.breakdown.problemPainClarity / 20,
    targetUserSharpness: evidence.breakdown.targetUserSharpness / 15,
    demandEvidence: evidence.breakdown.demandEvidence / 20,
    competitorGap: evidence.breakdown.competitorGap / 15,
    feasibility: evidence.breakdown.feasibility / 15,
    founderMarketFit: evidence.breakdown.founderMarketFit / 10,
    riskLevel: evidence.breakdown.riskLevel / 5,
  };
  const weakest = entries.sort((a, b) => normalized[a[0]] - normalized[b[0]])[0][0];
  const labels: Record<typeof weakest, string> = {
    problemPainClarity: "The problem is not specific or painful enough",
    targetUserSharpness: "The first target user is still too broad",
    demandEvidence: "Direct demand evidence is missing",
    competitorGap: "The alternative and differentiation picture is incomplete",
    feasibility: "The first version exceeds founder constraints",
    founderMarketFit: "Founder access or domain fit is weak",
    riskLevel: "Execution or regulatory risk is too high",
  };
  return labels[weakest];
}

function alternativeNames(profile: FounderProfile, research: ResearchPack) {
  if (research.competitors.length) return research.competitors;
  return (profile.currentAlternatives || "")
    .split(/[,;]|\band\b/i)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 6);
}

export function generateLaunchBrief(
  profile: FounderProfile,
  suppliedResearch?: ResearchPack,
  evidenceScore?: EvidenceScore,
): LaunchBrief {
  const research = suppliedResearch || fallbackResearch(profile);
  const noIdea = profile.ideaStage === "no idea yet";
  const competitors = alternativeNames(profile, research);
  const bottleneck = bottleneckFromEvidence(profile, evidenceScore);
  const nextValidationTask = evidenceScore?.nextValidationStep || (noIdea
    ? "Interview eight people in one accessible community and rank their repeated painful problems."
    : `Interview five ${profile.targetUser.toLowerCase()} and collect recent examples of the problem before showing a solution.`);
  const refinedIdea = noIdea
    ? `A problem-discovery workflow for a community ${profile.name} can reach and interview directly.`
    : `${profile.rawIdea} Start with ${profile.targetUser} and validate the single job: ${profile.whyItMatters}.`;
  const problem = noIdea ? "A painful and reachable problem has not been selected yet." : profile.whyItMatters;
  const demandClaims = claimsFor(research, ["problem", "demand"]);
  const competitorClaims = claimsFor(research, ["competitor", "pricing"]);
  const feasibilityClaims = claimsFor(research, ["feasibility"]);
  const opportunityClaims = claimsFor(research, ["opportunity"]);
  const allSourceClaims = research.evidenceClaims.filter((claim) => claim.sourceIds.length);

  const assumptions = [
    `${profile.targetUser} experiences the stated problem frequently enough to change current behavior.`,
    competitors.length ? `The current alternatives (${competitors.slice(0, 3).join(", ")}) leave a meaningful gap.` : "The founder has not yet identified a real alternative used by the target segment.",
    `A first test can be completed within ${profile.hoursPerWeek} hours per week and a budget of ${profile.budget}.`,
  ];
  const risks = [
    noDirectValidation(profile) ? "No direct user, pilot, usage, or payment evidence currently supports demand." : "Existing validation may still be too small or biased to generalize.",
    allSourceClaims.length < 3 ? "External research coverage is thin; competitor and demand conclusions may change." : "Public evidence may not match the exact first segment or local behavior.",
    competitors.length === 0 ? "The alternative landscape is incomplete, so differentiation is not yet defensible." : "Competitor pages can overstate product value; independent user evidence is still needed.",
    profile.hoursPerWeek < 8 ? "Limited weekly time makes broad product scope especially risky." : "The founder should keep scope narrow enough to preserve a short validation cycle.",
  ];
  const mvpScope = noIdea
    ? ["Problem interview script", "Evidence ledger", "Pain-ranking board", "One approved problem statement"]
    : [
        `One workflow that helps ${profile.targetUser.toLowerCase()} solve this problem: ${profile.whyItMatters.toLowerCase()}`,
        "A manual or concierge delivery path before complex automation",
        "A measurable activation event tied to the 30-day goal",
        "An evidence log for user quotes, repeat behavior, and objections",
      ];
  const roadmap = [
    {
      horizon: "Next 24 hours",
      actions: [
        nextValidationTask,
        `Write three questions that test behavior around "${profile.whyItMatters}" without pitching the solution.`,
        "Record the current alternative and the cost of switching for every interview.",
      ],
    },
    {
      horizon: "Next 7 days",
      actions: [
        "Complete at least five high-quality problem interviews.",
        "Update the evidence ledger with supporting and contradicting signals.",
        "Decide whether to preserve, narrow, or reject the current direction.",
      ],
    },
    {
      horizon: "Next 30 days",
      actions: [
        "Run a manual or clickable pilot with 3-5 target users.",
        `Measure the founder's chosen outcome: ${profile.success30Days}.`,
        "Stop or pivot if users do not repeat the behavior or commit time, data, or money.",
      ],
    },
  ];
  const opportunities = research.opportunities.length
    ? research.opportunities
    : ["No current opportunity was verified in this research run. Check official program pages only after problem validation starts."];
  const skillGaps = [
    "Behavior-focused customer interviewing",
    "Evidence logging and contradiction tracking",
    profile.skills.some((skill) => /code|react|python|engineering|ai/i.test(skill)) ? "Rapid prototype instrumentation" : "Manual or no-code pilot delivery",
  ];
  const ideaSentence = profile.rawIdea.replace(/[.\s]+$/, "");
  const problemPhrase = profile.whyItMatters.replace(/[.\s]+$/, "");
  const pitchAssets = {
    oneLinePitch: `${ideaSentence} - focused first on proving that ${problemPhrase.toLowerCase()}.`,
    elevatorPitch: `We are testing a focused solution for ${profile.targetUser.toLowerCase()}. The problem hypothesis is that ${problemPhrase.toLowerCase()}. The current plan starts with direct validation, then a narrow pilot rather than a broad build.`,
    problemStatement: problem,
    interviewMessage: `Hi, I am researching the last time ${profile.targetUser.toLowerCase()} experienced this problem: ${problemPhrase.toLowerCase()}. Could I ask what happened and what you tried? I am researching the problem, not selling a product.`,
    landingHeadline: `A focused way for ${profile.targetUser.toLowerCase()} to solve: ${problemPhrase.toLowerCase()}.`,
    deckOutline: [
      `Problem and user: ${problem}`,
      `Current behavior and alternatives: ${competitors.join(", ") || "still being researched"}`,
      "Evidence collected and evidence still missing",
      "Narrow first workflow and explicit non-goals",
      "Validation experiment, success metric, and stop criteria",
      "Next ask: access to target-user interviews, not investor capital",
    ],
  };
  const responsibleAINotes = [
    "The Evidence Score measures readiness to test, not probability of success.",
    "Search results and model synthesis can be incomplete, stale, biased, or wrong.",
    "Every important market claim should be checked against its source and direct user evidence.",
    "Raw audio is not stored; transcript and structured founder context can be cleared.",
  ];

  const marketSources = sourcesFor(research, [...demandClaims, ...competitorClaims]);
  const agents: AgentOutput[] = [
    {
      name: "Market Reality Agent",
      role: "Maps real alternatives, demand signals, and evidence gaps",
      status: "Complete",
      liveSteps: research.logs.slice(0, 6),
      finding: competitors.length
        ? `The strongest researched alternatives are ${competitors.slice(0, 5).join(", ")}. ${research.marketSignals[0] || "Direct customer demand is still not proven."}`
        : "No sufficiently relevant company or product competitor was verified. Treat the landscape as incomplete.",
      whyItMatters: "The founder needs to understand current behavior and alternatives before claiming differentiation.",
      label: labelForSources(marketSources),
      confidence: displayConfidence([...demandClaims, ...competitorClaims]),
      reasoning: reasoning(
        competitors.length ? "Compare the first workflow against the strongest real alternative." : "Ask target users what they use today before claiming a market gap.",
        "Competitor and demand conclusions must be tied to relevant sources and direct behavior.",
        [...demandClaims, ...competitorClaims],
        [assumptions[0], assumptions[1]],
        nextValidationTask,
      ),
      plan: [
        "Verify each alternative with target users.",
        "Capture pricing, switching cost, and the job users hire each alternative to do.",
        "Do not describe source-code repositories as market competitors.",
      ],
      sources: marketSources,
      evidenceClaimIds: [...demandClaims, ...competitorClaims].map((claim) => claim.id),
    },
    {
      name: "Assumption & Risk Agent",
      role: "Converts weak evidence into falsifiable tests",
      status: "Complete",
      liveSteps: ["Ranked assumptions by evidence strength", "Checked founder constraints", "Defined failure and stop signals"],
      finding: `The riskiest assumption is: ${assumptions[0]} The largest current risk is: ${risks[0]}`,
      whyItMatters: "A falsifiable assumption prevents the founder from mistaking activity for validation.",
      label: "Needs validation",
      confidence: "High",
      reasoning: reasoning(
        "Test urgency and current behavior before feature preference.",
        "Weak demand evidence is the highest-leverage uncertainty in an early startup.",
        demandClaims,
        assumptions,
        nextValidationTask,
      ),
      plan: assumptions.map((assumption, index) => `${index + 1}. Test: ${assumption}`),
      sources: sourcesFor(research, demandClaims),
      evidenceClaimIds: demandClaims.map((claim) => claim.id),
    },
    {
      name: "MVP Scope Agent",
      role: "Defines the smallest testable delivery",
      status: "Complete",
      liveSteps: ["Read budget and weekly time", "Removed non-essential automation", "Mapped MVP to one success signal"],
      finding: `The first version should contain ${mvpScope.length} elements and fit inside ${profile.hoursPerWeek} hours per week.`,
      whyItMatters: "Scope must test the core value proposition before consuming the founder's limited time and budget.",
      label: "Framework-based",
      confidence: "High",
      reasoning: reasoning(
        "Start with a manual or narrow workflow that produces observable user behavior.",
        `The founder has ${profile.hoursPerWeek} hours per week and a budget of ${profile.budget}.`,
        feasibilityClaims,
        [assumptions[2]],
        `Run the first pilot with 3-5 ${profile.targetUser.toLowerCase()} and measure ${profile.success30Days}.`,
      ),
      plan: [...mvpScope, "Do not build billing, team administration, broad automation, or advanced analytics yet."],
      sources: sourcesFor(research, feasibilityClaims),
      evidenceClaimIds: feasibilityClaims.map((claim) => claim.id),
    },
    {
      name: "Roadmap Agent",
      role: "Plans around the current bottleneck",
      status: "Complete",
      liveSteps: ["Selected one bottleneck", "Detailed the current phase", "Kept future phases directional"],
      finding: `The current bottleneck is "${bottleneck}". The next action is ${nextValidationTask}`,
      whyItMatters: "The roadmap should change the weakest evidence dimension, not create a generic feature calendar.",
      label: "Framework-based",
      confidence: "High",
      reasoning: reasoning(
        "Use the next seven days to change the weakest evidence dimension.",
        evidenceScore?.reasoning || "No completed evidence score was supplied, so the roadmap stays conservative.",
        research.evidenceClaims,
        assumptions,
        nextValidationTask,
      ),
      plan: roadmap.flatMap((phase) => phase.actions.map((action) => `${phase.horizon}: ${action}`)),
      sources: research.sources.slice(0, 6),
      evidenceClaimIds: research.evidenceClaims.map((claim) => claim.id),
    },
    {
      name: "Opportunity Agent",
      role: "Finds support paths without overstating eligibility",
      status: "Complete",
      liveSteps: ["Checked location", "Filtered for official-source evidence", "Kept eligibility unconfirmed"],
      finding: opportunities.join(" "),
      whyItMatters: "Mentorship and programs can support validation, but they are not proof of demand or funding readiness.",
      label: opportunityClaims.some((claim) => claim.evidenceType === "official" && claim.confidence === "high") ? "Official source" : "Needs validation",
      confidence: displayConfidence(opportunityClaims),
      reasoning: reasoning(
        "Use support programs after confirming the problem and checking official eligibility.",
        isIndia(profile) ? "India-specific programs may be relevant, but eligibility and activity can change." : "Country-specific support should be verified from official sources.",
        opportunityClaims,
        ["The location and venture structure are accurate."],
        "Open each official program page and verify current eligibility before applying.",
      ),
      plan: ["Validate the problem first.", "Check official eligibility.", "Treat applications as support work, not market validation."],
      sources: sourcesFor(research, opportunityClaims),
      evidenceClaimIds: opportunityClaims.map((claim) => claim.id),
    },
    {
      name: "Pitch & Communication Agent",
      role: "Turns the approved evidence into precise founder messaging",
      status: "Complete",
      liveSteps: ["Used the finalized user and problem", "Removed unsupported market claims", "Prepared interview-first messaging"],
      finding: pitchAssets.oneLinePitch,
      whyItMatters: "Clear communication helps the founder recruit interviews without overstating traction or certainty.",
      label: "Inferred",
      confidence: "Medium",
      reasoning: reasoning(
        "Lead with the user, problem, and current validation stage.",
        "The evidence does not justify large market, traction, or funding claims yet.",
        [...demandClaims, ...competitorClaims],
        [assumptions[0]],
        "Use the interview message with five target users and record objections.",
      ),
      plan: [pitchAssets.oneLinePitch, pitchAssets.interviewMessage, ...pitchAssets.deckOutline],
      sources: marketSources,
      evidenceClaimIds: [...demandClaims, ...competitorClaims].map((claim) => claim.id),
    },
  ];

  const workspace: WorkspaceItem[] = [
    { id: "founder", type: "Founder Snapshot", title: `${profile.name} - ${profile.status}`, content: `${profile.location}; ${profile.hoursPerWeek} hrs/week; budget ${profile.budget}; skills: ${profile.skills.join(", ") || "not specified"}.`, label: "Inferred", confidence: "High", updatedAt: now() },
    { id: "idea", type: "Refined Idea", title: "Finalized direction", content: refinedIdea, label: "Needs validation", confidence: "Medium", updatedAt: now() },
    { id: "research", type: "Research Notes", title: "Research verdict", content: `${evidenceScore?.score ?? "Unscored"}/100. ${evidenceScore?.reasoning || "Limited offline analysis."}\n${evidenceScore?.scoreCapReason || ""}`, label: research.mode === "fallback" ? "Fallback analysis" : "Verified", confidence: research.mode === "live" ? "High" : "Medium", updatedAt: now(), sourceIds: sourceIds(allSourceClaims) },
    { id: "competitors", type: "Competitors / Alternatives", title: "Current alternatives", content: competitors.length ? competitors.join("; ") : "No relevant competitor was verified; ask users what they currently use.", label: competitors.length ? labelForSources(marketSources) : "Needs validation", confidence: displayConfidence(competitorClaims), updatedAt: now(), sourceIds: sourceIds(competitorClaims) },
    { id: "assumptions", type: "Assumptions", title: "Riskiest assumptions", content: assumptions.join("\n"), label: "Needs validation", confidence: "High", updatedAt: now(), sourceIds: sourceIds(demandClaims) },
    { id: "risks", type: "Risks", title: "Evidence and execution risks", content: risks.join("\n"), label: "AI may be wrong", confidence: "High", updatedAt: now(), sourceIds: sourceIds(allSourceClaims) },
    { id: "mvp", type: "MVP Plan", title: "Smallest testable version", content: mvpScope.join("\n"), label: "Framework-based", confidence: "High", updatedAt: now(), sourceIds: sourceIds(feasibilityClaims) },
    { id: "bottleneck", type: "Current Bottleneck", title: bottleneck, content: nextValidationTask, label: "Framework-based", confidence: "High", updatedAt: now(), sourceIds: evidenceScore ? Object.values(evidenceScore.evidenceByDimension).flat() : [] },
    { id: "reality", type: "Founder Reality Check", title: readiness(profile, evidenceScore), content: `Strongest: ${evidenceScore?.strongestSignal || profile.skills[0] || "founder context"}.\nWeakest: ${evidenceScore?.weakestSignal || "external validation"}.\nInvestor outreach is premature until demand and usage evidence improve.`, label: "Framework-based", confidence: "High", updatedAt: now() },
    { id: "roadmap", type: "Roadmap", title: "Bottleneck-first roadmap", content: roadmap.map((phase) => `${phase.horizon}: ${phase.actions.join(" ")}`).join("\n"), label: "Framework-based", confidence: "High", updatedAt: now(), sourceIds: sourceIds(allSourceClaims) },
    { id: "pitch", type: "Pitch Assets", title: "Evidence-safe messaging", content: `${pitchAssets.oneLinePitch}\n\n${pitchAssets.elevatorPitch}\n\nInterview message: ${pitchAssets.interviewMessage}`, label: "Inferred", confidence: "Medium", updatedAt: now(), sourceIds: sourceIds([...demandClaims, ...competitorClaims]) },
    { id: "opportunities", type: "Opportunity Cards", title: "Programs and support", content: opportunities.join("\n"), label: opportunityClaims.length ? "Needs validation" : "Fallback analysis", confidence: displayConfidence(opportunityClaims), updatedAt: now(), sourceIds: sourceIds(opportunityClaims) },
    { id: "decisions", type: "Saved Decisions", title: "Human approval boundary", content: "The founder approved this direction for validation. LaunchPilot does not contact users, submit applications, spend money, or make education or funding decisions. VC outreach is premature until direct demand evidence improves.", label: "Verified", confidence: "High", updatedAt: now() },
    { id: "sources", type: "Sources", title: "Evidence source ledger", content: research.sources.length ? research.sources.map((source) => `${source.title} - ${source.label} - ${source.limitation || "Review before relying on this source."}`).join("\n") : "No external sources were available.", label: research.mode === "fallback" ? "Fallback analysis" : "Verified", confidence: research.mode === "live" ? "High" : "Medium", updatedAt: now(), sourceIds: research.sources.map((source) => source.id) },
  ];

  return {
    profile,
    refinedIdea,
    problem,
    targetUser: profile.targetUser,
    readinessLabel: readiness(profile, evidenceScore),
    currentBottleneck: bottleneck,
    founderScore: founderScore(profile, evidenceScore),
    strongestPoint: evidenceScore?.strongestSignal || profile.skills[0] || "Founder willingness to validate",
    weakestPoint: evidenceScore?.weakestSignal || "External validation",
    nextValidationTask,
    competitors,
    opportunities,
    assumptions,
    risks,
    mvpScope,
    roadmap,
    skillGaps,
    pitchAssets,
    responsibleAINotes,
    research,
    evidenceScore,
    sources: research.sources,
    agents,
    workspace,
  };
}

export function problemDiscoveryCards(profile: FounderProfile) {
  const community = profile.targetUser || "a community you can access";
  return [
    {
      problem: "A repeated workflow problem has not been selected yet.",
      who: community,
      evidenceType: "Founder context",
      whyItMayMatter: "Starting from accessible users makes direct validation possible before solution design.",
      confidence: "Low",
      whatCouldBeWrong: "The accessible community may not have an urgent or repeated problem.",
      howToValidate: "Ask eight people for the last frustrating workflow they completed and what they tried.",
      label: "Fallback analysis",
    },
  ];
}

export function copilotReply(question: string, brief: LaunchBrief) {
  if (isIrrelevantFounderQuestion(question)) return redirectMessage;
  const lower = question.toLowerCase();
  if (lower.includes("drop out")) {
    return sanitizeAdvisorResponse(
      `Do not make a dropout decision from this project right now. I would not recommend dropping out from this evidence. Your current bottleneck is ${brief.currentBottleneck.toLowerCase()}, and the plan does not establish stable revenue, runway, or repeat demand. Keep school as the default while validating for 60-90 days. Next action: ${brief.nextValidationTask}`,
    );
  }
  if (lower.includes("yc") || lower.includes("fund") || lower.includes("investor")) {
    return `Investor outreach is premature. I cannot predict YC or investor interest. The current bottleneck is ${brief.currentBottleneck.toLowerCase()}. First complete this validation step: ${brief.nextValidationTask}`;
  }
  if (lower.includes("startup india") || lower.includes("dpiit") || lower.includes("maarg")) {
    return isIndia(brief.profile)
      ? "An India-specific program may be relevant, but current eligibility must be verified on the official page. Treat it as support, not proof of demand, and complete the validation step first."
      : "Those programs are India-specific. Verify a location-appropriate official program after the problem and first target segment are validated.";
  }
  if (lower.includes("competitor") || lower.includes("alternative")) {
    return brief.competitors.length
      ? `The saved workspace lists these researched alternatives: ${brief.competitors.join(", ")}. Ask target users which one they actually use and why before claiming differentiation.`
      : "No relevant competitor was verified in the saved research. Ask target users what they use today and record manual alternatives before claiming a gap.";
  }
  if (lower.includes("score") || lower.includes("low")) {
    return `The weakest evidence area is ${brief.weakestPoint.toLowerCase()}. ${brief.evidenceScore?.scoreCapReason || "The score reflects current founder and source evidence."} Next action: ${brief.nextValidationTask}`;
  }
  return `Your current bottleneck is ${brief.currentBottleneck.toLowerCase()}. The next useful action is: ${brief.nextValidationTask}. Avoid expanding scope until this evidence gap changes.`;
}
