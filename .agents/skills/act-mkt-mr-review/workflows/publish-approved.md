# Stage: publish

Use the invoking request and complete source evidence, inline or through the evidence references defined in SKILL.md.

---

Do not wait for CI before publishing approved comments. Validate current head/state and comment anchors; pipeline status is not a publication prerequisite.

Publish only approved review actions, with `glab`/`gh` per [Host CLI](../generic/host-cli.md).

Input: `the invoking request`
Approved plan: `the approved plan artifact from this run`
Feedback: `approval feedback from this run`
Handoff: `{{last.summary}}`

Read the current head, review state and existing marked actions before each mutation. Reuse confirmed discussion/note/review IDs from the checkpoint. On timeout, reconcile by native ID/marker, approved body and anchor before retrying; no response does not prove no write. Unavailable/ambiguous readback leaves an unconfirmed action and prevents another write. Record each confirmation so a handoff resumes only missing actions.

If the review merged/closed, return done with confirmed and undelivered actions; stop obsolete publication without claiming those actions completed. If the source moved on an open review, return refresh to fetch/revalidate; do not alter approved text/anchors mechanically or post stale comments. An unchanged valid artifact keeps its approval; materially revised actions return to the review gate.

Run `bash scripts/publish-review.sh <approved actions.json>`. It checks current head and state (exit `10` → `refresh`, `11` → `done`) and reconciles every marker before writing. An existing action is confirmed only when its full approved body, comment type and anchor match uniquely. GitLab inline anchors include all three diff refs, both paths, side and line; GitHub inline anchors include the approved commit, path, side and current line. A conflicting or duplicate marker returns a non-success ledger (exit `3`) and blocks all writes, including in `--dry-run`.

Before a GitHub inline write, the script refreshes the review and all existing actions, then posts all still-missing inline comments in one `COMMENT` review. It reads back every inline action exactly before any generic issue comment. GitLab posts each missing inline action to `/discussions` with a JSON `position` or each approved generic action to `/notes`, rechecking the review and reading back after each write. A failed CLI response still requires readback because the host may have accepted the post. Missing or unavailable readback stops further writes (exit `1`); no inline action becomes a generic comment. Never approve, merge, resolve, close, or delete.

Do not edit the approved `actions.json` or post anything outside it; a changed action returns to the review gate. Treat `conflict`, `not-found-after-post`, `readback-unavailable` and `skipped-after-failure` ledger entries as unconfirmed. Record the script's ledger (type, discussion/note/comment ID, status) and any approved `generic-comment` reason in the checkpoint.

`ready`: every approved action exists on the host, with each inline-or-approved-fallback publication recorded.
`handoff`: transient failure.
`refresh`: an open review source/state changed and requires fetch/revalidation.
`done`: review merged/closed; report actual completed/unconfirmed/undelivered actions locally without further publication.
`blocked`: identity, authority or ambiguous write state cannot be reconciled safely.
