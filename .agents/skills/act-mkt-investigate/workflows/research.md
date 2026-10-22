# Research and draft

Investigate the user's questions and prepare a complete report using the selected template. On feedback, revise the canonical report rather than creating a competing version.

- Start with the customer/product benefit or the direct answer. Explain the feature or idea in enough detail for the audience to understand its flow, decisions, and consequences.
- For an RFC, describe current behavior, proposed flow, goals/non-goals, alternatives and tradeoffs, implementation approach, rollout/rollback, monitoring, and potential risks. Mark unresolved design choices as open questions rather than inventing agreement.
- For an investigation result, explain each question, relevant concepts or current behavior, how the pieces connect, findings and reasoning, examples when useful, limitations, and conclusions. General questions do not require a codebase or technical rollout plan.
- Choose sources that can establish the claim. Search local code with `rg` per [local code access](../generic/local-code-access.md); trace relevant callers/contracts rather than relying on names or isolated snippets. For non-code questions use the supplied references and suitable internal/public sources.
- Verify source/feature identity and source freshness. Cite the revision and file:line, document URL, or executed query/result beside the supported claim. Separate observations from hypotheses and recommendations. Failed retrieval or no telemetry is not proof of absence.
- Explain alternatives one at a time before comparing them. Distinguish changed and reused components, process-local caches from shared stores, and diagrams from actual deployed topology. Preserve user-owned API examples and finalized contracts unless a change was requested.
- Use [traffic evidence](../generic/traffic-evidence.md) only when traffic, capacity, or measured load is relevant to this report. Reuse valid measurements, keep forecasts conditional, and document unavailable evidence. Do not run analytics or add a measurement stage to every investigation.
- Keep diagrams focused on actual flows and tables for comparisons or data. Avoid filler, duplicate outlines, and unsupported precision. A report-level implementation plan is appropriate; an epic/story breakdown belongs to a separate request.

Return the complete draft or a readable full-content reference, sources and limits, and any questions requiring user feedback. Proceed to validation; do not create tracker items or edit product code.
