# Stage: fetch

Use the invoking request and complete source evidence, inline or through the evidence references defined in SKILL.md.

---

Recover the preceding `act-mkt-work` task record and its published review identities from this same session per [Task workspace](../generic/task-workspace.md), then fetch the current GitHub PR(s) or GitLab MR(s). Read-only; use `glab`/`gh` per [Host CLI](../generic/host-cli.md).

Input: `the invoking request and inherited work task checkpoint`

Read the canonical `<root>/.task-context.json` and retain its absolute path, the inherited absolute task root, repository manifest, branches/heads, dirty baselines, cleanup ledger and publication IDs. The current launch directory may be unrelated or non-Git; it does not select a review or a replacement workspace. Use explicit Jira/Linear references with the named tracker connector when needed for full requirements or linked-review resolution; preserve direct input unchanged. Resolve ambiguity against the inherited publication readback instead of guessing a PR/MR.

For each implicated review, retrieve canonical URL, host/repository/number, source and target repository/origin identities (including forks), open/merged/closed state, source/target branches and SHAs, inherited local origin/status, changed files/diff, checks and all relevant discussion pages. Include replies and general comments explicitly targeted by the user, with IDs, author, timestamp, anchors, resolution state and original text. Preserve prior reply IDs and delivery state from the checkpoint. A closed/merged review retires only that review’s code-delivery actions; retain evidence for its local report and continue independent active reviews.

Return factual source evidence in source order; planning owns verdicts. Retrieve missing pages/chunks instead of treating a truncated preview as complete. An unresolved flag alone does not establish that a comment still needs a reply.

`ready`: complete current evidence.
`handoff`: transient retrieval failure; retain fetched pages and remaining cursors.
`blocked`: identity, access or decision-critical evidence cannot be obtained safely.

## Required response

# Completed
<updated canonical task-context path, inherited workspace/repositories/manifest/cleanup ledger and completed action IDs; complete evidence or full-content references, per-review source/target/head/state, comment and reply identities, retrieval metadata>

# Remaining
<exact missing retrieval work, or None.>
