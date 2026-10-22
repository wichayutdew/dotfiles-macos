# Stage: deliver

Use the invoking request and complete source evidence, inline or through the evidence references defined in SKILL.md.

---

Execute only the verified approved delivery contract. Use `glab`/`gh` per [Host CLI](../generic/host-cli.md).

Input: `the invoking request`
Approved plan: `the approved artifact and its approval evidence`
Ledger: `{{last.summary}}`

## Reconcile before each mutation

Read current review state, source SHA, workspace and existing replies. Reuse our confirmed commit/push/reply IDs. After a timeout, inspect remote state before retrying; a missing response is not proof the write failed. Match each action by native identity and approved body/marker. If readback is unavailable or ambiguous, retain the unconfirmed action and stop writes until reconciled.

If another contributor advanced the source, return `refresh` without overwriting it. If the review was externally merged/closed, stop obsolete code delivery and report completed/undelivered actions; do not post stale success replies. Newly arrived feedback is an unapproved delta for the next plan, not permission to expand this delivery.

## Code-changing delivery

1. Confirm scoped paths against the dirty baseline. Stage only authorized paths, create `publication.commitSubject` only if no compliant commit exists, and non-force-push `publication.sourceBranch` only when authorized. Read back the remote SHA.
2. Wait for required CI for that published source with `bash scripts/ci-wait.sh <gitlab|github> <host> <project> <published-sha> [--mr <iid>]`, including required downstream jobs. For a merged-result pipeline, verify its association to the current source and record both source SHA and synthetic merge-result SHA. An older green pipeline is not evidence.
3. Return `handoff` while CI runs. Return `gaps` on failing required jobs with actual job evidence; fix and rerun relevant local checks before repushing. Missing required checks are a gap; inaccessible evidence is a blocker. Explicit waivers remain limitations, never green results.
4. Once required checks pass (or an explicit user waiver permits delivery with stated limits), post only the still-missing approved replies whose claims are true. Read back each reply ID/body and final remote SHA. If the source moved, refresh rather than claiming current-head success.

Reply-only/decline-only contracts do not stage, commit, push or wait for unrelated CI. Local-only/no-commit contracts skip prohibited delivery actions and report the verified local result.

For GitHub, use the existing review-comment reply capability for inline threads; general comments use the general PR-comment capability with the approved reference. For GitLab, reply to the existing discussion, never create a replacement discussion/inline position. Use the host CLI for these replies; MCP is a fallback only when the CLI is missing or unauthenticated. Never force-push, resolve threads, approve or merge.

`ready`: every authorized operation is read back; code delivery includes matching pushed SHA and current-source required CI results/explicit waivers; each actionable reply has a confirmed ID; no unrelated paths were staged/committed.
`gaps`: local mismatch or required check fails/is missing; return evidence to implement.
`refresh`: external source movement or changed contract requires fetch/plan reconciliation.
`done`: review externally merged/closed; report the actual completed/undelivered ledger without obsolete delivery.
`handoff`: CI running, transient failure or pending readback; retain per-action state.
`blocked`: commit scope, identity, authority or remote state cannot be reconciled safely.

## Required response

# Completed
<commit/push/CI/reply IDs and readbacks, or verified local-only result; completed, unconfirmed and undelivered actions distinguished>

# Remaining
<exact pending CI/actions or blocker, or None.>
