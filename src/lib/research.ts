import { generateLaunchBrief } from "./agents";
import type { EvidenceClaim, ResearchSource } from "./intake/schema";
import {
  getProviderPoolStatus,
  providerErrorFromResponse,
  runWithProviderKey,
} from "./providers/keyPool";
import type { FounderProfile, LaunchBrief, ResearchPack, Source } from "./types";

const fetchTimeoutMs = 7000;
const maxVerifiedPages = 18;

type QueryPlanItem = ResearchPack["plan"][number];
type SearchProviderName = NonNullable<Source["provider"]>;
type RawSearchResult = {
  title: string;
  url: string;
  snippet: string;
  provider: SearchProviderName;
  query: string;
  category: QueryPlanItem["category"];
};

function tokens(value: string) {
  return new Set(
    value
      .toLowerCase()
      .replace(/https?:\/\/\S+/g, " ")
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 2 && !["with", "from", "that", "this", "have", "will", "startup", "idea"].includes(token)),
  );
}

function overlapScore(reference: string, candidate: string) {
  const expected = tokens(reference);
  const actual = tokens(candidate);
  if (!expected.size) return 0;
  return Math.min(1, Array.from(expected).filter((token) => actual.has(token)).length / Math.min(expected.size, 8));
}

function canonicalUrl(value: string) {
  try {
    const url = new URL(value);
    url.hash = "";
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "ref"].forEach((key) => url.searchParams.delete(key));
    return url.toString().replace(/\/$/, "");
  } catch {
    return value.trim();
  }
}

export function isMarketCompetitorUrl(value: string) {
  return Boolean(value) && !/(?:github\.com|gitlab\.com|bitbucket\.org|npmjs\.com\/package|pypi\.org\/project|sourceforge\.net\/projects)/i.test(value);
}

function host(value: string) {
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isIndia(profile: FounderProfile) {
  return /india|bengaluru|bangalore|delhi|mumbai|pune|hyderabad|chennai|kolkata/i.test(profile.location);
}

function cleanIdea(profile: FounderProfile) {
  return profile.rawIdea.replace(/\s+/g, " ").trim();
}

export function createResearchPlan(profile: FounderProfile): QueryPlanItem[] {
  const idea = cleanIdea(profile);
  const target = profile.targetUser.trim();
  const problem = profile.whyItMatters.trim();
  const location = profile.location.trim();
  const plan: QueryPlanItem[] = [
    {
      id: "problem-language",
      query: `"${target}" ${problem} complaints reviews`,
      category: "problem",
      purpose: "Find first-hand language showing whether the stated problem recurs.",
      preferredSources: ["reviews", "community discussions", "user interviews"],
    },
    {
      id: "demand-signals",
      query: `${target} ${problem} software demand`,
      category: "demand",
      purpose: "Find behavior, spending, or repeated attempts to solve the problem.",
      preferredSources: ["reviews", "datasets", "credible market analysis"],
    },
    {
      id: "community-language",
      query: `${target} "${problem}" forum discussion`,
      category: "demand",
      purpose: "Look for repeated user language and current workarounds in public discussions.",
      preferredSources: ["community discussions", "reviews", "professional forums"],
    },
    {
      id: "direct-competitors",
      query: `${idea} alternatives software for ${target}`,
      category: "competitor",
      purpose: "Find products serving the same user and job, not source-code repositories.",
      preferredSources: ["company websites", "product directories", "review platforms"],
    },
    {
      id: "competitor-reviews",
      query: `${idea} competitor reviews complaints ${target}`,
      category: "competitor",
      purpose: "Cross-check competitor claims against customer reviews and recurring complaints.",
      preferredSources: ["review platforms", "customer discussions", "product directories"],
    },
    {
      id: "current-alternatives",
      query: `${target} how to solve ${problem}`,
      category: "competitor",
      purpose: "Find manual, service, spreadsheet, and do-nothing alternatives.",
      preferredSources: ["guides", "community discussions", "service providers"],
    },
    {
      id: "pricing",
      query: `${idea} pricing alternatives`,
      category: "pricing",
      purpose: "Find pricing and willingness-to-pay proxies for comparable products.",
      preferredSources: ["official pricing pages", "review platforms"],
    },
    {
      id: "feasibility",
      query: `${idea} MVP implementation constraints ${location}`,
      category: "feasibility",
      purpose: "Check whether the first version fits the founder's time, budget, and skills.",
      preferredSources: ["technical documentation", "official requirements", "case studies"],
    },
    {
      id: "location-constraints",
      query: `${idea} regulations adoption constraints ${location}`,
      category: "feasibility",
      purpose: "Identify location-specific operating, regulatory, or adoption constraints.",
      preferredSources: ["official requirements", "industry associations", "credible guides"],
    },
  ];
  if (isIndia(profile)) {
    plan.push({
      id: "india-opportunities",
      query: `site:startupindia.gov.in ${target} DPIIT Recognition MAARG Investor Connect`,
      category: "opportunity",
      purpose: "Find current official support programs without assuming eligibility.",
      preferredSources: ["official government pages"],
    });
    plan.push({
      id: "india-schemes",
      query: `site:startupindia.gov.in government schemes directory startup ${location}`,
      category: "opportunity",
      purpose: "Find the current official schemes directory and preserve eligibility uncertainty.",
      preferredSources: ["official government pages"],
    });
  }
  return plan;
}

async function fetchWithTimeout(url: string, init?: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), fetchTimeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        "User-Agent": "LaunchPilotAI/1.0 evidence-research",
        ...(init?.headers || {}),
      },
      cache: "no-store",
    });
  } finally {
    clearTimeout(timeout);
  }
}

