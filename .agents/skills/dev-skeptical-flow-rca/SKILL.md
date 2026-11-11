---
name: dev-skeptical-flow-rca
description: "Investigate complex bugs, telemetry gaps, experiment bias, or latency regressions; also audit an existing RCA for falsifiable claims, historical exposure, and causal overstatement."
---

# Skeptical Flow & Root-Cause Investigation

Do not make production, experiment-audience, or deployment changes as part of read-only investigation without authorization.

## 1. Establish the question and evidence boundary

- State the symptom, affected window, surfaces, variants, and unit being counted (events, allocation keys, sessions, people, or bookings).
- Separate the reported symptom from nearby defects. Missing a repeat event is not necessarily loss of a distinct qualifying user; a symmetric defect does not by itself explain differential loss.
- Identify historical source revisions, package versions, flags, rollout intervals, and served-build evidence. Current source, an MR's existence, or a rollout date alone does not establish per-user historical exposure.
- For an existing RCA, extract its claims before reading its proposed fixes. Ask what observation would falsify each claim, rather than treating the conclusion as a plan to validate.
- If comparing experiment populations, use `skill://dev-reconcile-experiment-populations`. Keep raw allocation, certification, impact membership, eventors, and booking units separate. Recover actual predicates rather than assuming semantics from display names or API parameter names.

## 2. Build a claim ledger before promoting conclusions

Use one row per mechanism:

| Claim | Historical source / version | Falsifying test | Observed result | Production exposure | Differential distinct-user loss / overlap | Verdict |
|---|---|---|---|---|---|---|

Record unknowns explicitly. Link source, command, query, payload, or result artifacts for each substantive claim. Record counterexamples, failed extractions, and superseded results; a failed query supplies no population estimate.

Use these verdicts:
- **Refuted in the tested scope**: the claim fails a discriminating test. Name the scope; do not rule out untested mechanisms.
- **Plausible, unverified**: a mechanism is consistent with evidence but essential reproduction, exposure, or outcome linkage is missing.
- **Confirmed code defect**: a reproduction at a stated seam violates an established requirement or invariant; historical production contribution may still be unknown. Reproducing contention or another behavior alone does not establish a defect—label it **observed mechanism** when no violated contract is established.
- **Confirmed production contributor**: demonstrated mechanism plus historical exposure and evidence connecting it to differential production failure. State which contribution is established and which quantity remains unknown; a matching aggregate signature alone is insufficient.
- **Supported run-level RCA**: mechanism, exposure, and deduplicated differential loss reconcile the observed outcome within stated uncertainty. Report any unexplained remainder instead of declaring complete attribution.

“No users causally quantified” means unknown contribution, not proof of zero contribution.

## 3. Isolate the failure with comparable observations

Map allocation/request context, client execution, raw events, certification, and reporting to the actual available sources. These are observation points, not necessarily a strictly sequential funnel: certification may precede the request or be recovered through other paths.

- Follow the same keys and compatible time windows; retain unmatched records and ambiguous identities.
- Locate the first observable divergence, then distinguish event generation, handoff, transport, ingestion, and mapping hypotheses.
- Telemetry receipt proves that some code ran and some telemetry arrived. It does not prove full rendering, creation of another event, transport loss, or browser abandonment.
- “No matching raw record through cutoff” is an observation, not proof that an event was never generated or why it is absent.
- Inspect all qualifying event types. A missing Visit does not remove a user who qualifies through another accepted event or recovery path.
- Do not use surviving users' latency or observed page membership to infer failure probabilities or entry journeys for missing users.
- Keep limited windows, sample counts, and crawler examples bounded. Do not extrapolate them into full-run causal loss without a justified sampling/exposure model.

## 4. Reproduce the mechanism, not a rewritten imitation

Use the real implementation at the seam under investigation, with explicit controlled inputs and substitutions. Compare matched variants or before/after configurations, changing one suspected cause at a time. Include counterexamples and lifecycle/error cases that could distinguish competing explanations.

When the explanation depends on SDK buffering, workers, singleton behavior, batching, cancellation, or API-gate interactions, read [Real-package transport probing](references/real-package-transport-probe.md) (`skill://dev-skeptical-flow-rca/references/real-package-transport-probe.md`). It defines provenance, safe interception, controls, and observation boundaries.

A controlled harness can establish that a mechanism occurs under its inputs. It is not automatically a production-page reproduction, historical exposure census, or proof of the full population loss. State unavailable runtime or production evidence rather than manufacturing it.

## 5. Keep clocks and causal quantities separate

For every timing, state origin, start event, end event, unit, environment, population/filter, and source. Separate navigation start, event creation, worker handoff, request construction, dispatch, receipt, ingestion, and reporting.

- Verify timestamp meanings, clock synchronization, timezone, and event identity. Earliest creation and earliest receipt can belong to different events. Prefer event IDs; if unavailable, use a justified restriction and disclose its survivor selection.
- A duration is not an absolute timestamp. Pre-event waiting cannot directly explain an event-to-request duration, although it can change ordering relative to competing work.
- Batch position is not a latency guarantee. Startup, acknowledgements, retries, persistence, and backoff may matter.
- Descriptive page-bucket differences are not causal fractions. Deduplicate overlapping mechanisms and nested population deficits before reconciliation.

## 6. Preserve evidence strength through every handoff

Before delivering an explanation, diagram, ticket, memory, or handoff, check each material assertion against the ledger. Use labels where needed: **Observed production**, **Controlled reproduction**, **Inspected implementation**, **[INFERENCE]**, and **Illustrative scenario**.

Never upgrade a source's uncertainty during summarization. A vivid bounce story does not establish that identified users closed a tab, that pending events were permanently lost, or that a mechanism caused the entire reporting deficit. Preserve exclusions, recovery paths, counterevidence, and missing exposure data.

For a user-facing chronological explanation, use `skill://dev-paint-user-journey-impact`; pass the ledger and its limits along with the findings. Keep case-specific package settings and example numbers in versioned references, not universal rules or prescribed fixes.

## Deliverable

1. Conclusion with its verdict and scope.
2. Claim ledger, including evidence against the favored explanation.
3. Reproduction/query instructions and result references, with clocks and populations defined.
4. Explained, overlapping, and unexplained outcomes; unknown attribution remains unknown.
5. The next discriminating check or bounded fix supported by the evidence. Do not replace diagnosis with audience exclusions or other symptom-masking changes.
