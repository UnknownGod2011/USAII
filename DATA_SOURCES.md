# Data Sources

LaunchPilot creates 9–11 idea-specific queries covering problem language, demand, community signals, direct products, current alternatives, reviews, pricing, feasibility, location constraints, and relevant official programs.

Provider order:

1. Gemini Search Grounding using the configured Gemini key
2. Tavily
3. Exa
4. SerpAPI
5. Google Custom Search when both a key and search-engine ID exist
6. Limited offline analysis

Each query falls through this order until a provider returns usable results. Provider failures never create synthetic URLs.

Results are canonicalized, deduplicated, opened when possible, and evaluated for relevance, source quality, verification, corroboration, and source-type diversity. GitHub, GitLab, package registries, and source-code project pages are excluded from market competitors. Login walls and verification walls are not treated as opened evidence. Article and guide pages remain contextual sources rather than direct competitors.

Source labels include `official`, `competitor`, `community_signal`, `review`, `market_report`, `blog`, `dataset`, and `fallback`.

No source, competitor, traction, revenue, or market size is fabricated. Every evidence claim stores source IDs, support status, confidence, relevance, quality, and limitations. Community discussion remains directional rather than proof of willingness to pay.

When live retrieval is unavailable, the product states:

> Live research is unavailable right now, so LaunchPilot used a limited offline analysis. Validate these findings before making decisions.
