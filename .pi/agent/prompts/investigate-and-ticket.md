---
description: W2 - Investigation + Jira ticket creation (architecture-designer -> documentation-writer)
argument-hint: "<requirements>"
---
Use the subagent tool to run this workflow for: $@

1. `architecture-designer` — produce design options + trade-offs (ADR-style) for: $@
2. `documentation-writer` — write the ADR/finding to Confluence (default space PTA, confirm parent folder first).
3. `documentation-writer` — create/update scoped Jira stories from the design (≤5 story points each, with acceptance criteria).

Run as a chain via the subagent tool, passing {previous} output between steps.
