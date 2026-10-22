# Validate the report

Read the complete current draft against the user's request, latest feedback, and selected template. This is a focused content check, not a new user approval gate.

- Every material question is answered, or its evidence gap is explicit. Claims and citations agree; observed facts, assumptions, recommendations, and unknowns remain distinct.
- RFCs explain feature flow and goals, implementation, rollout/rollback, monitoring, and risks at a useful level. Investigation results explain the subject in detail without forcing irrelevant engineering sections. Honor the user's own template over default headings.
- Alternatives and recommendations follow the latest scope. No invented ticket mappings, measurements, metrics, API contracts, approvals, or decisions. Proposed monitoring is labeled proposed, not already deployed.
- When measured load is relevant, check [traffic evidence](../generic/traffic-evidence.md): source/emitter, filters, window/timezone, units, executed query/result, and derivations. Keep proxies and modeled demand separate from observations. No telemetry does not mean zero usage.
- Preserve the current user-edited report, unrelated content, and finalized contracts. Do not replace an edited document with a stale mirror.
- No epic/story backlog, tracker creation, product implementation, or unapproved hosted writes have been added to the investigation.

Fix gaps through research, then present the report. Do not claim the user accepted it just because validation passed.
