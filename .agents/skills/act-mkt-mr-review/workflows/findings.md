# Stage: review

Use the invoking request and complete source evidence, inline or through the evidence references defined in SKILL.md.

---

Review the fetched change for actionable improvements, introduced regressions and performance degradation. Do not publish or edit product code.

Input: `the invoking request`
Evidence: `{{last.summary}}`

CI does not gate this stage: review the available code now and report relevant CI context without waiting for green checks. Suggestions must identify a concrete correctness, compatibility, maintainability, or performance benefit in the changed code; keep speculative/style-only preferences excluded.

## Review method

- In the local clone from fetch (`~/repositories/mr-review/<repo-name>`, detached at head), compare base and head with `git diff <base_sha>...<head_sha>` and `git show <base_sha>:<path>`. Trace changed code into callers, consumers, response models, configuration and tests with `rg` (search guidance in [Local code access](../generic/local-code-access.md)); a diff alone is insufficient. When a caller/consumer lives in another repository, sync it into `~/repositories/mr-review/<other-repo>` per [Local code access](../generic/local-code-access.md) at its default-branch HEAD, and record repo and SHA with the finding's evidence.
- Prioritize broken supported behavior, compatibility/schema drift, auth/session boundaries, stale asynchronous results, pagination/completeness, empty/error paths, and introduced security or data-loss failures. For new functionality, use its explicit contract rather than inventing prior behavior.
- Follow performance mechanisms affected by this change: per-item I/O, lost batching/concurrency/connection reuse, query/index changes, repeated rendering/refetches, blocking, cache behavior, unbounded work/memory, retry/timeout budgets and fan-out. Select relevant checks; do not perform a whole-repository audit.
- Validate suspicions with a focused reproduction/test, source trace, or measured comparison. Check realistic fixtures against actual selected fields and request/response contracts; green CI alone does not disprove a defect.
- Distinguish measured degradation from a static estimate. Explain the mechanism, supported input scale and assumptions; do not invent timings. Obvious serialized I/O need not wait for a benchmark.
- Exclude naming, formatting, stylistic refactors, speculative architecture preferences, unrelated pre-existing defects and disagreement with approved product choices. Business behavior warrants a finding when it demonstrably breaks supported behavior or an explicit contract.
- Check existing discussions and current fixes. Report one finding per root cause; do not repeat an already-addressed issue or manufacture a finding to fill a quota.

## Finding contract

For every actionable finding, provide severity, changed path and tight line anchor, trigger, baseline versus changed behavior (or new-feature contract), concrete user/operational impact, evidence and a scoped correction. Set priority by demonstrated impact and plausible exposure, not preference. Keep uncertain suspicions out of publishable findings and state material verification limits separately.

`ready`: validated findings are complete; proceed to plan.
With no actionable findings, still return `ready` and pass the reviewed SHA, coverage and limitations to plan. The plan records the no-action result; it does not manufacture a comment.
`gaps`: missing or stale evidence; name exactly what fetch must retrieve.
`handoff`: transient read failure with captured evidence retained.
`blocked`: decision-critical evidence cannot be obtained safely.

## Required response

# Completed
<reviewed base/head, complete findings ledger or No actionable findings., verification coverage and limitations>

# Remaining
<exact missing evidence/work, or None.>
