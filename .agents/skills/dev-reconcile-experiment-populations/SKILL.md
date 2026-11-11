---
name: dev-reconcile-experiment-populations
description: "Reconcile A/B raw allocations, certification, impact segments, eventors, and bookings; use when counts disagree, denominators may differ, or analytics loss is proposed to explain allocation bias."
---

# Reconcile Experiment Populations

Population reconciliation does not establish a code-level root cause. Use the applicable data/query skill to discover sources and execute read-only queries; use `dev-skeptical-flow-rca` for mechanism investigation.

## 1. Define each population before comparing counts

Create a population contract for every reported number:

| Population / measure | Source, exact field, query or API | Grain and identity key | Experiment / run | Time and ingestion bounds | Eligibility, deduplication, recovery, and exclusions |
|---|---|---|---|---|---|

Record:
- Whether the unit is an allocation key, user account, session, event, eventor, booking key, or booking unit. Cookie/allocation keys are not automatically unique people.
- Allocation bounds, event-time bounds, timezone, interval inclusivity, lookback/recovery rules, data snapshot or extraction time, and processing watermark/maturity.
- Key normalization and joins supported by source contracts. Do not lowercase, trim, or otherwise merge identities without confirming those semantics.
- Variant assignment policy, repeat allocations, variant switchers, duplicates, null keys, and conflicting decisions. Document how each is included, excluded, or classified.
- Exact metric predicates. Names such as 'Mobile Web', 'booking', or `is_segment=false` do not establish population, surface, or grain.

Keep raw allocation, certified reporting, impact membership, hypothesis eventors, and bookings separate. Establish whether populations are nested or overlapping from predicates, not labels. Certification and impact qualification are independent rules; neither implies the other unless the actual pipeline enforces that relationship.

Historical Activities examples included `trafficdw.exp_allocation_agg`, `trafficdw.user_exp_runs_daily`, `prism.events_map`, and `bi_dw.dim_experiment_user_defined_metrics`. These are discovery leads only. Verify availability, schema, predicates, and historical processing rules for the requested run; do not inherit a prior run's lookback or page-type constants.

## 2. Freeze a comparable cohort

- Select the requested historical run and source snapshot. Do not silently substitute the latest run, current rules, or a newer reporting cutoff.
- Keep an authoritative allocation-key spine. If reconstructing an alternative compact cohort, reconcile it separately with official totals before using its denominators.
- For sampling, choose a deterministic hash over a verified canonical identity, apply it consistently across arms and sources, and disclose the rule and sampling fraction. Avoid sampling only surviving analytics users when estimating allocation-to-reporting rates.
- Use stable-variant keys only when appropriate to the question; account for excluded switchers rather than silently dropping them.
- Give late events enough observation/ingestion time under the actual rules. Same-day matching is not a default. Record extraction timestamps: a fixed event-time cutoff does not prevent later ingestion from changing results.

## 3. Link stages without discarding missing users

Starting from the allocation spine, retain unmatched records while linking available raw telemetry, raw analytics, certification decisions, and independently observed processed segment membership. Do not use certified-only event tables to establish absence of raw events.

Certification may occur before allocation or through booking recovery. A client-performance signal is an independent observation, not necessarily a stored prerequisite for analytics. Verify table existence and meaning rather than inventing a linear funnel.

Build mutually exclusive, exhaustive categories for the spine, for example:
- Matching segment event plus observed processed membership.
- Raw matching event but no processed membership through cutoff.
- Other raw events only.
- Certification through prior activity or recovery, with no observed post-allocation raw event.
- Explicit exclusion, preserving its actual reason and decision precedence.
- No matching raw record through cutoff.
- Identity, timing, or decision ambiguity.

These are examples, not fixed pipeline rules. Define precedence so each key appears once; preserve independent certification/membership flags for cross-tabulation. Separate 'no record' from explicit rejection. If a permitted event other than Visit exists, do not count that key as lost merely because Visit is absent.

## 4. Reconcile counts and rates

Before interpreting:
- Confirm category totals equal the allocation spine for each arm.
- Check duplicate joins, membership outside the spine, null keys, switchers, inconsistent snapshots, and certification conflicts.
- Reconcile independent processed counts against reconstructed predicates; retain unexplained differences rather than forcing equality.
- Separate all-event coverage, qualifying-event coverage, certification, and membership. Report denominators for every percentage.

For comparable arms, let `N_A`, `N_B` be allocated keys and `O_A`, `O_B` be the same observed outcome. For positive denominators report:
- Outcome rates `p_A = O_A / N_A`, `p_B = O_B / N_B`.
- Observed count difference `O_B - O_A` and rate difference `p_B - p_A`.
- If useful, descriptive A-rate-normalized B shortfall `N_B * p_A - O_B` (positive means fewer B outcomes than the A-rate baseline).

That shortfall is not a causal estimate of a specific defect. With zero denominators, mark the rate undefined rather than inventing a percentage. Never mix official raw totals with a differently reconstructed outcome cohort.

Do not add deficits from nested populations, overlapping metrics, or overlapping failure mechanisms. Exclusive page/action buckets can decompose a count difference but do not identify causes, entry routes, or unobserved behavior. A positive offset in one bucket can make another bucket's descriptive share exceed 100%; do not normalize away counterevidence.

## 5. Bound inference and uncertainty

- State sample selection, uncertainty method and assumptions, ingestion maturity, and missing coverage. A hash sample alone does not establish causal confidence or justify multiplying a sampled gap into an exact full-run loss.
- Latency among delivered events describes survivors. It does not measure missing users' latency, bounce rate, or worker-queue time alone.
- Sampled headers or crawler examples do not classify an entire unmatched cohort. Device labels do not establish the surface where qualification occurred.
- A failed full-run export supplies no full-run result. Use narrower evidence with its bounds intact.
- Distinguish known imbalance, descriptive localization, and mechanism-attributable loss. Leave causal attribution unassigned when exposure and outcome linkage are absent.

## Output contract

1. **Population dictionary** with exact sources, grains, predicates, clocks, and watermarks.
2. **Comparable A/B table** with counts, rates, and explicit denominators; separate incompatible snapshots/cohorts.
3. **Allocation-to-reporting cross-classification** with totals reconciled and ambiguities visible.
4. **Reproducible evidence**: executed SQL/API parameters, source revisions, result references, and unsuccessful extraction boundaries. Never present generated-but-unexecuted SQL as a result.
5. **Reconciliation ledger**: nested/overlapping populations, descriptive normalized differences where justified, unexplained discrepancies, and the next discriminating query.

Report read-only findings. Do not change audience fences, experiment settings, pipelines, or production instrumentation to make the counts agree.
