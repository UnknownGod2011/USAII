import fs from "node:fs";
import path from "node:path";

const registry = {
  updatedAt: new Date().toISOString(),
  note: "LaunchPilot ships with a deterministic seed registry. Live data connectors can refresh these records when API access is configured.",
  sources: [
    { id: "esco", name: "ESCO skills taxonomy", type: "framework", label: "Official source", url: "https://esco.ec.europa.eu/" },
    { id: "gem", name: "Global Entrepreneurship Monitor", type: "research", label: "Verified", url: "https://www.gemconsortium.org/" },
    { id: "world-bank", name: "World Bank entrepreneurship data", type: "macro", label: "Approximate", url: "https://data.worldbank.org/" },
    { id: "startup-india", name: "Startup India / DPIIT / MAARG", type: "opportunity", label: "Official source", url: "https://www.startupindia.gov.in/" },
    { id: "lean-startup", name: "Lean Startup validation principles", type: "framework", label: "Framework-based" }
  ]
};

const outDir = path.join(process.cwd(), "data");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "source-registry.json"), JSON.stringify(registry, null, 2));

async function safeJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "LaunchPilotAI/1.0 data-ingest" },
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function cleanText(value) {
  return String(value || "")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const downloaded = {
  updatedAt: new Date().toISOString(),
  note: "Live public data snapshot used by LaunchPilot's RAG/research layer when available.",
  worldBankIndiaNewBusinesses: null,
  hackerNewsFounderValidationSignals: [],
  githubStartupValidationRepos: [],
};

try {
  const wb = await safeJson("https://api.worldbank.org/v2/country/IND/indicator/IC.BUS.NREG?format=json&per_page=5");
  downloaded.worldBankIndiaNewBusinesses = wb?.[1]?.filter((row) => row.value !== null).slice(0, 5) || [];
} catch (error) {
  downloaded.worldBankIndiaNewBusinesses = { error: error.message };
}

try {
  const hn = await safeJson("https://hn.algolia.com/api/v1/search?query=startup%20validation%20founder%20customer%20discovery&tags=story&hitsPerPage=5");
  downloaded.hackerNewsFounderValidationSignals = (hn?.hits || []).map((hit) => ({
    title: cleanText(hit.title),
    url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
    points: hit.points,
  }));
} catch (error) {
  downloaded.hackerNewsFounderValidationSignals = [{ error: error.message }];
}

try {
  const gh = await safeJson("https://api.github.com/search/repositories?q=startup%20validation%20MVP&sort=stars&order=desc&per_page=5");
  downloaded.githubStartupValidationRepos = (gh?.items || []).map((repo) => ({
    fullName: cleanText(repo.full_name),
    url: repo.html_url,
    stars: repo.stargazers_count,
    description: cleanText(repo.description),
  }));
} catch (error) {
  downloaded.githubStartupValidationRepos = [{ error: error.message }];
}

fs.writeFileSync(path.join(outDir, "live-research-seed.json"), JSON.stringify(downloaded, null, 2));
console.log("Wrote data/source-registry.json");
console.log("Wrote data/live-research-seed.json");
