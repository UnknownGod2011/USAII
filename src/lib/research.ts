import fs from "node:fs";
import path from "node:path";
import { generateLaunchBrief } from "./agents";
import { selectGeminiKey } from "./keyPool";
import { sourceRegistry } from "./rag";
import type { FounderProfile, LaunchBrief, ResearchPack, Source } from "./types";

const fetchTimeoutMs = 6500;

function isIndia(profile: FounderProfile) {
  return /india|bengaluru|delhi|mumbai|pune|hyderabad|chennai/i.test(profile.location);
}

async function fetchJson(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), fetchTimeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "LaunchPilotAI/1.0 founder-research" },
      next: { revalidate: 60 * 60 },
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchTextSnippet(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), fetchTimeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "LaunchPilotAI/1.0 founder-research" },
      next: { revalidate: 60 * 60 },
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const text = (await response.text()).replace(/\s+/g, " ");
    const title = text.match(/<title[^>]*>(.*?)<\/title>/i)?.[1]?.trim();
    return title || text.slice(0, 180);
  } finally {
    clearTimeout(timeout);
  }
}

function downloadedSeed() {
  try {
    const file = path.join(process.cwd(), "data", "live-research-seed.json");
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

async function geminiSummary(profile: FounderProfile, pack: ResearchPack) {
  const key = selectGeminiKey(0);
  if (!key) return undefined;

  const prompt = `Create a concise startup research synthesis for this founder. Return practical, non-hype advice.
Founder: ${JSON.stringify(profile)}
Research signals: ${JSON.stringify({
    competitors: pack.competitors,
    marketSignals: pack.marketSignals,
    opportunities: pack.opportunities,
    skillResources: pack.skillResources,
    sources: pack.sources.map((source) => ({ title: source.title, url: source.url, label: source.label })),
  })}`;

  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": key,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.35, maxOutputTokens: 700 },
    }),
  });
  if (!response.ok) return undefined;
  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("\n").trim() || undefined;
}

function clampScore(value: unknown, fallback: number) {
  const number = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(number)) return fallback;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function textFromGemini(data: unknown) {
  const candidate = (data as { candidates?: { content?: { parts?: { text?: string }[] } }[] })?.candidates?.[0];
  return candidate?.content?.parts?.map((part) => part.text || "").join("\n").trim() || "";
}

function parseJsonObject(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Gemini did not return JSON.");
    return JSON.parse(match[0]);
  }
}

function groundedSources(data: unknown, fetchedAt: string): Source[] {
  const chunks =
    (data as {
      candidates?: {
        groundingMetadata?: {
          groundingChunks?: { web?: { title?: string; uri?: string } }[];
        };
      }[];
    })?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

  return chunks
    .map((chunk, index) => {
      const title = chunk.web?.title?.trim();
      const url = chunk.web?.uri?.trim();
      if (!title || !url) return null;
      const official = /\.(gov|edu)(\/|$)/i.test(url) || /official|world bank|government|oecd|census|data/i.test(title);
      return {
        id: `gemini-grounded-${index}-${url.slice(0, 40)}`,
        title,
        url,
        type: official ? "grounded official/current web source" : "grounded current web source",
        label: official ? "Official source" : "Verified",
        snippet: "Returned by Gemini Google Search grounding",
        fetchedAt,
      } satisfies Source;
    })
    .filter(Boolean) as Source[];
}