function responseMessage(data: unknown) {
  if (!data || typeof data !== "object") return undefined;
  if ("error" in data) {
    const error = data.error;
    if (typeof error === "string") return error;
    if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  }
  return undefined;
}

async function responseJson(response: Response) {
  return response.json().catch(() => ({})) as Promise<Record<string, unknown>>;
}

async function searchGeminiGrounding(item: QueryPlanItem): Promise<RawSearchResult[]> {
  return runWithProviderKey("gemini", async (key) => {
    const response = await fetchWithTimeout("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Research this founder question using current Google Search results: ${item.query}
Return a concise evidence summary. Prefer primary company pages, official sources, reputable review platforms, datasets, and first-hand community evidence. Do not invent facts or URLs.`,
          }],
        }],
        tools: [{ googleSearch: {} }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 700 },
      }),
    });
    const data = await responseJson(response);
    if (!response.ok) throw providerErrorFromResponse("gemini", response, responseMessage(data));

    const candidate = Array.isArray(data.candidates) ? data.candidates[0] as Record<string, unknown> | undefined : undefined;
    const metadata = candidate?.groundingMetadata as Record<string, unknown> | undefined;
    const chunks = Array.isArray(metadata?.groundingChunks) ? metadata.groundingChunks as Array<Record<string, unknown>> : [];
    const supports = Array.isArray(metadata?.groundingSupports) ? metadata.groundingSupports as Array<Record<string, unknown>> : [];
    const summaries = new Map<number, string[]>();
    supports.forEach((support) => {
      const segment = support.segment as Record<string, unknown> | undefined;
      const text = typeof segment?.text === "string" ? segment.text : "";
      const indexes = Array.isArray(support.groundingChunkIndices) ? support.groundingChunkIndices : [];
      indexes.forEach((index) => {
        if (typeof index !== "number" || !text) return;
        summaries.set(index, [...(summaries.get(index) || []), text]);
      });
    });

    return chunks.flatMap((chunk, index) => {
      const web = chunk.web as Record<string, unknown> | undefined;
      const url = typeof web?.uri === "string" ? web.uri : "";
      if (!url) return [];
      return [{
        title: typeof web?.title === "string" ? web.title : host(url) || "Search result",
        url,
        snippet: (summaries.get(index) || []).join(" ").slice(0, 900),
        provider: "gemini_grounding" as const,
        query: item.query,
        category: item.category,
      }];
    });
  });
}

async function searchTavily(item: QueryPlanItem): Promise<RawSearchResult[]> {
  return runWithProviderKey("tavily", async (key) => {
    const response = await fetchWithTimeout("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        query: item.query,
        search_depth: item.category === "competitor" ? "advanced" : "basic",
        max_results: 5,
        include_answer: false,
        include_raw_content: false,
      }),
    });
    const data = await responseJson(response);
    if (!response.ok) throw providerErrorFromResponse("tavily", response, responseMessage(data));
    const results = Array.isArray(data.results) ? data.results as Array<Record<string, unknown>> : [];
    return results.map((result) => ({
      title: typeof result.title === "string" ? result.title : host(typeof result.url === "string" ? result.url : "") || "Search result",
      url: typeof result.url === "string" ? result.url : "",
      snippet: typeof result.content === "string" ? result.content : "",
      provider: "tavily" as const,
      query: item.query,
      category: item.category,
    }));
  });
}

async function searchExa(item: QueryPlanItem): Promise<RawSearchResult[]> {
  return runWithProviderKey("exa", async (key) => {
    const response = await fetchWithTimeout("https://api.exa.ai/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key },
      body: JSON.stringify({
        query: item.query,
        type: "auto",
        ...(item.category === "competitor" ? { category: "company" } : {}),
        numResults: 5,
        contents: { text: { maxCharacters: 900 } },
      }),
    });
    const data = await responseJson(response);
    if (!response.ok) throw providerErrorFromResponse("exa", response, responseMessage(data));
    const results = Array.isArray(data.results) ? data.results as Array<Record<string, unknown>> : [];
    return results.map((result) => ({
      title: typeof result.title === "string" ? result.title : host(typeof result.url === "string" ? result.url : "") || "Search result",
      url: typeof result.url === "string" ? result.url : "",
      snippet: typeof result.text === "string" ? result.text : "",
      provider: "exa" as const,
      query: item.query,
      category: item.category,
    }));
  });
}

async function searchGoogle(item: QueryPlanItem): Promise<RawSearchResult[]> {
  const cx = process.env.GOOGLE_SEARCH_ENGINE_ID;
  if (!cx) return [];
  return runWithProviderKey("google", async (key) => {
    const endpoint = new URL("https://www.googleapis.com/customsearch/v1");
    endpoint.searchParams.set("key", key);
    endpoint.searchParams.set("cx", cx);
    endpoint.searchParams.set("q", item.query);
    endpoint.searchParams.set("num", "5");
    const response = await fetchWithTimeout(endpoint.toString());
    const data = await responseJson(response);
    if (!response.ok) throw providerErrorFromResponse("google", response, responseMessage(data));
    const items = Array.isArray(data.items) ? data.items as Array<Record<string, unknown>> : [];
    return items.map((result) => ({
      title: typeof result.title === "string" ? result.title : host(typeof result.link === "string" ? result.link : "") || "Search result",
      url: typeof result.link === "string" ? result.link : "",
      snippet: typeof result.snippet === "string" ? result.snippet : "",
      provider: "google" as const,
      query: item.query,
      category: item.category,
    }));
  });
}

async function searchSerpApi(item: QueryPlanItem): Promise<RawSearchResult[]> {
  return runWithProviderKey("serpapi", async (key) => {
    const endpoint = new URL("https://serpapi.com/search");
    endpoint.searchParams.set("api_key", key);
    endpoint.searchParams.set("engine", "google");
    endpoint.searchParams.set("q", item.query);
    endpoint.searchParams.set("num", "5");
    const response = await fetchWithTimeout(endpoint.toString());
    const data = await responseJson(response);
    if (!response.ok || typeof data.error === "string") {
      throw providerErrorFromResponse("serpapi", response, responseMessage(data));
    }
    const results = Array.isArray(data.organic_results) ? data.organic_results as Array<Record<string, unknown>> : [];
    return results.map((result) => ({
      title: typeof result.title === "string" ? result.title : host(typeof result.link === "string" ? result.link : "") || "Search result",
      url: typeof result.link === "string" ? result.link : "",
      snippet: typeof result.snippet === "string" ? result.snippet : "",
      provider: "serpapi" as const,
      query: item.query,
      category: item.category,
    }));
  });
}

export function configuredResearchProviderNames(env: NodeJS.ProcessEnv = process.env) {
  const names: Array<"gemini" | "tavily" | "exa" | "serpapi" | "google"> = [];
  if (getProviderPoolStatus("gemini", env).available) names.push("gemini");
  if (getProviderPoolStatus("tavily", env).available) names.push("tavily");
  if (getProviderPoolStatus("exa", env).available) names.push("exa");
  if (getProviderPoolStatus("serpapi", env).available) names.push("serpapi");
  if (getProviderPoolStatus("google", env).available && env.GOOGLE_SEARCH_ENGINE_ID) names.push("google");
  return names;
}

async function executeSearchPlan(plan: QueryPlanItem[], logs: string[]) {
  const providers = [
    { configured: () => getProviderPoolStatus("gemini").available, search: searchGeminiGrounding },
    { configured: () => getProviderPoolStatus("tavily").available, search: searchTavily },
    { configured: () => getProviderPoolStatus("exa").available, search: searchExa },
    { configured: () => getProviderPoolStatus("serpapi").available, search: searchSerpApi },
    {
      configured: () => getProviderPoolStatus("google").available && Boolean(process.env.GOOGLE_SEARCH_ENGINE_ID),
      search: searchGoogle,
    },
  ];
  const active = providers.filter((provider) => provider.configured());
  const results: RawSearchResult[] = [];
  let cursor = 0;
  const workers = Array.from({ length: Math.min(3, plan.length) }, async () => {
    while (cursor < plan.length) {
      const item = plan[cursor];
      cursor += 1;
      for (const provider of active) {
        try {
          const found = (await provider.search(item)).filter((result) => result.url && result.title);
          if (found.length) {
            results.push(...found);
            break;
          }
        } catch {
          // Continue through the ordered provider chain without exposing provider details in product logs.
        }
      }
    }
  });
  await Promise.all(workers);
  logs.push(`Retrieved ${results.length} search results across ${plan.length} research questions.`);
  return results;
}

async function fetchPageEvidence(result: RawSearchResult) {
  try {
    const response = await fetchWithTimeout(result.url, { headers: { Accept: "text/html,application/xhtml+xml" } });
    const resolvedUrl = canonicalUrl(response.url || result.url);
    if (!response.ok) return { verified: false, content: result.snippet, resolvedUrl };
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
      return { verified: true, content: result.snippet, resolvedUrl };
    }
    const html = await response.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;|&#160;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim();
    const accessWall = /(?:sign in join now|log in sign up|please wait for verification|enable javascript to continue)/i.test(text.slice(0, 500));
    return { verified: text.length > 80 && !accessWall, content: text.slice(0, 1200) || result.snippet, resolvedUrl };
  } catch {
    return { verified: false, content: result.snippet, resolvedUrl: result.url };
  }
}

function classifySource(result: RawSearchResult, content = ""): ResearchSource["sourceType"] {
  const domain = host(result.url);
  const pathname = (() => {
    try { return new URL(result.url).pathname.toLowerCase(); } catch { return ""; }
  })();
  const text = `${domain} ${result.title} ${content.slice(0, 500)}`.toLowerCase();
  if (/\.gov\.|worldbank\.org|oecd\.org|europa\.eu|startupindia\.gov\.in/.test(text)) return "official";
  if (/g2\.com|capterra\.com|trustpilot\.com|play\.google\.com|apps\.apple\.com/.test(text)) return "review";
  if (/reddit\.com|news\.ycombinator\.com|indiehackers\.com/.test(text)) return "community_signal";
  if (/statista|gartner|forrester|marketresearch|grandviewresearch/.test(text)) return "market_report";
  if (/data\.|dataset|kaggle\.com/.test(text)) return "dataset";
  const looksLikeArticle = /\b(?:best|top \d+|alternatives|comparison|roundup|guide|how to|review of|tactics|strategies|ways)\b/i.test(result.title)
    || /^(?:how|why|what|the challenges)\b/i.test(result.title)
    || /\/(?:blog|resources?|guides?|articles?|news)\//.test(pathname)
    || /medium\.com|substack\.com|forbes\.com|techcrunch\.com|wikipedia\.org/.test(domain);
  const looksLikeProduct = /\b(?:pricing|features|product|platform|solution|customers|book a demo|start free|sign up)\b/i.test(text);
  if ((result.category === "competitor" || result.category === "pricing") && !looksLikeArticle && looksLikeProduct) return "competitor";
  return "blog";
}

function sourceQuality(type: ResearchSource["sourceType"], verified: boolean, url: string) {
  const base: Record<ResearchSource["sourceType"], number> = {
    official: 0.95,
    competitor: 0.82,
    review: 0.8,
    dataset: 0.86,
    market_report: 0.7,
    community_signal: 0.58,
    blog: 0.42,
    fallback: 0.15,
  };
  let score = base[type] - (verified ? 0 : 0.18);
  if (/github\.com/i.test(url)) score = Math.min(score, 0.35);
  return Math.max(0, Math.min(1, score));
}

function sourceLimitation(type: ResearchSource["sourceType"], verified: boolean) {
  if (!verified) return "The result was discovered through search, but the source page could not be independently opened in this run.";
  if (type === "official") return "Official context may describe programs or macro conditions rather than customer demand.";
  if (type === "competitor") return "A product page describes the vendor's claims; customer adoption and satisfaction still need independent validation.";
  if (type === "review") return "Review-platform users may not represent the exact first target segment.";
  if (type === "community_signal") return "A public discussion is directional evidence, not proof of representative demand or willingness to pay.";
  if (type === "market_report") return "Market reports may use broad categories or promotional estimates that do not match the initial segment.";
  return "The source provides context but may not directly validate the startup's exact user, urgency, or willingness to pay.";
}

async function normalizeSources(profile: FounderProfile, rawResults: RawSearchResult[], logs: string[]): Promise<ResearchSource[]> {
  const unique = new Map<string, RawSearchResult>();
  rawResults.forEach((result) => {
    const url = canonicalUrl(result.url);
    if (!isMarketCompetitorUrl(url)) return;
    const key = url.toLowerCase();
    if (!unique.has(key) || result.snippet.length > (unique.get(key)?.snippet.length || 0)) unique.set(key, { ...result, url });
  });
  logs.push(`Removed ${rawResults.length - unique.size} duplicate or source-code-only results.`);

  const candidates = Array.from(unique.values()).slice(0, maxVerifiedPages);
  const fetched = await Promise.all(candidates.map(async (result) => ({ result, page: await fetchPageEvidence(result) })));
  const context = `${profile.rawIdea} ${profile.targetUser} ${profile.whyItMatters}`;
  const sources = fetched.map(({ result, page }, index): ResearchSource => {
    const sourceType = classifySource({ ...result, url: page.resolvedUrl }, page.content);
    const relevanceScore = Math.max(
      overlapScore(context, `${result.title} ${result.snippet} ${page.content}`),
      overlapScore(result.query, `${result.title} ${result.snippet} ${page.content}`),
    );
    const qualityScore = sourceQuality(sourceType, page.verified, page.resolvedUrl);
    return {
      id: `source-${index + 1}`,
      title: result.title.trim(),
      url: page.resolvedUrl,
      snippet: page.content.slice(0, 420) || result.snippet.slice(0, 420),
      sourceType,
      supports: result.category,
      limitation: sourceLimitation(sourceType, page.verified),
      confidence: qualityScore >= 0.78 && relevanceScore >= 0.35 ? "high" : qualityScore >= 0.48 && relevanceScore >= 0.2 ? "medium" : "low",
      provider: result.provider,
      query: result.query,
      verified: page.verified,
      relevanceScore,
      qualityScore,
    };
  }).filter((source) =>
    isMarketCompetitorUrl(source.url)
    && (source.relevanceScore >= 0.16 || source.sourceType === "official"),
  );
  logs.push(`Opened ${fetched.filter(({ page }) => page.verified).length} source pages and retained ${sources.length} relevant sources.`);
  return sources;
}

export function sourceCanBePresentedAsVerified(source: ResearchSource) {
  return source.verified && source.qualityScore >= 0.7 && source.relevanceScore >= 0.2;
}

function claimConfidence(source: ResearchSource): EvidenceClaim["confidence"] {
  if (source.qualityScore >= 0.78 && source.relevanceScore >= 0.35) return "high";
  if (source.qualityScore >= 0.48 && source.relevanceScore >= 0.2) return "medium";
  return "low";
}

export function buildEvidenceClaims(profile: FounderProfile, sources: ResearchSource[]): EvidenceClaim[] {
  const claims: EvidenceClaim[] = [
    {
      id: "claim-founder-problem",
      claim: `${profile.targetUser} experiences: ${profile.whyItMatters}`,
      category: "problem",
      evidenceType: "founder_statement",
      sourceIds: [],
      support: "supports",
      confidence: "low",
      limitation: "This is the founder's current hypothesis until target users confirm it.",
      relevanceScore: 1,
      qualityScore: 0.35,
    },
    {
      id: "claim-founder-feasibility",
      claim: `The founder has ${profile.hoursPerWeek} hours per week, a budget of ${profile.budget}, and skills in ${profile.skills.join(", ") || "an unspecified area"}.`,
      category: "feasibility",
      evidenceType: "founder_statement",
      sourceIds: [],
      support: "supports",
      confidence: "medium",
      limitation: "Founder constraints and skills are self-reported.",
      relevanceScore: 1,
      qualityScore: 0.6,
    },
  ];

  sources.forEach((source, index) => {
    const category: EvidenceClaim["category"] =
      source.sourceType === "competitor" ? "competitor"
        : source.supports === "pricing" ? "pricing"
          : source.supports === "opportunity" ? "opportunity"
            : source.supports === "feasibility" ? "feasibility"
              : source.sourceType === "community_signal" || source.sourceType === "review" ? "demand"
                : source.supports === "problem" ? "problem" : "risk";
    const evidenceType: EvidenceClaim["evidenceType"] =
      source.sourceType === "official" ? "official"
        : source.sourceType === "competitor" ? "competitor_primary"
          : source.sourceType === "review" ? "review"
            : source.sourceType === "community_signal" ? "community_signal"
              : source.sourceType === "market_report" ? "market_report"
                : source.sourceType === "dataset" ? "dataset" : "inference";
    claims.push({
      id: `claim-source-${index + 1}`,
      claim: `${source.title}: ${source.snippet.slice(0, 260)}`,
      category,
      evidenceType,
      sourceIds: [source.id || `source-${index + 1}`],
      support: source.relevanceScore >= 0.28 ? "supports" : "context_only",
      confidence: claimConfidence(source),
      limitation: source.limitation,
      relevanceScore: source.relevanceScore,
      qualityScore: source.qualityScore,
    });
  });
  return claims;
}

function toDisplaySource(source: ResearchSource): Source {
  const label: Source["label"] =
    source.sourceType === "official" && sourceCanBePresentedAsVerified(source) ? "Official source"
      : source.sourceType === "community_signal" ? "Community signal"
        : sourceCanBePresentedAsVerified(source) ? "Verified"
          : source.sourceType === "fallback" ? "Fallback analysis"
            : "Needs validation";
  return {
    id: source.id || canonicalUrl(source.url),
    title: source.title,
    url: source.url,
    type: source.sourceType,
    label,
    snippet: source.snippet,
    fetchedAt: new Date().toISOString(),
    provider: source.provider,
    query: source.query,
    verified: source.verified,
    relevanceScore: source.relevanceScore,
    qualityScore: source.qualityScore,
    limitation: source.limitation,
  };
}

async function geminiSummary(profile: FounderProfile, claims: EvidenceClaim[]) {
  if (!claims.length || !getProviderPoolStatus("gemini").available) return undefined;
  return runWithProviderKey("gemini", async (key) => {
    const response = await fetchWithTimeout("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Summarize this startup evidence in at most 140 words. Use only the supplied claims, state uncertainty, and recommend one validation action. Founder: ${JSON.stringify(profile)} Claims: ${JSON.stringify(claims)}`,
          }],
        }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 280 },
      }),
    });
    const data = await responseJson(response);
    if (!response.ok) throw providerErrorFromResponse("gemini", response, responseMessage(data));
    const candidates = Array.isArray(data.candidates) ? data.candidates as Array<Record<string, unknown>> : [];
    const content = candidates[0]?.content as Record<string, unknown> | undefined;
    const parts = Array.isArray(content?.parts) ? content.parts as Array<Record<string, unknown>> : [];
    return parts.map((part) => typeof part.text === "string" ? part.text : "").join("\n").trim() || undefined;
  });
}

