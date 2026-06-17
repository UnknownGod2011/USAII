# LaunchPilot AI

LaunchPilot AI helps student builders turn vague ideas into validated first steps by combining a warm founder interview, market-reality agents, assumption mapping, skill-gap analysis, opportunity discovery, a founder reality check, and a practical MVP roadmap.

## Hackathon Fit

LaunchPilot is built for the USAII Global AI Hackathon 2026 as a responsible AI execution navigator. It shows the user's problem, visible AI agents, evidence labels, uncertainty, human control, and a first real step instead of generic startup advice.

## What It Does

- Guides a founder through a short voice-or-chat interview.
- Handles "no idea yet" with Problem Discovery Mode instead of random idea spam.
- Builds a persistent Launch Brief Workspace with structured cards.
- Runs visible agents for research, competitors, pain points, opportunities, skill gaps, and source quality.
- Detects the Current Bottleneck and focuses the roadmap on breaking it.
- Provides a Founder Reality Check without fake success scores or funding predictions.
- Offers a context-aware Copilot that challenges weak assumptions.
- Exports the Launch Brief as Markdown or JSON.
- Runs fully without API keys using deterministic fallback analysis.

## Architecture

- Next.js App Router, TypeScript, Tailwind CSS
- Client-side browser persistence for the hackathon demo
- Server API routes for brief generation, copilot answers, and voice status
- Deterministic agent engine in `src/lib/agents.ts`
- Source/RAG registry in `src/lib/rag.ts`
- Guardrails in `src/lib/guardrails.ts`
- API key pool helpers in `src/lib/keyPool.ts`
- Vitest coverage for guardrails, agent output, source retrieval, key rotation, workspace persistence, and voice/text fallbacks

## Agents

- Lead Research Agent: identifies what should be checked first.
- Competitor Subagent: maps alternatives and positioning.
- Pain Point Subagent: separates plausible pain from validated demand.
- Opportunity Subagent: suggests support programs and country-specific opportunities.
- Skill Gap Subagent: identifies learning needs tied to the current bottleneck.
- Source Quality Agent: labels official, inferred, fallback, and framework-based findings.

## Data Sources and RAG

LaunchPilot includes a seed source registry and an `npm run ingest` command that writes `data/source-registry.json`.

Used or prepared sources:

- ESCO for skill mapping
- Global Entrepreneurship Monitor for entrepreneurship climate
- World Bank for macro business-formation signals
- Startup India / DPIIT / MAARG for India-specific opportunities
- Lean Startup and Business Model Canvas principles for validation and MVP structure

If live data cannot be fetched, LaunchPilot uses deterministic fallback data and labels it as fallback or approximate.

## Voice Layer

Gemini Live is the intended premium voice provider when `GEMINI_API_KEY` or `GEMINI_API_KEYS` is configured. The app currently exposes voice readiness and uses graceful fallback behavior:

- Gemini Live: env-key ready, not required for demo
- Web Speech API: browser fallback when available
- Text mode: always available
- Raw audio: not stored by default

See `VOICE_ARCHITECTURE.md`.

## Launch Brief Workspace

The workspace persists:

- Founder Snapshot
- Refined Idea
- Research Notes
- Competitors / Alternatives
- Assumptions
- Risks
- MVP Plan
- Current Bottleneck
- Founder Reality Check
- Roadmap
- Pitch Assets
- Opportunity Cards
- Saved Decisions
- Sources

The dashboard, Copilot, and exports all read from this structured workspace rather than only from chat.

## Responsible AI Design

LaunchPilot shows uncertainty and human-control boundaries. It does not:

- guarantee startup success
- predict funding
- claim YC or investor approval
- recommend dropping out as a final decision
- contact users or investors
- submit applications
- spend money
- claim official eligibility unless verified from official sources

Founder Reality Check uses public startup-quality principles inspired by common YC/Sam Altman-style advice, but LaunchPilot is not affiliated with YC and does not predict success or funding.

## Open-Source and Product Research

No external code was copied into LaunchPilot. These references were inspected and used as product or architecture inspiration only:

- `google-gemini/live-api-web-console` - Apache-2.0. Inspired voice/live API connection and fallback thinking.
- `kzeitar/idea-sieve` - inspected for evidence-first validation and AI disclaimer patterns.
- `Nirikshan95/VettIQ` - MIT. Inspired market, competitor, and risk agent categories.
- `ferdinandobons/startup-skill` - MIT. Inspired competitive-intelligence and validation prompt structure.
- `shinpr/ai-business-planner` - MIT. Inspired structured business-plan and pitch artifacts.
- `Prakhar2025/VentureNode` - MIT. Inspired multi-agent startup pipeline ideas, without Notion/MCP complexity.
- `aicofounder.com` public docs/site - workflow inspiration only, no code, branding, UI, or wording reused.

aicofounder-inspired concepts adapted in an original, student-focused way:

- persistent project workspace
- AI that leads and challenges
- evidence-first brainstorming
- current bottleneck planning
- multi-agent research
- export and privacy controls

LaunchPilot improves for this hackathon by emphasizing student-founder constraints, responsible AI labels, country-specific opportunities, first-real-step execution, and human-in-the-loop boundaries.

## Setup

```bash
npm install
npm run ingest
npm run dev
```

Open `http://localhost:3000`.

## Environment Variables

Optional:

```bash
GEMINI_API_KEY=...
GEMINI_API_KEYS=key1,key2,key3
```

Keys are read from env only. The UI does not store plaintext API keys.

## Test and Build

```bash
npm run lint
npm run build
npm run test
```

## Demo Flow

See `DEMO_SCRIPT.md`.

Fast path:

1. Open landing page.
2. Click `Try Demo User`.
3. Review Current Bottleneck and Founder Reality Check.
4. Ask Copilot: `Should I drop out?`
5. Ask Copilot: `Should I apply to Startup India?`
6. Export Markdown.

## Limitations

- Persistence is browser local storage for MVP speed, not multi-user production auth.
- Live research is represented by a source registry and fallback analysis unless external search/API keys are added.
- Gemini Live is documented and env-ready, but the demo remains reliable through Web Speech/text fallback.
- PDF export is not included; Markdown and JSON export are implemented.

## Future Work

- Add production auth and database-backed workspaces.
- Add live search connectors with source deduping and freshness dates.
- Add real Gemini Live websocket streaming.
- Add PDF export and editable workspace cards.
- Add incubator/program eligibility refresh jobs.

-commit