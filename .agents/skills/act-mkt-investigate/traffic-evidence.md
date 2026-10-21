# Stage: traffic-evidence

Use the complete invoking request, approved scope, and prior stage artifacts from the active conversation or their evidence files.

---

Capture or verify actual traffic proof for the research draft. Do not write the report destination yet.

Input: `the invoking request`
Approved scope: `the approved plan artifact from this run`
Research draft: `{{last.summary}}`
Existing evidence: `complete prior source/query/result artifacts from this run`

## Applicability and handoff

- If traffic/load/capacity is outside the approved scope, return `ready` with an explicit not-applicable finding and the complete research draft unchanged. Do not run unnecessary tools or introduce a new approval pause.
- Otherwise, apply the workflow below within the approved resource/publication contract. Reuse valid captured query/results with complete provenance; execute only missing or stale measurements rather than duplicating work from research.
- Hand off the complete research draft with its traffic claims reconciled against the proof records, preserving approved headings and user-owned contracts. Include applicability, executed query/results, source identities, derivations, graph/access status, assumptions and unresolved gaps—not a tool-activity summary.
- Missing optional telemetry/rendering is a documented limitation. Use `blocked` only when decision-critical evidence or safe continuation is genuinely unavailable; never turn missing proof into a fabricated observation.

Discover current tool names/schemas before calling them; the names below describe available interface patterns, not permanent availability or access guarantees.

## Evidence contract

- Choose the tool for the claim: Grafana MCP for existing backend traffic; Query Writer MCP for consumer exposure/audience. Do not call both by ritual or invent an existing metric for a proposed endpoint. Code establishes the emitter; executed aggregates establish observed volume. Neither alone proves future demand.
- Prefer exact consumers, routes and FE elements over whole-site visits or historical proxies. Keep any proxy envelope explicitly labeled and separate from observed component traffic.
- Use only authorized read-only queries. Do not claim traffic proof from a query that was drafted but not executed, a failed result, or an error image.
- Collect aggregates; do not export customer IDs, wallet contents, or raw sensitive event payloads.

## 1. Grafana MCP — existing backend workload

1. **Locate the source.** Use `search_dashboards`, `get_dashboard_summary`, `get_dashboard_panel_queries`, or targeted `get_dashboard_property` reads. Start from an existing relevant dashboard; inspect its datasource, queries, variables and metric instrumentation rather than inventing names.
2. **Verify datasource and dimensions.** Use `list_datasources` / `get_datasource`, then metric/label discovery tools. Confirm the exact route, deployment environments, region and units. Include every relevant production deployment; a low-volume default environment can miss a dedicated high-traffic workload. Separate real-customer traffic from mirror/test traffic when the source supports that distinction.
3. **Execute bounded queries.** Use `query_prometheus` for a verified PromQL-compatible datasource, including WF-PromQL, or the datasource-specific tool. If an API is unsupported, use a documented, permitted read-only fallback and record it; do not bypass auth or claim MCP executed it.
4. **Match query semantics to metric type.** Prometheus cumulative counters use `rate`/`increase`; Whitefalcon measurement histograms use its supported count/average/quantile semantics. Do not invent `_bucket`/`_count` series or count time-series cardinality as request volume. Verify units from code/metadata; a duration may be nanoseconds despite an unsuffixed metric name.
5. **Capture volume and rate.** Prefer a recent complete window, typically 24 hours, with minute buckets when affordable. Record both requested and returned timestamps, step/lookback and warnings. Use non-overlapping buckets for total volume; overlapping five-minute counts sampled each minute cannot simply be summed.
6. **Summarize correctly.** Average rate uses the full declared window in seconds, not only the number of nonempty returned buckets. State how missing buckets/series are handled; missing telemetry is not measured zero. Compute combined peak by summing aligned buckets first, not by adding each environment's independent maximum.
7. **Name what was counted.** A route timer counts observed executions, not unique customers. A timer's exception-success tag need not mean the response body's business-success flag is true. Neither response duration nor cache hits establish read-after-write freshness.

### Graph proof and access checks

- Generate dashboard/panel/Explore links with `generate_deeplink` using verified UIDs, queries, time range and variable values. Read variable definitions; display text such as `All` need not be its serialized value.
- Try `get_panel_image` only for an existing verified dashboard/panel. Inspect the actual PNG: “dashboard/panel not found” is an error image, even if the tool returned image bytes without `isError`.
- Check read, render and create/write capability separately. Dashboard metadata saying `canEdit` does not override a read-only MCP gateway or grant mutation authority.
- Create a separate dashboard only with current authorization and available write access; read it back before claiming it exists. Never invent its URL or modify a shared dashboard as an unapproved fallback.
- If rendering/creation is unavailable, report the exact limitation. An approved local chart drawn from captured results or importable dashboard is useful, but label it local/unpublished and state whether queries/rendering were verified. Missing instrumentation stays a gap, not a fabricated curve.

## 2. Query Writer MCP — consumer exposure/audience

