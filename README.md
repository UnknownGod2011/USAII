# LaunchPilot AI

LaunchPilot AI is an evidence-backed founder workspace for student builders. It turns a rough idea into a validated direction, a persisted Launch Brief, six specialist-agent outputs, a contextual Copilot, and a concrete next action.

## Product flow

1. Sign in with a local signed session.
2. Choose chat or voice interview.
3. Complete the 15-question founder intake. Idea, target user, and problem are captured early.
4. Validate answer quality and persist the founder profile.
5. Run live research through the configured provider chain.
6. Score the evidence, show the verdict, and refine weak or broad ideas.
7. Approve the direction and visibly run six agents.
8. Use the persistent dashboard, Context Copilot, profile, and exports.

Users without an idea enter Problem Discovery Mode instead of receiving a random generated idea.

## Stack

- Next.js 16 App Router, React 19, TypeScript, Tailwind CSS
- Prisma with SQLite for the local submission build
- Zod-validated intake, research, and synthesis structures
- Gemini synthesis and Live voice support
- Gemini Search grounding, Tavily, Exa, SerpAPI, optional Google Custom Search
- Vitest and browser-driven workflow verification

## Setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

`predev` and `prebuild` run `npm run db:setup`, which generates the Prisma client and synchronizes the local schema.

## Environment

Copy `.env.example` to `.env.local`. Never commit real values.

```env
DATABASE_URL="file:./dev.db"
AUTH_SECRET="a-long-random-secret"
NEXTAUTH_URL="http://localhost:3000"

GEMINI_API_KEY=
GEMINI_API_KEYS=
GEMINI_SYNTHESIS_MODEL=gemini-3.5-flash
GEMINI_SEARCH_MODEL=gemini-3.5-flash
GEMINI_LIVE_MODEL=gemini-3.1-flash-live-preview

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

Singular variables work with one key. Plural variables accept comma-separated pools and take priority. Provider keys stay server-side.

## Research and evidence

The research pipeline is:

`intake → targeted queries → live search → source classification → evidence claims → weighted score → verdict → refinement → agents`

Provider priority:

1. Gemini Search grounding
2. Tavily
3. Exa
4. SerpAPI
5. Google Custom Search when fully configured
6. Limited offline analysis

The UI never invents sources, competitors, market size, traction, revenue, funding, or eligibility. Source scoring considers source quality, query relevance, constraint fit, verification strength, and limitations—not answer length.

## Agents and workspace

The persisted workspace contains:

- Founder Snapshot and normalized business language
- Market Reality and competitor/alternative matrix
- Assumption and Risk register
- MVP scope and manual pilot
- 24-hour, 7-day, 30-day, and 60/90-day roadmap
- Opportunity layer with eligibility uncertainty
- Pitch and communication assets
- Source ledger and Responsible AI notes

Agent states are stored as queued, working, and complete records. Dashboard, profile, Copilot, and exports read the same saved Launch Brief.

## Voice

Voice mode uses English browser speech first for stable app-controlled turn-taking. A short-lived Gemini Live token is available as a controlled fallback, followed by typed input. Live audio chunks are queued, the microphone is paused during playback, unexpected CJK-dominated transcript glitches are rejected, and raw audio is not stored.

See `VOICE_ARCHITECTURE.md`.

## Exports

The dashboard supports:

- Copy Launch Brief
- Download Markdown
- Download JSON

Exports use the normalized persisted report, not raw interview text.

## Verification

```bash
npm run lint
npx tsc --noEmit
npm run test
npm run build
```

The judge path and test startup idea are documented in `DEMO_SCRIPT.md`.

## Current limitations

- SQLite is appropriate for the local submission build but must be replaced with a persistent production database before serverless deployment.
- Browser microphone behavior still depends on device permission and browser speech support.
- Search coverage and quotas depend on configured providers; offline fallback is clearly labeled.
- Evidence Score measures current validation strength, not startup success probability.