export async function runLiveResearch(profile: FounderProfile): Promise<ResearchPack> {
  const fetchedAt = new Date().toISOString();
  const logs: string[] = [];
  const plan = createResearchPlan(profile);
  logs.push(`Created ${plan.length} research questions from the finalized founder context.`);
  const rawResults = await executeSearchPlan(plan, logs);
  const normalized = await normalizeSources(profile, rawResults, logs);
  const sources: ResearchSource[] = normalized.length ? normalized : [{
    id: "source-offline",
    title: "Limited offline analysis",
    url: "",
    snippet: "Live research is unavailable right now, so LaunchPilot used a limited offline analysis. Validate these findings before making decisions.",
    sourceType: "fallback",
    supports: "feasibility",
    limitation: "No external market, competitor, review, or demand evidence was retrieved.",
    confidence: "low",
    provider: "offline",
    verified: false,
    relevanceScore: 0,
    qualityScore: 0.1,
  }];
  const evidenceClaims = buildEvidenceClaims(profile, sources);
  const competitors = sources
    .filter((source) => source.sourceType === "competitor" && source.relevanceScore >= 0.24 && source.qualityScore >= 0.5)
    .map((source) => source.title)
    .filter((title, index, list) => list.indexOf(title) === index)
    .slice(0, 8);
  const marketSignals = evidenceClaims
    .filter((claim) => ["problem", "demand"].includes(claim.category) && claim.sourceIds.length)
    .map((claim) => claim.claim)
    .slice(0, 8);
  const opportunities = evidenceClaims
    .filter((claim) => claim.category === "opportunity")
    .map((claim) => `${claim.claim} Eligibility still requires confirmation.`)
    .slice(0, 5);
  const skillResources = [
    `Prioritize only skills needed to run the next validation experiment within ${profile.hoursPerWeek} hours per week.`,
    profile.skills.some((skill) => /code|react|python|technical|engineering|ai/i.test(skill))
      ? "Use existing technical skills for a narrow prototype after demand validation."
      : "Use a manual or no-code pilot before investing in engineering.",
  ];
  const external = sources.filter((source) => source.sourceType !== "fallback");
  const verifiedCount = external.filter((source) => source.verified).length;
  const mode: ResearchPack["mode"] = external.length === 0 ? "fallback" : verifiedCount === external.length ? "live" : "hybrid";
  logs.push(`Extracted ${evidenceClaims.length} auditable evidence claims; ${verifiedCount} source pages were directly opened.`);
  const aiSummary = await geminiSummary(profile, evidenceClaims).catch(() => undefined);
  if (aiSummary) logs.push("Synthesized the evidence into a concise decision memo.");
  else logs.push("Used the evidence ledger directly without an additional model synthesis.");

  return {
    mode,
    fetchedAt,
    logs,
    plan,
    sources: sources.map(toDisplaySource),
    evidenceClaims,
    competitors,
    marketSignals,
    opportunities,
    skillResources,
    aiSummary,
  };
}

export async function generateResearchedBrief(profile: FounderProfile): Promise<LaunchBrief> {
  const research = await runLiveResearch(profile);
  return generateLaunchBrief(profile, research);
}
