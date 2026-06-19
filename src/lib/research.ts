import { generateLaunchBrief } from "./agents";
import type { EvidenceClaim, ResearchSource } from "./intake/schema";
import { getProviderPoolStatus, providerErrorFromResponse, runWithProviderKey } from "./providers/keyPool";
import type { FounderProfile, ResearchPack, Source } from "./types";

type PlanItem = ResearchPack["plan"][number];
type RawResult = { title: string; url: string; snippet: string; provider: NonNullable<Source["provider"]>; query: string; category: PlanItem["category"] };
const timeoutMs = 8_000;

const host = (value: string) => { try { return new URL(value).hostname.replace(/^www\./, ""); } catch { return ""; } };
const words = (value: string) => new Set(value.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 2));
const overlap = (a: string, b: string) => {
  const expected = words(a); const actual = words(b);
  return expected.size ? Math.min(1, [...expected].filter((word) => actual.has(word)).length / Math.min(8, expected.size)) : 0;
};
export const isMarketCompetitorUrl = (url: string) => Boolean(url) && !/(?:github\.com|gitlab\.com|bitbucket\.org|npmjs\.com|pypi\.org|sourceforge\.net)/i.test(url);
export function isLikelyMarketCompetitor(title: string, url: string) {
  const domain = host(url);
  if (!isMarketCompetitorUrl(url)) return false;
  if (/play\.google\.com\/store\/apps|apps\.apple\.com/.test(url)) return true;
  if (/linkedin\.com|instagram\.com|youtube\.com|reddit\.com|researchgate\.net|medium\.com|substack\.com|quora\.com|indiastudychannel\.com|timesofindia\.indiatimes\.com|wikipedia\.org/.test(domain)) return false;
  if (/\b(?:why|how|tips?|reasons?|guide|news|posted|failed?|exams?|preparation|toolkit|best|top|alternatives?|comparison|review|study techniques?|overcome|qualify)\b/i.test(title)) return false;
  if (/\.(?:pdf)(?:$|\?)/i.test(url) || /\/(?:blog|news|article|forum|posts?|reel|watch)\//i.test(url)) return false;
  return /\b(?:app|software|platform|planner|workspace|product|solution|service|suite)\b/i.test(title);
}
export const sourceCanBePresentedAsVerified = (source: ResearchSource) => source.verified && source.relevanceScore >= 0.2 && source.qualityScore >= 0.4 && source.sourceType !== "fallback";

export function createResearchPlan(profile: FounderProfile): PlanItem[] {
  const { rawIdea: idea, targetUser: user, whyItMatters: problem, location } = profile;
  return [
    { id: "problem", query: `"${user}" ${problem} complaints`, category: "problem", purpose: "Find repeated first-hand problem evidence.", preferredSources: ["reviews", "community discussions"] },
    { id: "demand", query: `${user} ${problem} demand software`, category: "demand", purpose: "Find behavior and demand proxies.", preferredSources: ["datasets", "credible reports", "reviews"] },
    { id: "community", query: `${user} "${problem}" discussion`, category: "demand", purpose: "Find current language and workarounds.", preferredSources: ["forums", "reviews"] },
    { id: "competitors", query: `"${user}" ${problem} app software platform`, category: "competitor", purpose: "Find real products serving the same job.", preferredSources: ["company pages", "app stores", "review platforms"] },
    { id: "reviews", query: `${user} ${problem} app reviews alternatives`, category: "competitor", purpose: "Cross-check product claims.", preferredSources: ["review platforms", "app stores"] },
    { id: "alternatives", query: `${user} how to solve ${problem}`, category: "competitor", purpose: "Find manual and service alternatives.", preferredSources: ["guides", "service pages"] },
    { id: "pricing", query: `${idea} pricing alternatives`, category: "pricing", purpose: "Find sourced pricing proxies.", preferredSources: ["official pricing pages"] },
    { id: "feasibility", query: `${idea} MVP technical constraints`, category: "feasibility", purpose: "Check execution constraints.", preferredSources: ["official documentation", "case studies"] },
    { id: "location", query: `${idea} regulation adoption ${location}`, category: "feasibility", purpose: "Find location-specific constraints.", preferredSources: ["official sources", "associations"] },
    { id: "opportunities", query: `${location} startup incubator mentorship program official`, category: "opportunity", purpose: "Find support without assuming eligibility.", preferredSources: ["official program pages"] },
  ];
}

async function fetchTimed(url: string, init?: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" }); }
  finally { clearTimeout(timer); }
}
async function json(response: Response) { return response.json().catch(() => ({})) as Promise<Record<string, unknown>>; }
function results(value: unknown) { return Array.isArray(value) ? value as Array<Record<string, unknown>> : []; }

async function gemini(item: PlanItem): Promise<RawResult[]> {
  return runWithProviderKey("gemini", async (key) => {
    const model = process.env.GEMINI_SEARCH_MODEL || "gemini-3.5-flash";
    const response = await fetchTimed(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({ contents: [{ parts: [{ text: `Research using current Google Search results: ${item.query}. Prefer primary and official sources. Do not invent URLs.` }] }], tools: [{ googleSearch: {} }], generationConfig: { temperature: 0.1, maxOutputTokens: 600 } }),
    });
    const data = await json(response); if (!response.ok) throw providerErrorFromResponse("gemini", response);
    const candidate = results(data.candidates)[0];
    const metadata = candidate?.groundingMetadata as Record<string, unknown> | undefined;
    return results(metadata?.groundingChunks).flatMap((chunk) => {
      const web = chunk.web as Record<string, unknown> | undefined;
      const url = typeof web?.uri === "string" ? web.uri : "";
      return url ? [{ title: typeof web?.title === "string" ? web.title : host(url), url, snippet: "", provider: "gemini_grounding" as const, query: item.query, category: item.category }] : [];
    });
  });
}
async function tavily(item: PlanItem): Promise<RawResult[]> {
  return runWithProviderKey("tavily", async (key) => {
    const response = await fetchTimed("https://api.tavily.com/search", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, body: JSON.stringify({ query: item.query, search_depth: item.category === "competitor" ? "advanced" : "basic", max_results: 5, include_answer: false, include_raw_content: false }) });
    const data = await json(response); if (!response.ok) throw providerErrorFromResponse("tavily", response);
    return results(data.results).map((entry) => ({ title: String(entry.title || host(String(entry.url || ""))), url: String(entry.url || ""), snippet: String(entry.content || ""), provider: "tavily" as const, query: item.query, category: item.category }));
  });
}
async function exa(item: PlanItem): Promise<RawResult[]> {
  return runWithProviderKey("exa", async (key) => {
    const response = await fetchTimed("https://api.exa.ai/search", { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": key }, body: JSON.stringify({ query: item.query, type: "auto", ...(item.category === "competitor" ? { category: "company" } : {}), numResults: 5, contents: { text: { maxCharacters: 900 } } }) });
    const data = await json(response); if (!response.ok) throw providerErrorFromResponse("exa", response);
    return results(data.results).map((entry) => ({ title: String(entry.title || host(String(entry.url || ""))), url: String(entry.url || ""), snippet: String(entry.text || ""), provider: "exa" as const, query: item.query, category: item.category }));
  });
}
async function serpapi(item: PlanItem): Promise<RawResult[]> {
  return runWithProviderKey("serpapi", async (key) => {
    const url = new URL("https://serpapi.com/search"); url.searchParams.set("engine", "google"); url.searchParams.set("q", item.query); url.searchParams.set("api_key", key); url.searchParams.set("num", "5");
    const response = await fetchTimed(url.toString()); const data = await json(response);
    if (!response.ok || typeof data.error === "string") throw providerErrorFromResponse("serpapi", response);
    return results(data.organic_results).map((entry) => ({ title: String(entry.title || host(String(entry.link || ""))), url: String(entry.link || ""), snippet: String(entry.snippet || ""), provider: "serpapi" as const, query: item.query, category: item.category }));
  });
}
async function google(item: PlanItem): Promise<RawResult[]> {
  if (!process.env.GOOGLE_SEARCH_ENGINE_ID) return [];
  return runWithProviderKey("google", async (key) => {
    const url = new URL("https://www.googleapis.com/customsearch/v1"); url.searchParams.set("key", key); url.searchParams.set("cx", process.env.GOOGLE_SEARCH_ENGINE_ID!); url.searchParams.set("q", item.query); url.searchParams.set("num", "5");
    const response = await fetchTimed(url.toString()); const data = await json(response); if (!response.ok) throw providerErrorFromResponse("google", response);
    return results(data.items).map((entry) => ({ title: String(entry.title || host(String(entry.link || ""))), url: String(entry.link || ""), snippet: String(entry.snippet || ""), provider: "google" as const, query: item.query, category: item.category }));
  });
}
export function configuredResearchProviderNames(env: NodeJS.ProcessEnv = process.env) {
  return (["gemini", "tavily", "exa", "serpapi", "google"] as const).filter((provider) => getProviderPoolStatus(provider, env).available && (provider !== "google" || Boolean(env.GOOGLE_SEARCH_ENGINE_ID)));
}
function classify(result: RawResult): ResearchSource["sourceType"] {
  const domain = host(result.url);
  const text = `${domain} ${result.title}`.toLowerCase();
  if (/\.gov\.|worldbank|oecd|europa\.eu|startupindia/.test(text)) return "official";
  if (/g2\.com|capterra|trustpilot|play\.google|apps\.apple/.test(text)) return "review";
  if (/reddit|ycombinator|indiehackers/.test(text)) return "community_signal";
  if (/dataset|kaggle|data\./.test(text)) return "dataset";
  if (/gartner|forrester|marketresearch|grandview/.test(text)) return "market_report";
  if ((result.category === "competitor" || result.category === "pricing") && isLikelyMarketCompetitor(result.title, result.url)) return "competitor";
  return "blog";
}
const quality = (type: ResearchSource["sourceType"], verified: boolean) => Math.max(0.1, ({ official: .95, competitor: .82, review: .8, dataset: .86, market_report: .68, community_signal: .58, blog: .42, fallback: .1 }[type]) - (verified ? 0 : .18));
async function normalize(raw: RawResult, profile: FounderProfile, index: number): Promise<ResearchSource> {
  let verified = false;
  try { verified = (await fetchTimed(raw.url, { method: "HEAD" })).ok; } catch { /* search result remains unverified */ }
  const sourceType = classify(raw);
  const relevanceScore = Math.min(1, overlap(`${profile.rawIdea} ${profile.targetUser} ${profile.whyItMatters}`, `${raw.title} ${raw.snippet}`) + (raw.category === "competitor" ? .1 : 0));
  return { id: `source-${index + 1}`, title: raw.title.slice(0, 180), url: raw.url, snippet: raw.snippet.slice(0, 900), sourceType, supports: raw.category, limitation: verified ? (sourceType === "competitor" ? "Vendor claims require independent customer validation." : "Public evidence may not represent the exact target segment.") : "The result was discovered through search but could not be independently opened in this run.", confidence: relevanceScore >= .55 && quality(sourceType, verified) >= .7 ? "high" : relevanceScore >= .25 ? "medium" : "low", provider: raw.provider, query: raw.query, verified, relevanceScore, qualityScore: quality(sourceType, verified) };
}
function claimFor(source: ResearchSource): EvidenceClaim {
  const category = source.supports === "pricing" ? "pricing" : source.supports === "competitor" ? "competitor" : source.supports === "demand" ? "demand" : source.supports === "problem" ? "problem" : source.supports === "opportunity" ? "opportunity" : "feasibility";
  const evidenceType: EvidenceClaim["evidenceType"] = source.sourceType === "official" ? "official" : source.sourceType === "competitor" ? "competitor_primary" : source.sourceType === "review" ? "review" : source.sourceType === "community_signal" ? "community_signal" : source.sourceType === "dataset" ? "dataset" : source.sourceType === "market_report" ? "market_report" : "inference";
  return { id: `claim-${source.id}`, claim: `${source.title} provides ${source.supports} context for this direction.`, category, evidenceType, sourceIds: source.id ? [source.id] : [], support: source.relevanceScore >= .22 ? "supports" : "context_only", confidence: source.confidence, limitation: source.limitation, relevanceScore: source.relevanceScore, qualityScore: source.qualityScore };
}
export async function runLiveResearch(profile: FounderProfile): Promise<ResearchPack> {
  const plan = createResearchPlan(profile);
  const logs = ["Created a targeted evidence plan.", "Researching live sources.", "Reviewing search results."];
  const providers = { gemini, tavily, exa, serpapi, google };
  const active = configuredResearchProviderNames();
  const raw: RawResult[] = [];
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(3, plan.length) }, async () => {
    while (cursor < plan.length) {
      const item = plan[cursor++];
      for (const provider of active) {
        try {
          const found = (await providers[provider](item)).filter((entry) => entry.url && entry.title);
          if (found.length) {
            raw.push(...found);
            const needsProduct = item.category === "competitor" || item.category === "pricing";
            if (!needsProduct || found.some((entry) => isLikelyMarketCompetitor(entry.title, entry.url))) break;
          }
        } catch { /* ordered fallback */ }
      }
    }
  }));
  const deduped = [...new Map(raw.map((entry) => [entry.url.split("#")[0], entry])).values()].slice(0, 40);
  const normalized = await Promise.all(deduped.map((entry, index) => normalize(entry, profile, index)));
  const sources = normalized.filter((source) => source.relevanceScore >= .08 && (source.sourceType !== "competitor" || isMarketCompetitorUrl(source.url))).slice(0, 16);
  if (!sources.length) {
    const fallback: Source = { id: "offline-analysis", title: "Limited offline analysis", url: "", type: "fallback", label: "Fallback analysis", snippet: "Live research is unavailable right now, so LaunchPilot used a limited offline analysis. Validate these findings before making decisions.", provider: "offline", verified: false, relevanceScore: 0, qualityScore: .1, limitation: "No external market source was retrieved." };
    return { mode: "fallback", fetchedAt: new Date().toISOString(), logs: [...logs, "Live research unavailable. Limited offline analysis prepared."], plan, sources: [fallback], evidenceClaims: [], competitors: [], marketSignals: ["No live demand signal was retained."], opportunities: [], skillResources: [] };
  }
  logs.push(`Retained ${sources.length} relevant sources.`, "Checking competitor pages.", "Evaluating evidence.");
  const display: Source[] = sources.map((source) => ({ id: source.id!, title: source.title, url: source.url, type: source.sourceType, label: source.verified && source.qualityScore >= .4 ? "Verified" : "Needs validation", snippet: source.snippet, provider: source.provider, query: source.query, verified: source.verified, relevanceScore: source.relevanceScore, qualityScore: source.qualityScore, limitation: source.limitation }));
  const claims = sources.map(claimFor);
  return {
    mode: sources.some((source) => source.verified) ? "live" : "hybrid", fetchedAt: new Date().toISOString(), logs, plan, sources: display, evidenceClaims: claims,
    competitors: sources.filter((source) => source.sourceType === "competitor" && source.relevanceScore >= .2).map((source) => source.title).slice(0, 8),
    marketSignals: claims.filter((claim) => claim.category === "demand" || claim.category === "problem").map((claim) => claim.claim).slice(0, 6),
    opportunities: sources.filter((source) => source.sourceType === "official" && source.supports === "opportunity").map((source) => `${source.title} — verify current eligibility on the official page.`).slice(0, 5),
    skillResources: [],
  };
}
export async function generateResearchedBrief(profile: FounderProfile) {
  const research = await runLiveResearch(profile);
  return generateLaunchBrief(profile, research);
}
