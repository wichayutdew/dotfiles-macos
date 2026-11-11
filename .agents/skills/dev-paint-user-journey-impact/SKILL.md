---
name: dev-paint-user-journey-impact
description: "Explain how a bug or change affects users through a chronological user-action, code, API, and telemetry walkthrough; use for 'paint the picture' requests while preserving evidence limits."
---

# Paint the Picture: User Journey and Code-to-Impact Explanation

This is an explanation format, not a replacement for investigation.

## Inputs and evidence discipline

Use the investigation's claim ledger, source references, observations, and unresolved questions. If they are absent, explain only supported behavior and identify the missing evidence; do not invent a diagnosis to fill the template.

- Distinguish **Observed production**, **Controlled reproduction**, **Inspected implementation**, **[INFERENCE]**, and **Illustrative scenario** wherever the distinction affects a conclusion.
- Preserve the source's uncertainty when summarizing. Do not turn association into causation or a reproduced mechanism into a quantified production contribution.
- Attach exact files/symbols and revision-specific line references when available. Do not invent pointers or reuse historical line numbers as current ones.
- Use measured timings only with clock origin, start/end boundaries, environment, and population. Otherwise describe order without milliseconds.
- Keep generation, enqueue, request construction, dispatch, receipt, ingestion, and reporting separate. A duration is not an absolute time.
- Missing telemetry does not establish user abandonment, transport loss, or non-certification. Check other qualifying events, exclusions, recovery, persistence, and observation windows before making those claims.

## Part 1: Reusable output format

Adapt the following four sections to the actual system. Do not force a queue, bootstrap call, A/B experiment, bounce, or exactly three code points into an unrelated problem. Omit inapplicable steps rather than inventing them.

### 1. The core rule to keep in mind

State the minimum rules needed to understand success or failure, in plain language:
- What the user is trying to accomplish.
- What state transition or contract makes that successful.
- Any relevant prerequisite, ownership rule, reporting predicate, or bottleneck established by evidence.

For analytics, distinguish allocation, event qualification, certification, and reporting membership. An event satisfying one predicate does not automatically satisfy all of them.

### 2. Chronological user journeys

Use concrete actions and supported route/device/context details. Compare control/treatment or before/after only where such a comparison exists.

At each meaningful step cover:
1. **User action / visible state**: what the person does or sees.
2. **Code and state**: the owning function/component, condition, and transition.
3. **API or asynchronous work**: what starts, waits, completes, fails, or is cancelled.
4. **Telemetry, if relevant**: event name, required context, and the observed stage of delivery.
5. **Divergence and evidence**: where the paths differ and what establishes that difference.

Use a timeline table, sequence diagram, or concise numbered steps—one primary representation, not duplicate versions. Use relative order when times are unknown. Label synthetic schedules and illustrative actions explicitly.

Order journeys **by measured real-world impact only when comparable, deduplicated evidence supports that ranking**. Label descriptive count differences as descriptive, not defect-attributed loss. If impact is unmeasured, use an explicitly stated investigation priority or journey order; omit fabricated percentages.

### 3. What this means for the user and reporting

Connect the technical divergence to the observable consequence. Separate:
- What was directly observed.
- What the mechanism reproduces under controlled conditions.
- What could happen under a clearly labelled illustrative scenario.
- What remains unmeasured, including incidence and attributable user loss.

A median from surviving events is neither an individual user's timeline nor proof that all users leaving earlier lose events. Do not convert event-to-receipt latency into navigation-to-receipt latency, substitute one page's numbers for another's, or extrapolate a small sample into an exact population loss.

For a hypothetical early exit, state the conditions under which pending work would be lost or recovered. If lifecycle behavior was not exercised, say the outcome is unverified. A user with another accepted event may still qualify despite the missing event being discussed.

### 4. Code points and remaining evidence

Close with the small set of relevant source locations and each one's actual responsibility. Do not require roles such as 'queue flooder' or 'API gate' when they do not apply.

State the strongest supported conclusion and the next observation needed to resolve a material uncertainty. Include fixes only when requested or already supported by the investigation; do not prescribe arbitrary timing constants.

## Part 2: Worked examples are separate

For the historical CXP example, read [ACT-6100-MOBILE evidence-bounded case study](references/act-6100-mobile-case-study.md) (`skill://dev-paint-user-journey-impact/references/act-6100-mobile-case-study.md`). Its package versions, routes, cohorts, and numbers are historical examples, not defaults or proof about current production.

## Final check

- Can the reader follow user action → code/state → external work → observable consequence?
- Does every numerical or causal claim retain its source, clock, population, and confidence?
- Are examples separated from production observations and the reusable format?
- Were unknowns preserved rather than replaced with a compelling story?
