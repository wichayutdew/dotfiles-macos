# Stage: research

Use the invoking request and complete source evidence, inline or through the evidence references defined in SKILL.md.

---

Deep-research the approved scope. Do not write or publish to the destination(s) yet.

Input: `the invoking request`
Approved scope: `the approved plan artifact from this run`
Feedback: `approval feedback from this run`
Prior draft: `{{last.summary}}`

Use available resources justified in scope, honoring the user’s explicit tracker/connector and discovering current capabilities. A list of example integrations is not an allowlist. Search local code with `rg`. Reading a service does not authorize messages or mutations.

Prepare the complete draft and source identities for the declared [traffic-evidence](traffic-evidence.md) stage, which runs next. Identify relevant backend metrics, consumer analytics definitions/emitters, and claims needing measurement. Carry any already executed query/results forward in full so that stage can verify/reuse them rather than rerun them. Do not label a query draft, screenshot, or generic page-visit proxy as measured traffic.

A parent recovery `handoff` is unconfirmed context, not proof that research was completed. Reconcile the approved scope, request, and prior draft before continuing; do not infer evidence, findings, or progress from it.

## Evidence and reasoning checks

- Trace the relevant implementation and verify source snippets in context. Keep user intent, observed code/runtime behavior, hypotheses, and unknowns distinct. A ticket label, class name, or diagram is not proof of behavior.
- For each alternative, break down changes by contract/serialization, service wiring, product/campaign context, filtering, cache, DB, and tests. Explicitly list unchanged dependencies; propose endpoint/request/response examples only when requested, preserving user-owned contracts.
- Separate response/mapping work, transient allocations, resident context/cache memory, and DB I/O. A request filter does not automatically shrink a process-wide context or cached payload. Check whether pushing a filter into DB/cache changes procedures, keys, value completeness, or invalidation scope.
- Verify shared cache cluster/bucket, key composition, version, and invalidation caller before claiming cross-service eviction works automatically. Shared code or a logical DB name does not establish deployed topology or consistency. Record inherited limitations as risks when redesign is out of scope.
- For FE-derived demand, find the analytics definition and actual emitter. Verify element name versus DOM identifier, action (`seen`/`reveal`/click/visit), platform/variant filters, gates, and repeat-emission behavior. Do not mix similarly named carousels/cards or silently relabel a mismatched ticket.
- Record query text, datasource, date/timezone, filters, units, coverage, and result/limitations. Check relevant deployment environments rather than cherry-picking a small series. Empty results, missing telemetry, and failed queries are not proof of zero usage; respect query resource guards and narrow scope instead of brute-force retries.
- Keep measurements and forecasts separate. Exposure events are not API calls; state reads-per-render, rollout/eligibility, caching, retries/refetches, and unknown future-consumer budgets. Label page-visit/proxy envelopes explicitly. Do not invent an audience ratio or fill missing traffic with a zero curve.
- Verify tool capability, access, mutation authority, and actual output separately. Inspect rendered images for error pages/placeholders. A readable dashboard or PNG response does not prove create permission or a successful graph. Label local/importable drafts as unpublished; do not invent created-resource URLs or nonexistent metric series.

## Draft contract

Use the approved report/template headings and reference style. Put product benefit first and evidence inline. Complete each alternative before moving to comparison. Diagrams use real service names and show only the relevant baseline or proposed read/write scope; distinguish shared code/libraries from deployed services and physical stores.

If no report template is approved, use this default outline; include implementation stories only when the approved scope calls for them. Do not append this outline as a duplicate appendix to an approved RFC template.

# Brief description
# Goal
# Non Goal
# Risks
# Stories breakdown

Each requested story:

## Brief Title
## Brief description
## Things to implement
## Acceptance Criteria
## Dependency

`ready`: complete draft and source evidence are ready for traffic-evidence; explicitly mark traffic claims awaiting that stage rather than inventing measurements.
`refresh`: an approved scope, source/base assumption or destination action is materially invalidated; return to plan for a revised scope artifact and approval before further research/delivery. Same-scope evidence reconciliation keeps its existing route.
`handoff`: transient tool failure.
`blocked`: required evidence inaccessible.


## Required ready response
Put the complete research draft in `Completed`, including every required heading, story, citation, source identity, and unresolved evidence gap. On `handoff`, retain the complete partial draft and exact remaining research.

# Completed
<complete draft with cited evidence>

# Remaining
<exact remaining work, or None.>