async function groundedGeminiResearch(profile: FounderProfile, fetchedAt: string): Promise<{
  marketSignals: string[];
  competitors: string[];
  opportunities: string[];
  skillResources: string[];
  summary?: string;
  score: NonNullable<ResearchPack["score"]>;
  sources: Source[];
}> {
  const key = selectGeminiKey(1);
  if (!key) throw new Error("Gemini key not configured for grounded research.");

  const model = process.env.GEMINI_RESEARCH_MODEL || "gemini-2.5-flash";
  const prompt = `Research this startup idea using current web data and return evidence-tied JSON.

Founder profile:
${JSON.stringify(profile, null, 2)}

Evaluate:
- market demand signals
- competitive saturation and alternatives
- feasibility given founder skills, weekly time, budget, and stage
- founder fit
- source quality

Return JSON only:
{
  "marketSignals": ["specific current signal with source context"],
  "competitors": ["competitor or substitute"],
  "opportunities": ["program, wedge, or market opening"],
  "skillResources": ["skill or learning resource"],
  "summary": "science-honest synthesis",
  "score": {
    "marketDemand": 0,
    "competitiveSaturation": 0,
    "feasibility": 0,
    "founderFit": 0,
    "sourceQuality": 0,
    "overall": 0,
    "rating": "Strong | Promising | Needs sharper validation | Weak",
    "reasoning": ["short evidence-tied reason"],
    "suggestedPivot": "more promising direction if needed"
  }
}`;

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": key,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      tools: [{ google_search: {} }],
      generationConfig: {
        temperature: model.startsWith("gemini-3") ? 1 : 0.35,
        maxOutputTokens: 1600,
      },
    }),
  });

  if (!response.ok) throw new Error(`Gemini grounded research failed: ${response.status} ${response.statusText}`);
  const data = await response.json();
  const parsed = parseJsonObject(textFromGemini(data));
  const rawScore = parsed.score || {};
  const score: NonNullable<ResearchPack["score"]> = {
    marketDemand: clampScore(rawScore.marketDemand, 50),
    competitiveSaturation: clampScore(rawScore.competitiveSaturation, 50),
    feasibility: clampScore(rawScore.feasibility, 50),
    founderFit: clampScore(rawScore.founderFit, 50),
    sourceQuality: clampScore(rawScore.sourceQuality, 60),
    overall: clampScore(rawScore.overall, 50),
    rating: ["Strong", "Promising", "Needs sharper validation", "Weak"].includes(rawScore.rating)
      ? rawScore.rating
      : "Needs sharper validation",
    reasoning: Array.isArray(rawScore.reasoning) ? rawScore.reasoning.map(String).slice(0, 5) : [],
    suggestedPivot: rawScore.suggestedPivot ? String(rawScore.suggestedPivot) : undefined,
  };

  return {
    marketSignals: Array.isArray(parsed.marketSignals) ? parsed.marketSignals.map(String).slice(0, 8) : [],
    competitors: Array.isArray(parsed.competitors) ? parsed.competitors.map(String).slice(0, 8) : [],
    opportunities: Array.isArray(parsed.opportunities) ? parsed.opportunities.map(String).slice(0, 6) : [],
    skillResources: Array.isArray(parsed.skillResources) ? parsed.skillResources.map(String).slice(0, 6) : [],
    summary: parsed.summary ? String(parsed.summary) : undefined,
    score,
    sources: groundedSources(data, fetchedAt),
  };
}

