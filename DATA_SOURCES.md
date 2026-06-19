# Data Sources

## Provider chain

LaunchPilot searches in this order:

1. Gemini Search grounding
2. Tavily
3. Exa
4. SerpAPI
5. Google Custom Search when both a key and engine ID exist
6. Limited offline analysis

One configured key works. Comma-separated plural variables enable round-robin pools, cooldowns, safe retries, and fallback to the next provider.

## Stored source fields

Each retained source includes:

- title and URL
- query and snippet
- source classification
- what it supports
- limitation
- confidence
- verification state
- relevance and quality scores

Classifications include competitor, alternative, official, community signal, review, market report, blog article, dataset, and fallback offline analysis.

## Evidence rules

- A source page or GitHub repository is not automatically a competitor.
- Direct competitors require product and user-overlap evidence.
- Adjacent tools, services, and manual workarounds stay labeled as alternatives.
- Blogs can support workflow context but do not prove market demand by themselves.
- Market size, traction, revenue, funding, testimonials, and eligibility are never invented.
- The Evidence Score is capped when direct user, pilot, usage, or payment evidence is missing.

If all live providers fail, the product states:

> Live research is unavailable right now, so LaunchPilot used a limited offline analysis. Validate these findings before making decisions.

Provider names remain in developer documentation and diagnostics, not normal product UI.
