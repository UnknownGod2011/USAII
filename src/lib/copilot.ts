import {
  getProviderPoolStatus,
  providerErrorFromResponse,
  runWithProviderKey,
} from "./providers/keyPool";

export type CopilotWorkspaceRecord = {
  id: string;
  type: string;
  title: string;
  contentJson: string;
  markdown: string;
  confidence: string;
};

export type CopilotSourceRecord = {
  id: string;
  title: string;
  url: string;
  snippet: string;
  sourceType: string;
  limitation: string;
  confidence: string;
};

export type CopilotReference = {
  id: string;
  label: string;
  kind: "workspace" | "source";
  url?: string;
};

function tokens(value: string) {
  return value.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 2);
}

function intentTerms(question: string) {
  const lower = question.toLowerCase();
  const terms = new Set(tokens(question));
  const add = (...values: string[]) => values.forEach((value) => terms.add(value));
  if (/today|next|first|now|24 hour|do/.test(lower)) add("roadmap", "bottleneck", "validation", "step");
  if (/competitor|alternative/.test(lower)) add("competitors", "alternatives", "market", "sources");
  if (/risk|wrong|fail|assumption/.test(lower)) add("risks", "assumptions", "evidence");
  if (/mvp|feature|build|prototype/.test(lower)) add("mvp", "scope", "roadmap");
  if (/startup india|dpiit|maarg|program|grant|incubator/.test(lower)) add("opportunity", "programs", "support");
  if (/pitch|headline|message|interview/.test(lower)) add("pitch", "communication", "interview");
  if (/score|low|verdict|evidence/.test(lower)) add("research", "verdict", "sources", "evidence");
  return terms;
}

function workspaceText(record: CopilotWorkspaceRecord) {
  try {
    const parsed = JSON.parse(record.contentJson) as { content?: string };
    return `${record.type} ${record.title} ${parsed.content || record.markdown}`;
  } catch {
    return `${record.type} ${record.title} ${record.markdown}`;
  }
}

export function retrieveWorkspaceContext(
  question: string,
  workspace: CopilotWorkspaceRecord[],
  sources: CopilotSourceRecord[],
) {
  const expected = intentTerms(question);
  const score = (value: string) => tokens(value).reduce((total, token) => total + (expected.has(token) ? 2 : 0), 0);
  const workspaceMatches = workspace
    .filter((item) => item.type !== "Launch Brief")
    .map((item) => {
      let content = item.markdown;
      try {
        content = (JSON.parse(item.contentJson) as { content?: string }).content || item.markdown;
      } catch {
        // Markdown remains the safe fallback.
      }
      const text = workspaceText(item);
      return { item, content, text, score: score(text) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
  const sourceMatches = sources
    .map((source) => ({ source, score: score(`${source.title} ${source.snippet} ${source.sourceType}`) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  return {
    workspace: workspaceMatches.map(({ item, content, text }) => ({ id: item.id, type: item.type, title: item.title, content, text })),
    sources: sourceMatches.map(({ source }) => source),
    references: [
      ...workspaceMatches.map(({ item }): CopilotReference => ({ id: item.id, label: item.type, kind: "workspace" })),
      ...sourceMatches.map(({ source }): CopilotReference => ({ id: source.id, label: source.title, kind: "source", url: source.url })),
    ],
  };
}

function contextLine(context: ReturnType<typeof retrieveWorkspaceContext>, type: string) {
  return context.workspace.find((item) => item.type.toLowerCase().includes(type.toLowerCase()))?.content;
}

function deterministicAnswer(question: string, context: ReturnType<typeof retrieveWorkspaceContext>) {
  const lower = question.toLowerCase();
  const bottleneck = contextLine(context, "Current Bottleneck");
  const roadmap = contextLine(context, "Roadmap");
  const competitors = contextLine(context, "Competitors");
  const risks = contextLine(context, "Risks");
  const opportunities = contextLine(context, "Opportunity");
  const research = contextLine(context, "Research");

  if (lower.includes("drop out")) {
    return `I would not recommend making a dropout decision from this evidence. ${bottleneck || "The startup is still in validation."} The workspace does not establish stable revenue, runway, or repeat demand. Keep school as the default while validating for 60-90 days.`;
  }
  if (/investor|fund|yc/.test(lower)) {
    return `Investor outreach is premature. ${bottleneck || "Direct validation is still incomplete."} Complete the next validation sprint and collect repeat-use or payment evidence before fundraising.`;
  }
  if (/competitor|alternative/.test(lower)) {
    return competitors || "The workspace does not contain a sufficiently verified competitor set. Ask target users what they currently use before claiming differentiation.";
  }
  if (/startup india|dpiit|maarg|program|grant|incubator/.test(lower)) {
    return `${opportunities || "No current program was verified in this research run."} Verify eligibility on the official source before applying; a program is support, not demand evidence.`;
  }
  if (/score|low|verdict|evidence/.test(lower)) {
    return `${research || "The current score reflects limited evidence."} The practical response is to strengthen the weakest evidence dimension with direct user behavior.`;
  }
  if (/risk|wrong|fail|assumption/.test(lower)) {
    return risks || "The main unresolved risk is whether the stated target user experiences the problem urgently enough to change behavior.";
  }
  if (/today|next|first|now|what should i do/.test(lower)) {
    return roadmap || bottleneck || "Complete five problem interviews and record current behavior before building more.";
  }
  return `${bottleneck || "The startup is still in an evidence-building stage."} ${roadmap || "Focus on one direct validation action before expanding scope."}`;
}

async function modelAnswer(question: string, context: ReturnType<typeof retrieveWorkspaceContext>) {
  if (!getProviderPoolStatus("gemini").available) return undefined;
  return runWithProviderKey("gemini", async (key) => {
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `You are LaunchPilot Copilot, a focused founder execution advisor.
Use only the supplied workspace and sources. Do not invent facts. Do not predict success, funding, accelerator acceptance, or official eligibility. Do not make major life decisions. If evidence is weak, say so. Give one concrete next action. Cite workspace references in square brackets using their exact type, for example [Roadmap].

Question: ${question}
Workspace: ${JSON.stringify(context.workspace)}
Sources: ${JSON.stringify(context.sources)}`,
          }],
        }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 420 },
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw providerErrorFromResponse("gemini", response);
    return data?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("\n").trim() || undefined;
  });
}

export async function answerWithWorkspace(
  question: string,
  workspace: CopilotWorkspaceRecord[],
  sources: CopilotSourceRecord[],
) {
  const context = retrieveWorkspaceContext(question, workspace, sources);
  const highRisk = /drop out|investor|fund|yc|startup india|dpiit|maarg/i.test(question);
  const answer = highRisk ? deterministicAnswer(question, context) : await modelAnswer(question, context).catch(() => undefined) || deterministicAnswer(question, context);
  return { answer, references: context.references };
}