1. **Trace each consumer first.** Verify the Jira/feature mapping, analytics definition and frontend emitter. Capture exact element, actual action (`seen`, `reveal`, click or visit), platform field, variant, gates and repetition behavior. DOM `data-component` names and similarly named carousel/card elements are not interchangeable FE element identities.
2. **Discover storage/schema.** Use `search_knowledge_base`, metadata queries and `read_column_info` / `search_relevant_columns`. Verify the table, partition column/types, timestamp, action/element fields, platform/variant and certification fields before executing SQL. For WebAnalytics, `webanalytics.webtraffic` may be appropriate; verify it rather than assuming a universal source.
3. **Discover stored values cheaply.** Begin with one completed partition and exact source-verified element names. Group observed actions/platform/variant/certification values before narrowing. A source's camelCase variant may be normalized in storage; native iOS and Android may both have `platform='mobile'` and require an emitter-verified field such as `element_data` to split them.
4. **Execute exposure aggregates.** Use `execute_query` for bounded SQL. Count the correct exposure action; exclude clicks, unrelated header styles and child-card impressions unless explicitly part of the model. Use certification/brand/platform filters only after verifying their stored values. Preserve repeated exposure counts as such; do not label them unique users or deduplicated renders.
5. **Aggregate in the warehouse.** Group by minute for peaks and by day/platform/variant for totals. Combine components at the same timestamp before calculating their combined peak. Avoid joins to duplicate dimension rows that multiply events.
6. **Respect resource limits.** Start small; extend only when affordable. On a warehouse CPU/resource guard, retain the failure and narrow date/element/grouping. Do not brute-force the same broad query or present a partial/two-day result as a successful seven-day measurement.
7. **Interpret absence narrowly.** An empty exact-element query means no matching rows in that source/window/filter. Check emitter action, deployment, gates and instrumentation; it does not prove the feature has no users. An in-development consumer with no live telemetry still needs an explicit future-capacity assumption, not a zero-demand series.

### Illustrative SQL shape — verify schema and replace placeholders

This is not an executed query or automatic proof that the table/filters apply. `Y` and a 24-hour denominator are examples that must match the discovered source and window.

```sql
WITH per_minute AS (
  SELECT DATE_TRUNC('minute', logtime) AS minute_at,
         element_data AS platform_variant,
         COUNT(*) AS exposure_events
  FROM webanalytics.webtraffic
  WHERE datadate = '<completed YYYYMMDD partition>'
    AND certified = 'Y'
    AND action_element_name = '<source-verified FE element>'
    AND action_type = '<actual exposure action>'
    -- Add the verified variant filter when one element covers several layouts.
  GROUP BY DATE_TRUNC('minute', logtime), element_data
)
SELECT platform_variant,
       SUM(exposure_events) AS total_exposures,
       SUM(exposure_events) / 86400.0 AS average_events_per_second,
       MAX(exposure_events) / 60.0 AS highest_minute_events_per_second
FROM per_minute
GROUP BY platform_variant;
```

## 3. Turn exposure into a conditional load model

- Keep backend request observations, FE exposures and modeled extra requests in separate figures/series.
- Define reads per render/fetch, eligibility, current experiment allocation, rollout expansion, local/backend caching, batching, refetches and retries. Do not invent an audience percentage or infer full rollout from a gated current cohort.
- Fetch-before-visibility can create API calls without a `seen`; repeated visibility can create multiple `seen` events for one cached read. “One wallet read per seen” is a named assumption, not an observed request count.
- Do not multiply a batch wallet read by campaign/card/trip count. Do not assume request-scoped deduplication also deduplicates independently deployed consumers.
- Leave unmeasured future consumers and missing telemetry as explicit budgets/unknowns. A historic downstream-call reference is not a newly measured renderer exposure.
- State whether backend and analytics windows/timezones align. Their averages may support a scenario comparison without proving a jointly observed peak or available service capacity.

## 4. Required traffic proof record

For each numeric traffic claim, carry:

- **Status/quantity:** measured, derived, modeled, unavailable, or failed; executions/events/renders/users/rate/peak with units and business meaning.
- **Identity:** source revision/emitter or instrumentation pointer; datasource name/UID or database/table.
- **Selection:** exact route/element/action/variant, environments/platform/certification filters.
- **Window:** start/end, timezone or analytics partition, step/lookback, requested versus returned timestamp.
- **Execution:** exact query and original aggregate result, warnings/errors, coverage and missing-data treatment.
- **Derivation:** total, denominator for average, aligned-bucket peak, and any forecast multipliers or unknowns.
- **Visual:** verified graph/link and its window, or explicitly local/unpublished/error status.

Put the result, key filters and supporting query/source beside the report claim. Complete raw aggregates can be retained in an approved evidence sidecar; otherwise carry them in the stage payload. A detached artifact link or screenshot alone does not replace an understandable inline proof summary. If decision-critical measured data is inaccessible, report the factual gap; do not silently downgrade a capacity claim to an unlabelled estimate.

## Outcomes

`ready`: proof is captured/verified and the complete reconciled draft is ready for validation, or traffic is explicitly not applicable and the complete draft is preserved unchanged.
`handoff`: transient evidence work remains; retain the complete partial draft and evidence already captured.
`blocked`: required evidence/access/authority is unavailable and safe continuation is impossible; report the exact factual gap without asking a question.

## Required ready response

# Completed
<complete reconciled research draft plus applicability, traffic proof records, source/query identities and results, derivations, graph/publication status, assumptions, and explicit evidence limitations; on not applicable, include the complete unchanged research draft>

# Remaining
<exact remaining work on handoff, or None.>

