# Review and refine

The report is ready for discussion. Follow [report review](../generic/report-review.md) in the active conversation: lead with the answer and key findings, add a useful diagram/table, and show material evidence and limitations beside the complete Markdown report link. Invite corrections or satisfaction, record the reviewed version, and end the turn. Never auto-accept after a timeout or fixed number of rounds.

- **Feedback or new questions:** read the latest canonical report, incorporate the requested changes, research additional evidence where needed, validate, present the revised findings and report link in the same conversation, and end the turn with feedback pending. Keep the same report/destination and agreed decisions. This loop continues until the user is satisfied.
- **Clarification needed:** ask the material question and keep independent in-scope research moving. Resolve a new material scope choice before the affected research/drafting. Do not revive an upfront scope-plan gate unless explicit user/AGENTS instructions require it.
- **Accepted/satisfied:** finish with the accepted report or its path/link and material remaining limitations. Acceptance covers the report only; do not create an epic, stories, or implementation work.
- **Later breakdown request:** use the accepted/current report as input for backlog drafting. Its acceptance does not approve tracker creation; the breakdown has its own explicit creation gate.

Persist the report reference/version, feedback resolved, open limitations, review result and acceptance evidence in `<workspace.root>/.task-context.json`. Finish with the accepted report, absolute task root and context path so a later breakdown reuses this directory.
