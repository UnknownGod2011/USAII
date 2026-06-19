# Workspace Architecture

After approval, LaunchPilot reads the latest persisted `ResearchRun`; it does not trust client-supplied score or source data. The run contains the researched founder snapshot, query plan, sources, evidence claims, operational logs, research pack, and final Evidence Score.

Approval writes:

- one Launch Brief summary
- fourteen separate workspace records
- six evidence-linked agent runs

The sections are Founder Snapshot, Finalized Idea, Research Verdict, Competitors, Assumptions, Risks, MVP, Current Bottleneck, Founder Reality Check, Roadmap, Opportunities, Pitch Assets, Saved Decisions, and Sources.

The dashboard reconstructs the report from these records and renders evidence bars, a competitor matrix, risk register, MVP scope, roadmap timeline, confidence labels, source footnotes, agent audit, and pitch assets. Copilot retrieves relevant workspace records and research sources for every question. Copy, Markdown, and JSON exports use this same reconstructed workspace.

When a researched idea changes, old workspace records are marked stale before replacements are written. Settings can export or clear all user-scoped context.
