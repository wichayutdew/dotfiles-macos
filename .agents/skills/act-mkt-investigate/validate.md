# Stage: validate

Use the invoking request and complete source evidence, inline or through the evidence references defined in SKILL.md.

---

Check the draft against the approved goal. Read-only. Do not write or publish to any destination.

Input: `the invoking request`
Approved scope: `the approved plan artifact from this run`
Draft and traffic proof: `{{last.summary}}` from the traffic-evidence stage, including its complete reconciled draft and applicability result.

Re-check citations. Reject filler, missing required content, or claims that miss the goal.

- Scope: proposed changes, tests, metrics, rollout, and stories follow the latest explicit user correction. Risks/diagnoses have not become unauthorized redesigns or stronger guarantees. RFC goals/non-goals concern the product proposal, not agent permissions.
- Destination: the draft addresses the approved local/hosted/chat targets in dependency order, with authorized fields and readback checks. Compare the current saved version/content to the validation baseline. Concurrent edits require reconciliation, not replacement; use gaps for same-scope evidence issues and refresh when scope/authority assumptions are invalidated. No extra report path is required for hosted/chat output.
- Canonical artifact: compare against the latest user-edited canonical file or hosted description, not a stale mirror. Verify user-owned request/response JSON and finalized contracts are unchanged byte-for-byte unless their modification was explicitly authorized.
- Report shape: product benefit first; approved template/reference respected; alternatives explained one by one with change/unchanged boundaries and real-component diagrams. Evidence appears beside claims; tables are reserved for useful comparisons/data, not prose dumping or duplicated handoff outlines.
- Source identity: verify ticket/feature mapping and analytics definitions plus emitters. Distinguish DOM names, similar elements, actions, platform variants, and rollout gates; flag unresolved mismatches instead of guessing.
- Measurement: check windows/timezones, units, environments, denominators, filters, coverage, and query status. Compute combined peaks from aligned buckets, not independent maxima. Do not label a timer success as response-body success, a proxy/exposure as API traffic, or no data as zero demand.
- Traffic proof: check the declared stage's applicability result and proof records in [traffic-evidence.md](traffic-evidence.md). When applicable, each measured claim has an executed Grafana MCP/Query Writer MCP aggregate result or a clearly identified permitted fallback, exact query, filters/window, units, derivation and limitations. Reject drafted-only/failed queries presented as observations. A not-applicable result is valid only when traffic/load/capacity is outside approved scope and the research draft was preserved unchanged. Return `gaps` for missing/inconsistent proof; the declared research → traffic-evidence → validate recovery route runs automatically.
- Forecast: distinguish observations from assumed audience share, reads per render, retries and expansion. Keep unmeasured future consumers explicit; reject fabricated measurements, metric names, or graph series.
- External output: actual image content is a graph, not an error PNG. Verify returned resource identity and permission/authority; distinguish a published dashboard from an importable local draft. Optional rendering/access gaps are limitations, not a reason to fabricate success.
- Completeness: retain the entire validated draft and citation/criterion ledger. A truncated file/tool preview is not a complete artifact; read remaining content before approving report writing.

`ready`: draft satisfies the goal and destination contract.
`gaps`: return to research with exact gaps.
`refresh`: an approved scope, source/base assumption or destination action is materially invalidated; return to plan for a revised scope artifact and approval before further research/delivery. Same-scope evidence reconciliation keeps its existing route.
`handoff`: transient read failure.
`blocked`: irreconcilable evidence.


## Required ready response
Put the complete validated draft or its full-content reference in `Completed`, with criterion-by-criterion validation and citation-check results.

# Completed
<complete validated draft and validation ledger>

# Remaining
- None.
