import type { EvidenceScore } from "@/lib/intake/schema";
import type { FounderProfile, ResearchPack, Source } from "@/lib/types";

export type AlternativeMatrixRow = {
  name: string;
  type: string;
  useCase: string;
  strength: string;
  gap: string;
  confidence: "Low" | "Medium" | "High";
  sourceTitle?: string;
  sourceUrl?: string;
};

export type RiskRegisterItem = {
  assumption: string;
  whyItMatters: string;
  riskLevel: "Low" | "Medium" | "High";
  test: string;
  successSignal: string;
  stopOrPivotTrigger: string;
};

export type MvpPlan = {
  goal: string;
  manualPilot: string;
  mustHave: string[];
  doNotBuildYet: string[];
  successMetric: string;
};

export type RoadmapPlan = {
  next24Hours: string[];
  sevenDaySprint: string[];
  thirtyDayPilot: string[];
  sixtyNinetyDays: string[];
  stopPivotCriteria: string;
};

export type OpportunityItem = {
  name: string;
  whyRelevant: string;
  nextAction: string;
  eligibilityUncertainty: string;
  sourceTitle?: string;
  sourceUrl?: string;
};

export type NormalizedFounderBrief = {
  cleanStartupTitle: string;
  oneLineIdea: string;
  originalIdeaSummary: string;
  refinedIdea: string;
  targetUserSegment: string;
  primaryUser: string;
  secondaryUser?: string;
  problemStatement: string;
  valueProposition: string;
  currentAlternatives: string[];
  evidenceSummary: string;
  founderConstraints: string[];
  firstValidationStep: string;
  researchFocus: string;
  cleanPitchContext: string;
  positioning: string;
  marketRealitySummary: string;
  whyThisIsSharper: string;
  nextBestAction: string;
  directCompetitors: AlternativeMatrixRow[];
  indirectAlternatives: AlternativeMatrixRow[];
  noDirectCompetitorMessage?: string;
  riskRegister: RiskRegisterItem[];
  mvpPlan: MvpPlan;
  roadmapPlan: RoadmapPlan;
  opportunities: OpportunityItem[];
};

const titleCase = (value: string) =>
  value
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase())
    .replace(/\bAi\b/g, "AI")
    .replace(/\bSaas\b/g, "SaaS")
    .replace(/\bMvp\b/g, "MVP");

const sentence = (value: string) => {
  const cleaned = value
    .replace(/\s+/g, " ")
    .replace(/\bim\b/gi, "I am")
    .replace(/\bi think\b/gi, "")
    .replace(/\bdeisgn\b/gi, "design")
    .replace(/\btshirts\b/gi, "T-shirts")
    .replace(/\btshirt\b/gi, "T-shirt")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
  if (!cleaned) return "";
  return cleaned.endsWith(".") ? cleaned : `${cleaned}.`;
};

const shortSentence = (value: string, fallback: string) => {
  const cleaned = sentence(value || fallback).replace(/\.$/, "");
  return cleaned.length > 220 ? `${cleaned.slice(0, 217).trim()}...` : cleaned;
};

const splitAlternatives = (value?: string) =>
  (value || "")
    .split(/,|;|\band\b|\n/i)
    .map((item) => sentence(item).replace(/\.$/, ""))
    .filter((item) => item.length > 2 && !/^(none|nothing|not sure|no proof yet|no idea|idk)$/i.test(item))
    .slice(0, 8);

const isTshirtIdea = (profile: FounderProfile) =>
  /t-?shirt|tshirt|apparel|print[- ]?ready|mockup|merch|shirt/i.test(`${profile.rawIdea} ${profile.targetUser} ${profile.whyItMatters}`);

const isNoIdea = (profile: FounderProfile) => profile.ideaStage === "no idea yet" || /no idea|do not have/i.test(profile.rawIdea);

const sourceText = (source: Source) => `${source.title} ${source.snippet || ""} ${source.url}`.toLowerCase();

