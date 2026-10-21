# Stage: review

Use the invoking request and complete source evidence, inline or through the evidence references defined in SKILL.md.

---

Review the fetched change for introduced regressions and performance degradation. Do not publish or edit product code.

Input: `the invoking request`
Evidence: `{{last.summary}}`

## Review method

- Compare the target/base revision with the reviewed head. Trace changed code into callers, consumers, response models, configuration and tests; a diff alone is insufficient.
- Prioritize broken supported behavior, compatibility/schema drift, auth/session boundaries, stale asynchronous results, pagination/completeness, empty/error paths, and introduced security or data-loss failures. For new functionality, use its explicit contract rather than inventing prior behavior.
- Follow performance mechanisms affected by this change: per-item I/O, lost batching/concurrency/connection reuse, query/index changes, repeated rendering/refetches, blocking, cache behavior, unbounded work/memory, retry/timeout budgets and fan-out. Select relevant checks; do not perform a whole-repository audit.
- Validate suspicions with a focused reproduction/test, source trace, or measured comparison. Check realistic fixtures against actual selected fields and request/response contracts; green CI alone does not disprove a defect.
- Distinguish measured degradation from a static estimate. Explain the mechanism, supported input scale and assumptions; do not invent timings. Obvious serialized I/O need not wait for a benchmark.
- Exclude naming, formatting, stylistic refactors, speculative architecture preferences, unrelated pre-existing defects and disagreement with approved product choices. Business behavior warrants a finding when it demonstrably breaks supported behavior or an explicit contract.
- Check existing discussions and current fixes. Report one finding per root cause; do not repeat an already-addressed issue or manufacture a finding to fill a quota.

## Finding contract

For every actionable finding, provide severity, changed path and tight line anchor, trigger, baseline versus changed behavior (or new-feature contract), concrete user/operational impact, evidence and a scoped correction. Set priority by demonstrated impact and plausible exposure, not preference. Keep uncertain suspicions out of publishable findings and state material verification limits separately.

`ready`: validated findings are complete; proceed to plan.
`done`: no actionable findings and no requested summary publication; report the reviewed SHA, coverage and limitations locally.
`gaps`: missing or stale evidence; name exactly what fetch must retrieve.
`handoff`: transient read failure with captured evidence retained.
`blocked`: decision-critical evidence cannot be obtained safely.

## Required response

# Completed
<reviewed base/head, complete findings ledger or No actionable findings., verification coverage and limitations>

# Remaining
<exact missing evidence/work, or None.>
