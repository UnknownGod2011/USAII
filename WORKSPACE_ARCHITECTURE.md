# Workspace Architecture

The Launch Brief is the shared persisted source of truth for dashboard, profile, Copilot, and exports.

## Data path

`FounderIntake → StartupIdea → ResearchRun + ResearchSource → AgentRun → WorkspaceItem`

Prisma stores user-scoped records. API routes re-check the signed session and user ownership before reading or writing.

## Normalized brief

`normalizeFounderBrief()` converts raw founder answers into:

- clean startup title and one-line idea
- refined direction
- target segment and primary user
- problem and value proposition
- alternatives and evidence summary
- founder constraints
- research focus
- first validation step
- clean pitch context

The LLM synthesis layer receives only structured intake, evidence, sources, and deterministic agent outputs. Zod validates the resulting report. A grammatical deterministic report remains available if synthesis fails.

## Agent persistence

Six `AgentRun` records move through queued, working, and complete states:

1. Market Reality
2. Assumption & Risk
3. MVP Scope
4. Roadmap
5. Opportunity
6. Pitch & Communication

Each record stores progress lines, structured output, confidence, and linked sources. After all agents complete, `WorkspaceItem` records are refreshed transactionally and the finalized idea is updated.

## Read paths

- Dashboard loads `/api/workspace` and polls `/api/workspace/build` while agents run.
- Profile loads the latest intake, idea, research verdict, score, and workspace state.
- Copilot receives a project ID, loads the saved brief and sources server-side, then returns a contextual answer with relevant references.
- Markdown, JSON, and copy exports are generated from the same normalized brief rendered on screen.

## Clearing context

The Privacy page signs out or removes the user-scoped local account data through authenticated API routes. Secrets, raw audio, and provider keys are never stored in workspace records.