function sourceAlternativeRow(source: Source): AlternativeMatrixRow {
  const text = sourceText(source);
  const contextOnly = ["blog", "market_report", "community_signal", "dataset", "review"].includes(source.type);
  const apparelPlatform = /shop software|management solution|order management|workflow software|shopvox|apparel shop|decorator software|print shop management|print management|screen printing software/.test(text);
  const fastPrint = !apparelPlatform && /same[- ]?day|24 hour|fast|rush|print shop|printing|custom t-?shirt|printful|printify|vistaprint|printo/.test(text);
  const designTool = /canva|adobe|design|mockup|template|generator|editor|software/.test(text);
  const manualService = /fiverr|upwork|designer|agency|service|freelance/.test(text);
  const type = contextOnly
    ? "Adjacent workflow evidence"
    : apparelPlatform
    ? "Custom apparel platform"
    : fastPrint
    ? "Fast printing service"
    : designTool
      ? "Design software alternative"
      : manualService
        ? "Manual design service"
        : source.type === "competitor"
          ? "Adjacent product"
          : source.type === "review"
            ? "Review signal"
            : "Market context";
  return {
    name: source.title,
    type,
    useCase: contextOnly
      ? "Supports a claim about the current workflow, urgency, or user behavior; it is not presented as a competitor."
      : apparelPlatform
      ? "Shops use it to manage orders, production workflow, customer communication, or fulfillment operations."
      : fastPrint
      ? "Customers use it to turn custom apparel orders around quickly."
      : designTool
        ? "Users create graphics, mockups, or editable visual assets."
        : manualService
          ? "Customers outsource design work when internal iteration is slow."
          : "Use as context for how this workflow is currently solved.",
    strength: contextOnly
      ? "Adds source-backed market context without pretending the article itself is a product."
      : apparelPlatform
      ? "Shows custom apparel businesses already use software around orders and workflow."
      : fastPrint
      ? "Proves urgency around turnaround and fulfillment."
      : designTool
        ? "Proves demand for visual creation and editing workflows."
        : manualService
          ? "Offers human judgment and custom revisions."
          : "Adds context but needs direct user validation.",
    gap: contextOnly
      ? "Does not prove adoption, willingness to pay, or an exact competing workflow."
      : apparelPlatform
      ? "May manage operations without solving faster editable design iteration before print handoff."
      : fastPrint
      ? "May not solve fast editable design iteration before printing."
      : designTool
        ? "May be too broad for print-ready customer-order revision workflows."
        : manualService
          ? "Can be slower and harder to scale for repeated small orders."
          : "The exact workflow gap is not verified yet.",
    confidence: source.verified && (source.qualityScore || 0) >= 0.5 ? "Medium" : "Low",
    sourceTitle: source.title,
    sourceUrl: source.url,
  };
}

