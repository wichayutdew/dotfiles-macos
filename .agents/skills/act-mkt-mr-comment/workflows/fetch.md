# Stage: fetch

Use the invoking request and complete source evidence, inline or through the evidence references defined in SKILL.md.

---

Fetch the current GitHub PR or GitLab MR. Read-only; use `glab`/`gh` per [Host CLI](../generic/host-cli.md).

Input: `the invoking request`

Retrieve canonical URL, host/repository/number, open/merged/closed state, source/target branches and SHAs, local origin/status, changed files/diff, checks and all relevant discussion pages. Include replies and general comments explicitly targeted by the user, with IDs, author, timestamp, anchors, resolution state and original text. Preserve prior reply IDs and delivery state from the checkpoint.

Return factual source evidence in source order; planning owns verdicts. Retrieve missing pages/chunks instead of treating a truncated preview as complete. An unresolved flag alone does not establish that a comment still needs a reply.

`ready`: complete current evidence.
`handoff`: transient retrieval failure; retain fetched pages and remaining cursors.
`blocked`: identity, access or decision-critical evidence cannot be obtained safely.

## Required response

# Completed
<complete evidence or full-content references, source/head/state, comment and reply identities, retrieval metadata>

# Remaining
<exact missing retrieval work, or None.>
