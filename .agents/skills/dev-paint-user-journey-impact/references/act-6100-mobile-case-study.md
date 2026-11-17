# ACT-6100-MOBILE: evidence-bounded explanation example

Historical case: experiment 1081670, run 1342384. Investigation reviewed on 2026-11-07. This is a format example, not a current-production diagnosis or an established attribution of the full experiment imbalance.

## Evidence provenance

Source session directory:
`/Users/djain/.omp/agent/sessions/-Desktop-projects-activities-web-.worktrees-cxp-review/2026-11-07T04-07-31-938Z_01a1b430-af62-76b3-b9ce-581686430dd1/`

Evidence within that directory:
- `local/act-6100-mobile-verification.md`: population definitions, certification recovery/exclusions, historical revisions, and initial hypothesis verdicts.
- `local/act-6100-mobile-stage-isolation.md:212-218`: explicit boundary between observed production signatures and unverified full-run causal attribution.
- `BentoTransportInvestigator.md:419-503`: controlled combined probe, controls, and reproduction limits.
- `BentoTransportInvestigator.jsonl`: nested investigation transcript and retained probe references.

The retained probe directory at review time was `/var/folders/m6/6dpd92sn5n33486ty77bggwh0000gp/T/bento-runtime-2m3c00lf/`; `measured-summary.json` contains the timings below. Temporary paths may disappear. If the source is unavailable, do not claim to have rerun or independently verified its results.

## 1. The core rule

In this run's recovered definitions, impact-segment matching accepted qualifying page types 9000/9001/9002 without requiring Visit specifically. Certification was separate: it included exclusion and recovery rules and a historical lookback. Losing a Visit was therefore not sufficient to prove loss of a certified or segment user.

The controlled transport investigation used real messaging-client 1.19.1 and performance-client 15.3.0 with an emulated worker and intercepted transport. The tested configuration shared a queue between analytics and resource telemetry. A synchronous main-thread handoff did not bypass the worker backlog. These are version/configuration-specific findings, not universal queue rules.

## 2. A chronological journey — controlled mechanism, not a production replay

**Illustrative entry action:** a person opens an Activities Details page. No specific production user's subsequent bounce was observed by this harness.

1. **Initial context:** the server supplies route/bootstrap context. Historical source investigation identified mobile context-matching cases that could trigger an unnecessary refresh. Production incidence by landing URL was not recovered.
2. **Content request:** the controlled B schedule holds the primary request behind refresh completion; the A schedule does not. The relevant application locations were `buildRefreshParams.ts`, `initialDocumentRoute.ts`, and `activitiesGqlApi.ts`. Source revisions and exact triggering URLs must accompany any implementation review.
3. **Competing telemetry:** the controlled schedule settles performance measurement while B's content request waits, placing resource messages ahead of its later Visit. Application scheduling was examined in `PerformanceService.ts`; actual batching was exercised in the SDK.
4. **Request observation:** the harness records request construction through fake transport. It does not contact the collector or measure production network receipt.

All times in this table are milliseconds relative to the same **controlled probe origin**, not a production navigation clock:

| Probe arm | Visit handoff | Intercepted request time | Handoff-to-request duration | Recorded Visit batch |
|---|---:|---:|---:|---:|
| A | 388 | 1360 | 972 | 1 |
| B | 837 | 4381 | 3544 | 4 |

The duration column must not be used as the absolute request time. Batch position does not guarantee a fixed deadline.

## 3. User and reporting impact — what is and is not established

**Observed production:** the stage-isolation report found greater B creation-to-receipt latency among surviving single-Visit users, a mapped-segment deficit concentrated in non-WebView records, and some resource-emitting users with no matching raw analytics through the observation cutoff.

**Controlled reproduction:** the selected refresh/resource schedule can move Visit behind resource batches and increase handoff-to-request time.

**Illustrative early exit:** if a person leaves before an event is dispatched, and no persistence, lifecycle flush, or later recovery delivers it, that event could be lost. The harness did not demonstrate those lifecycle conditions for production users. Other accepted events or certification recovery can preserve reporting membership.

**Not established:** which missing users experienced this queue state; whether they abandoned the page before a particular batch; or how much of the full run's deficit this mechanism caused. Page-bucket differences describe observed membership, not causal percentages attributable to this defect or proof of entry routes.

## 4. Relevant code and next evidence

- Bootstrap matching determines whether the refresh is necessary for the specific route and context.
- The request gate determines when content-dependent work can proceed.
- Performance scheduling and the transport implementation determine competing messages and observed batch order.

The bounded conclusion is a reproduced contention mechanism plus compatible production observations. Causal attribution needs historical exposure, landing-intent linkage, per-user lifecycle/queue evidence, and deduplicated outcome reconciliation. An explanation or Jira ticket must preserve that boundary.

## Review correction: inspect the result shape

The retained performance-client source (`performanceClient.js:1871-1882,1927-1934`) resolves cancellation/rejection to a Measurement object with `.result` undefined. The object itself is truthy. Do not reuse the original narrative's proposed `if (!alcpResult)` guard without checking the actual return contract and exercising cancellation. This example teaches contract inspection, not a universal replacement guard.