function uniqueCompetitorSources(sources: Source[]) {
  const seen = new Set<string>();
  return sources.filter((source) => {
    if (source.type !== "competitor") return false;
    let key = source.url;
    try {
      key = new URL(source.url).hostname.replace(/^www\./, "");
    } catch {
      key = source.title.toLowerCase();
    }
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function founderAlternativeRow(name: string): AlternativeMatrixRow {
  return {
    name,
    type: "Current workaround",
    useCase: "Founder-reported way the user may solve the job today.",
    strength: "Useful because it reflects current behavior to verify in interviews.",
    gap: "Needs direct confirmation from the exact first user segment.",
    confidence: "Low",
  };
}

function fallbackTitle(profile: FounderProfile) {
  const words = profile.rawIdea
    .replace(/web\s*app|app|platform|software|tool|system|using ai|with ai/gi, " ")
    .split(/[^a-z0-9]+/i)
    .filter((word) => word.length > 2 && !/^(the|and|for|that|lets|users|build|trying|create|help|helps)$/i.test(word))
    .slice(0, 4);
  return `${titleCase(words.join(" ") || "Founder Validation")} Workspace`;
}

function opportunityItems(profile: FounderProfile, research?: ResearchPack): OpportunityItem[] {
  const officialSources = (research?.sources || []).filter((source) => source.type === "official").slice(0, 3);
  const fromSources = officialSources.map((source) => ({
    name: source.title,
    whyRelevant: "Official source that may support mentorship, grants, recognition, or ecosystem access.",
    nextAction: "Open the official page and verify current eligibility before relying on it.",
    eligibilityUncertainty: "Eligibility is unverified until checked against the latest official criteria.",
    sourceTitle: source.title,
    sourceUrl: source.url,
  }));
  if (fromSources.length) return fromSources;
  if (/india|mumbai|delhi|pune|bengaluru|bangalore|hyderabad|chennai|kolkata/i.test(profile.location)) {
    return [
      {
        name: "Startup India / DPIIT / MAARG",
        whyRelevant: "Potential founder support paths for India-based startups after problem validation.",
        nextAction: "Check official pages for recognition, mentorship, and scheme requirements.",
        eligibilityUncertainty: "Do not assume eligibility; requirements and availability may change.",
      },
    ];
  }
  return [
    {
      name: "University incubators and founder communities",
      whyRelevant: "Useful for interview access, mentors, and early pilot users after the problem is narrowed.",
      nextAction: "Ask for warm introductions to five people in the target segment.",
      eligibilityUncertainty: "Program fit depends on location, affiliation, and stage.",
    },
  ];
}

export function normalizeFounderBrief(profile: FounderProfile, evidence?: EvidenceScore, research?: ResearchPack): NormalizedFounderBrief {
  const alternatives = splitAlternatives(profile.currentAlternatives);
  const noIdea = isNoIdea(profile);
  const tshirt = isTshirtIdea(profile);
  const constraints = [
    `${profile.hoursPerWeek} hours/week available`,
    `Budget: ${profile.budget}`,
    `Team: ${profile.teamStatus}`,
    `Skills: ${profile.skills.length ? profile.skills.join(", ") : "not specified"}`,
  ];

  const evidenceSummary = profile.traction && !/no proof yet|none|not sure/i.test(profile.traction)
    ? sentence(profile.traction)
    : "No direct user, usage, payment, or pilot evidence has been collected yet.";

  if (noIdea) {
    const user = shortSentence(profile.targetUser || "one reachable community", "one reachable community");
    const firstStep = "Interview eight people from one accessible community and rank repeated, painful workflows before choosing a solution.";
    return {
      cleanStartupTitle: "Problem Discovery Workspace",
      oneLineIdea: `A structured discovery process for finding one painful problem inside ${user.toLowerCase()}.`,
      originalIdeaSummary: "The founder has not selected a startup idea yet.",
      refinedIdea: `Problem Discovery Mode for ${user}: identify one repeated manual workflow through interviews before selecting a product.`,
      targetUserSegment: user,
      primaryUser: user,
      problemStatement: "A repeated, urgent problem has not yet been selected.",
      valueProposition: "Reduce wasted build time by choosing a problem from observed user behavior instead of guessing.",
      currentAlternatives: alternatives,
      evidenceSummary,
      founderConstraints: constraints,
      firstValidationStep: firstStep,
      researchFocus: "Find repeated problems, current workarounds, urgency, and reachable first users.",
      cleanPitchContext: "Discovery before solution design.",
      positioning: "Not a product idea yet. A disciplined problem-selection workflow.",
      marketRealitySummary: "No market conclusion should be made until one problem and user segment are selected.",
      whyThisIsSharper: "It avoids inventing a solution before the founder has evidence of a painful repeated job.",
      nextBestAction: firstStep,
      directCompetitors: [],
      indirectAlternatives: alternatives.map(founderAlternativeRow),
      noDirectCompetitorMessage: "No direct competitor analysis is appropriate until the founder selects a specific problem.",
      riskRegister: [
        {
          assumption: "The reachable community has a repeated painful workflow worth solving.",
          whyItMatters: "Without repeated pain, there is no useful wedge.",
          riskLevel: "High",
          test: firstStep,
          successSignal: "At least five people independently describe the same costly workflow.",
          stopOrPivotTrigger: "If problems are scattered or low-urgency, choose a different community.",
        },
      ],
      mvpPlan: {
        goal: "Select one validated problem, not a product.",
        manualPilot: "Run interviews and maintain a problem evidence ledger.",
        mustHave: ["Interview script", "Problem ranking table", "Evidence ledger", "Decision memo"],
        doNotBuildYet: ["App UI", "Automation", "Landing page", "Payments", "Marketplace"],
        successMetric: "One problem repeated by at least five reachable users with a clear current workaround.",
      },
      roadmapPlan: {
        next24Hours: [firstStep, "Write down the top three suspected problems.", "Schedule the first three conversations."],
        sevenDaySprint: ["Complete eight discovery interviews.", "Cluster repeated problems.", "Select one problem with urgency and access."],
        thirtyDayPilot: ["Run a manual solution test for the selected problem.", "Track behavior, not compliments.", "Decide continue, narrow, or stop."],
        sixtyNinetyDays: ["Automate only after repeated manual demand.", "Document willingness to pay or repeated use."],
        stopPivotCriteria: "Stop if no repeated problem appears after two accessible communities.",
      },
      opportunities: opportunityItems(profile, research),
    };
  }

  if (tshirt) {
    const firstStep = "Interview 5 small apparel sellers or campus merch creators about their last custom T-shirt order, revision time, current tools, handoff to printing, and where delays happened. Do not pitch the solution yet.";
    const rowsFromSources = uniqueCompetitorSources(research?.sources || []).slice(0, 5).map(sourceAlternativeRow);
    const exactAiApparel = (name: string) => /(?:\bai\b|artificial intelligence)/i.test(name)
      && /t-?shirt|apparel|shirt|merch/i.test(name)
      && /design|mockup|generator|workspace|editor/i.test(name);
    const direct = rowsFromSources.filter((row) => exactAiApparel(row.name)).slice(0, 3);
    const indirect = [...rowsFromSources.filter((row) => !direct.includes(row)), ...alternatives.map(founderAlternativeRow)].slice(0, 8);
    return {
      cleanStartupTitle: "AI T-Shirt Design Workspace",
      oneLineIdea: "An AI-assisted workspace that helps small apparel sellers generate, edit, and preview print-ready T-shirt mockups faster.",
      originalIdeaSummary: "A web app where users prompt T-shirt designs, preview them on shirts, customize material and color, and modify parts of the design.",
      refinedIdea: "A focused AI-assisted design workflow for small custom apparel sellers to generate, revise, and preview print-ready T-shirt mockups before printing.",
      targetUserSegment: "Small custom apparel sellers, print shops, campus merch creators, and creators handling custom orders.",
      primaryUser: "Small custom apparel sellers and print shops",
      secondaryUser: "Campus merch creators and creators handling custom apparel orders",
      problemStatement: "Custom apparel workflows are slow because sellers move between design tools, mockups, customer feedback, and print preparation.",
      valueProposition: "Reduce design iteration time by helping users generate, revise, and preview apparel designs in one focused workflow.",
      currentAlternatives: alternatives.length ? alternatives : ["Design tools", "Printing services", "Manual designers", "Customer reference images"],
      evidenceSummary,
      founderConstraints: constraints,
      firstValidationStep: evidence?.nextValidationStep?.includes("Interview five")
        ? firstStep
        : firstStep,
      researchFocus: "Validate whether sellers need faster editable design iteration before printing, not another broad design tool.",
      cleanPitchContext: "Apparel sellers need faster customer-order revision loops before print handoff.",
      positioning: "Not another generic design tool. A faster revision workflow for print-ready apparel mockups.",
      marketRealitySummary: "Same-day custom T-shirt services prove urgency around turnaround time. Design software and print platforms prove existing demand for custom apparel creation. The gap to test is whether sellers need faster editable AI-assisted design iteration before printing.",
      whyThisIsSharper: "It narrows the idea from general AI T-shirt generation to the measurable workflow delay between customer idea, editable design revision, mockup approval, and print handoff.",
      nextBestAction: firstStep,
      directCompetitors: direct,
      indirectAlternatives: indirect.length ? indirect : ["Fast custom printing services", "T-shirt design software", "Print platforms", "Manual designers"].map(founderAlternativeRow),
      noDirectCompetitorMessage: direct.length ? undefined : "No exact direct competitor was verified in this run. LaunchPilot found adjacent tools, print services, and manual alternatives instead.",
      riskRegister: [
        {
          assumption: "Small apparel sellers lose meaningful time during customer design revision before printing.",
          whyItMatters: "If revision time is not painful, AI mockup generation will be a novelty rather than a workflow wedge.",
          riskLevel: "High",
          test: firstStep,
          successSignal: "At least 3 of 5 sellers describe repeated delays, tool switching, or customer revision friction in recent orders.",
          stopOrPivotTrigger: "If sellers say existing design tools and printers are already fast enough, narrow to a different apparel workflow.",
        },
        {
          assumption: "Users need editable, print-ready iteration more than broad design generation.",
          whyItMatters: "The MVP must solve the handoff/revision job, not create generic art.",
          riskLevel: "Medium",
          test: "Run a concierge demo where one user requests a design, asks for a revision, and receives a mockup/export preview.",
          successSignal: "Users ask for another revision or request to use it on a real order.",
          stopOrPivotTrigger: "If users only treat outputs as inspiration, reposition around ideation or drop print-ready claims.",
        },
      ],
      mvpPlan: {
        goal: "Prove one faster T-shirt order revision workflow before building a full apparel platform.",
        manualPilot: "Concierge web demo: user enters prompt, receives 3 design concepts, edits one region/color/material, then receives a mockup and export-ready preview.",
        mustHave: ["Prompt-to-design concepts", "T-shirt mockup preview", "One-region or color edit", "Export-ready preview", "Revision time tracking"],
        doNotBuildYet: ["Marketplace", "Full e-commerce", "Advanced billing", "Team admin", "Full print fulfillment", "Broad apparel catalog"],
        successMetric: "3 of 5 pilot users complete a design revision and say it is faster than their current workflow.",
      },
      roadmapPlan: {
        next24Hours: [firstStep, "Create a one-page concierge demo outline.", "Prepare five interview questions about last order, tools, revision time, and print handoff."],
        sevenDaySprint: ["Complete 5 seller or campus merch interviews.", "Map every tool used from customer request to print file.", "Run one manual mockup/revision demo with a real order."],
        thirtyDayPilot: ["Serve 3-5 real custom-order workflows manually.", "Measure revision time, number of edits, and export handoff issues.", "Charge or request a concrete commitment only after repeated value appears."],
        sixtyNinetyDays: ["Automate the repeated edit/mockup workflow.", "Add integrations only for tools used repeatedly in pilot evidence.", "Delay fulfillment, marketplace, and admin features until retention is visible."],
        stopPivotCriteria: "Stop or narrow if interviews do not show repeated revision friction or if pilots do not reduce time versus existing tools.",
      },
      opportunities: opportunityItems(profile, research),
    };
  }

  const target = shortSentence(profile.targetUser, "a specific reachable first user segment");
  const problem = shortSentence(profile.whyItMatters, "the current workflow is slow, costly, or frustrating");
  const title = fallbackTitle(profile);
  const firstStep = evidence?.nextValidationStep || `Interview five ${target.toLowerCase()} and collect recent examples of the problem before showing a solution.`;
  const rows = uniqueCompetitorSources(research?.sources || []).slice(0, 6).map(sourceAlternativeRow);
  const direct = rows.filter((row) => row.type === "Adjacent product").slice(0, 4);
  const indirect = [...rows.filter((row) => row.type !== "Adjacent product"), ...alternatives.map(founderAlternativeRow)].slice(0, 8);

  return {
    cleanStartupTitle: title,
    oneLineIdea: `A focused workspace that helps ${target.toLowerCase()} solve ${problem.toLowerCase()}.`,
    originalIdeaSummary: shortSentence(profile.rawIdea, "A rough startup idea"),
    refinedIdea: `${shortSentence(profile.rawIdea, "A focused startup idea").replace(/\.$/, "")}, narrowed first to ${target.toLowerCase()} and validated through a manual pilot before broader automation.`,
    targetUserSegment: target,
    primaryUser: target,
    problemStatement: problem,
    valueProposition: `Help ${target.toLowerCase()} solve the most painful part of this workflow faster, before building a broad platform.`,
    currentAlternatives: alternatives,
    evidenceSummary,
    founderConstraints: constraints,
    firstValidationStep: firstStep,
    researchFocus: "Validate urgency, current alternatives, switching friction, and the narrowest workflow worth piloting.",
    cleanPitchContext: `${target} need a faster, narrower way to solve ${problem.toLowerCase()}.`,
    positioning: "A narrower workflow wedge, not a broad all-in-one product.",
    marketRealitySummary: direct.length
      ? "LaunchPilot found adjacent alternatives. The first test is whether the founder can beat one narrow workflow, not the entire category."
      : "No exact direct competitor was verified in this run. Treat adjacent sources and founder-reported workarounds as market context until user interviews confirm behavior.",
    whyThisIsSharper: "It moves from a broad product concept to a specific user, problem, and testable first workflow.",
    nextBestAction: firstStep,
    directCompetitors: direct,
    indirectAlternatives: indirect,
    noDirectCompetitorMessage: direct.length ? undefined : "No exact direct competitor was verified in this run. LaunchPilot found adjacent tools, services, and manual alternatives instead.",
    riskRegister: [
      {
        assumption: `${target} experience this problem frequently enough to change behavior.`,
        whyItMatters: "This is the core demand risk.",
        riskLevel: "High",
        test: firstStep,
        successSignal: "At least 3 of 5 users describe a recent costly example and a current workaround.",
        stopOrPivotTrigger: "If users do not have recent examples, narrow the segment or choose a stronger problem.",
      },
      {
        assumption: "The outcome can be delivered manually before broad automation.",
        whyItMatters: "A manual pilot proves value faster than a full build.",
        riskLevel: "Medium",
        test: "Run one concierge pilot with a real user and measure completion.",
        successSignal: "The user completes the workflow and asks to repeat it or involve another user.",
        stopOrPivotTrigger: "If manual delivery is too hard or low-value, reduce the scope again.",
      },
    ],
    mvpPlan: {
      goal: "Test one narrow workflow and one behavioral success signal.",
      manualPilot: "Deliver the promised outcome manually or semi-manually for 3-5 users before building broad automation.",
      mustHave: ["One user workflow", "Simple intake", "Manual delivery path", "Success metric capture", "Feedback log"],
      doNotBuildYet: ["Marketplace", "Complex billing", "Team admin", "Advanced analytics", "Broad integrations"],
      successMetric: "3 of 5 pilot users complete the workflow and show concrete intent to repeat or pay.",
    },
    roadmapPlan: {
      next24Hours: [firstStep, "Write the riskiest assumption and its failure signal.", "Recruit the first three interviews."],
      sevenDaySprint: ["Complete five problem interviews.", "Compare current alternatives and switching friction.", "Choose continue, narrow, or stop."],
      thirtyDayPilot: ["Run a manual pilot with 3-5 users.", "Track activation, repeat use, and concrete commitment.", "Avoid broad features without repeat behavior."],
      sixtyNinetyDays: ["Automate only the validated workflow.", "Review retention and willingness to pay.", "Stop or pivot if the success signal is absent after two focused tests."],
      stopPivotCriteria: "If two focused tests fail to produce behavioral evidence, narrow the user/problem instead of adding features.",
    },
    opportunities: opportunityItems(profile, research),
  };
}
