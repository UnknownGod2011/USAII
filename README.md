# LaunchPilot AI

LaunchPilot turns a founder’s rough idea into an evidence-reviewed direction, a first validation step, and a persistent Launch Brief workspace.

## Product workflow

`session → 15-question intake → answer-quality gate → live source research → evidence ledger → score and verdict → revision/approval → six agents → persisted workspace → contextual Copilot → exports`

The product includes:

- signed HTTP-only local sessions and protected routes
- Prisma/SQLite persistence scoped to the signed-in user
- chat and voice interview interfaces using the same validation state machine
- live voice through a server-created ephemeral token, with browser speech and text fallback
- 9–11 targeted research queries
- Gemini Search Grounding → Tavily → Exa → SerpAPI → optional Google Custom Search → limited offline analysis
- server-only API key pools with plural-first configuration, round-robin rotation, cooldowns, safe retries, and provider-specific error classification
- source classification, page verification, relevance/quality scoring, limitations, and claim-to-source links
- an Evidence Score based on source strength, constraints, and validation quality—not startup-success prediction
- a mandatory revision/approval gate for weak directions
- six evidence-linked agents and fourteen persisted workspace sections
- report-style dashboard, contextual Copilot, and Copy/Markdown/JSON exports

LaunchPilot does not invent sources, competitors, traction, revenue, testimonials, or market size. It does not predict startup success, funding, or accelerator acceptance.

## Setup

```powershell
cd "C:\Users\Admin\OneDrive\Desktop\USAII-HACKATHON SUBMISSION\USAII"
npm install
Copy-Item .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). `predev` and `prebuild` apply Prisma migrations automatically.

```dotenv
DATABASE_URL="file:./dev.db"
AUTH_SECRET="replace-with-a-long-random-secret"
NEXTAUTH_URL="http://localhost:3000"

GEMINI_API_KEY=
GEMINI_API_KEYS=
GEMINI_LIVE_MODEL="gemini-3.1-flash-live-preview"

TAVILY_API_KEY=
TAVILY_API_KEYS=
EXA_API_KEY=
EXA_API_KEYS=
SERPAPI_API_KEY=
SERPAPI_API_KEYS=

GOOGLE_SEARCH_API_KEY=
GOOGLE_SEARCH_API_KEYS=
GOOGLE_SEARCH_ENGINE_ID=
```

Plural variables take priority when non-empty; singular variables are the fallback. Multiple keys are comma-separated. Google Custom Search is optional. Long-lived secrets remain server-only and `.env*` files are ignored.

## Validation

```powershell
npm run lint
npm run test
npm run build
```

Tests cover session signing, all 15 questions, bad-answer rejection, key-pool selection/rotation/cooldowns, evidence caps, source verification, competitor filtering, research-to-agent continuity, workspace records, Copilot retrieval, live-voice configuration, exports, and guardrails.

## Limitations

Public web evidence is not a substitute for customer interviews. Search results can be incomplete, stale, biased, or blocked. Source-code hosts are excluded from competitor discovery, access-wall pages are not treated as verified, and article pages are not promoted to direct competitors. A direction cannot reach the strongest approval threshold without direct validation and externally supported alternative evidence.