export async function runLiveResearch(profile: FounderProfile): Promise<ResearchPack> {
  const fetchedAt = new Date().toISOString();
  const logs: string[] = [];
  const sources: Source[] = [];
  const seed = downloadedSeed();
  const competitors = new Set<string>();
  const marketSignals = new Set<string>();
  const opportunities = new Set<string>();
  const skillResources = new Set<string>();
  const focusedQuery = encodeURIComponent(`${profile.rawIdea} ${profile.targetUser} startup validation`);
  const broadQuery = encodeURIComponent("startup validation founder customer discovery MVP");

  logs.push("Queued Market Agent, Competitor Agent, Opportunity Agent, Skill Agent, and Source Quality Agent.");

  const grounded = await groundedGeminiResearch(profile, fetchedAt)
    .then((result) => {
      logs.push("Ran Gemini Google Search grounding for current market and competitor evidence.");
      return result;
    })
    .catch((error) => {
      logs.push(`Gemini grounding unavailable; continuing with public APIs and registry fallback. ${error instanceof Error ? error.message : ""}`.trim());
      return null;
    });

  grounded?.sources.forEach((source) => {
    if (!sources.some((item) => item.url === source.url)) sources.push(source);
  });
  grounded?.competitors.forEach((item) => competitors.add(item));
  grounded?.marketSignals.forEach((item) => marketSignals.add(item));
  grounded?.opportunities.forEach((item) => opportunities.add(item));
  grounded?.skillResources.forEach((item) => skillResources.add(item));

  const tasks = await Promise.allSettled([
    fetchJson(`https://hn.algolia.com/api/v1/search?query=${focusedQuery}&tags=story&hitsPerPage=5`),
    fetchJson(`https://hn.algolia.com/api/v1/search?query=${broadQuery}&tags=story&hitsPerPage=5`),
    fetchJson(`https://api.github.com/search/repositories?q=${focusedQuery}&sort=stars&order=desc&per_page=5`),
    fetchJson(`https://api.github.com/search/repositories?q=${broadQuery}&sort=stars&order=desc&per_page=5`),
    fetchJson(`https://api.worldbank.org/v2/country/${isIndia(profile) ? "IND" : "WLD"}/indicator/IC.BUS.NREG?format=json&per_page=5`),
    fetchTextSnippet("https://esco.ec.europa.eu/"),
    fetchTextSnippet("https://www.startupindia.gov.in/"),
  ]);

  logs.push("Fetched founder pain and competitor signals from public web APIs.");

  const [hnFocused, hnBroad, githubFocused, githubBroad, worldBank, esco, startupIndia] = tasks;
  const hnHits = [
    ...(hnFocused.status === "fulfilled" ? hnFocused.value?.hits || [] : []),
    ...(hnBroad.status === "fulfilled" ? hnBroad.value?.hits || [] : []),
  ].slice(0, 5);
  let usedSeedHn = false;
  if (!hnHits.length && Array.isArray(seed?.hackerNewsFounderValidationSignals)) {
    seed.hackerNewsFounderValidationSignals.forEach((hit: { title?: string; url?: string; points?: number; error?: string }) => {
      if (hit.title && !hit.error) {
        usedSeedHn = true;
        marketSignals.add(`Downloaded community signal: ${hit.title}`);
        sources.push({
          id: `seed-hn-${hit.title}`,
          title: hit.title,
          url: hit.url || "https://hn.algolia.com/",
          type: "downloaded community discussion",
          label: "Community signal",
          snippet: typeof hit.points === "number" ? `${hit.points} public discussion points` : "Downloaded by npm run ingest",
          fetchedAt,
        });
      }
    });
    logs.push("Used downloaded Hacker News seed data from data/live-research-seed.json.");
  }

  if (hnHits.length) {
    const hits = hnHits;
    hits.forEach((hit: { title?: string; url?: string; objectID?: string }) => {
      if (hit.title) {
        marketSignals.add(`Community signal: ${hit.title}`);
        sources.push({
          id: `hn-${hit.objectID || hit.title}`,
          title: hit.title,
          url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
          type: "community discussion",
          label: "Community signal",
          snippet: "Hacker News/Algolia public discussion result",
          fetchedAt,
        });
      }
    });
    logs.push(`Scanned ${hits.length} community discussion signals from Hacker News Algolia.`);
  } else if (!usedSeedHn) {
    logs.push("Hacker News Algolia fetch failed, keeping fallback pain-signal analysis.");
  }

  const githubRepos = [
    ...(githubFocused.status === "fulfilled" ? githubFocused.value?.items || [] : []),
    ...(githubBroad.status === "fulfilled" ? githubBroad.value?.items || [] : []),
  ].slice(0, 5);
  let usedSeedGithub = false;
  if (!githubRepos.length && Array.isArray(seed?.githubStartupValidationRepos)) {
    seed.githubStartupValidationRepos.forEach((repo: { fullName?: string; url?: string; description?: string; stars?: number; error?: string }) => {
      if (repo.fullName && !repo.error) {
        usedSeedGithub = true;
        competitors.add(repo.fullName);
        sources.push({
          id: `seed-github-${repo.fullName}`,
          title: repo.fullName,
          url: repo.url || "https://github.com",
          type: "downloaded open-source alternative",
          label: "Inferred",
          snippet: repo.description || `${repo.stars || 0} stars`,
          fetchedAt,
        });
      }
    });
    logs.push("Used downloaded GitHub repository seed data from data/live-research-seed.json.");
  }

  if (githubRepos.length) {
    const repos = githubRepos;
    repos.forEach((repo: { full_name?: string; html_url?: string; description?: string }) => {
      if (repo.full_name) {
        competitors.add(repo.full_name);
        sources.push({
          id: `github-${repo.full_name}`,
          title: repo.full_name,
          url: repo.html_url || "https://github.com",
          type: "open-source alternative",
          label: "Inferred",
          snippet: repo.description || "GitHub repository search result",
          fetchedAt,
        });
      }
    });
    logs.push(`Compared ${repos.length} public GitHub alternatives or adjacent tools.`);
  } else if (!usedSeedGithub) {
    logs.push("GitHub repository search failed, keeping manual competitor baseline.");
  }

  if (worldBank.status === "fulfilled") {
    const values = Array.isArray(worldBank.value?.[1]) ? worldBank.value[1] : [];
    const newest = values.find((row: { value?: number }) => typeof row.value === "number");
    if (newest) {
      marketSignals.add(`World Bank new-business-registration signal: ${newest.value} in ${newest.date}.`);
    }
    sources.push({
      id: "world-bank-live",
      title: "World Bank new business density / registrations API",
      url: "https://api.worldbank.org/v2/",
      type: "macro entrepreneurship data",
      label: "Approximate",
      snippet: newest ? `Latest available value ${newest.value} (${newest.date})` : "Fetched, but no numeric value returned.",
      fetchedAt,
    });
    logs.push("Fetched World Bank entrepreneurship macro indicator for market context.");
  } else {
    const newest = Array.isArray(seed?.worldBankIndiaNewBusinesses) ? seed.worldBankIndiaNewBusinesses[0] : null;
    if (newest?.value) {
      marketSignals.add(`Downloaded World Bank new-business-registration signal: ${newest.value} in ${newest.date}.`);
      sources.push({
        id: "seed-world-bank",
        title: "World Bank new businesses registered snapshot",
        url: "https://api.worldbank.org/v2/",
        type: "downloaded macro entrepreneurship data",
        label: "Approximate",
        snippet: `Downloaded value ${newest.value} (${newest.date})`,
        fetchedAt,
      });
      logs.push("Used downloaded World Bank snapshot from data/live-research-seed.json.");
    }
    logs.push("World Bank fetch failed, keeping source registry fallback.");
  }

  if (esco.status === "fulfilled") {
    skillResources.add("Map missing skills against ESCO categories: user research, prototyping, analytics, and communication.");
    sources.push({ id: "esco-live", title: "ESCO skills taxonomy", url: "https://esco.ec.europa.eu/", type: "official skills framework", label: "Official source", snippet: esco.value, fetchedAt });
    logs.push("Checked ESCO as the official skill taxonomy reference.");
  }

  if (startupIndia.status === "fulfilled" || isIndia(profile)) {
    opportunities.add("Check Startup India, DPIIT recognition, and MAARG mentorship only after eligibility is verified on the official site.");
    sources.push({ id: "startup-india-live", title: "Startup India / DPIIT / MAARG", url: "https://www.startupindia.gov.in/", type: "official India opportunity", label: "Official source", snippet: startupIndia.status === "fulfilled" ? startupIndia.value : "India founder fallback opportunity", fetchedAt });
    logs.push("Checked Startup India/DPIIT/MAARG as country-specific opportunity references.");
  }

  sourceRegistry.forEach((source) => {
    if (!sources.some((item) => item.id === source.id || item.url === source.url)) {
      sources.push({ ...source, fetchedAt, snippet: "Seed RAG source registry fallback" });
    }
  });

  const pack: ResearchPack = {
    mode: sources.some((source) => source.fetchedAt === fetchedAt && !source.snippet?.includes("fallback")) ? "hybrid" : "fallback",
    fetchedAt,
    logs,
    sources,
    competitors: competitors.size ? Array.from(competitors) : ["Manual mentoring", "Generic AI chatbots", "Startup templates"],
    marketSignals: marketSignals.size ? Array.from(marketSignals) : ["No fresh market signal fetched; use problem interviews as primary evidence."],
    opportunities: opportunities.size ? Array.from(opportunities) : ["Use university incubators, founder office hours, and hackathon communities before fundraising."],
    skillResources: skillResources.size ? Array.from(skillResources) : ["USAII learning path: customer discovery, MVP design, AI prototyping, and founder communication."],
    aiSummary: grounded?.summary,
    score: grounded?.score,
  };

  const aiSummary = pack.aiSummary || (await geminiSummary(profile, pack).catch(() => undefined));
  return {
    ...pack,
    mode: grounded ? "live" : aiSummary ? "hybrid" : pack.mode,
    aiSummary,
    logs: aiSummary ? [...pack.logs, "Generated synthesis with Gemini using retrieved sources."] : [...pack.logs, "Gemini synthesis unavailable; used retrieved data plus registry reasoning."],
  };
}

export async function generateResearchedBrief(profile: FounderProfile): Promise<LaunchBrief> {
  const research = await runLiveResearch(profile);
  return generateLaunchBrief(profile, research);
}
