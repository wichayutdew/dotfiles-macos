# Stage: publish

Use the invoking request and complete source evidence, inline or through the evidence references defined in SKILL.md.

---

Publish only approved review actions. Prefer MCP over CLI.

Input: `the invoking request`
Approved plan: `the approved plan artifact from this run`
Feedback: `approval feedback from this run`
Handoff: `{{last.summary}}`

Read the current head, review state and existing marked actions before each mutation. Reuse confirmed discussion/note/review IDs from the checkpoint. On timeout, reconcile by native ID/marker, approved body and anchor before retrying; no response does not prove no write. Unavailable/ambiguous readback leaves an unconfirmed action and prevents another write. Record each confirmation so a handoff resumes only missing actions.

If the review merged/closed, return done with confirmed and undelivered actions; stop obsolete publication without claiming those actions completed. If the source moved on an open review, return refresh to fetch/revalidate; do not alter approved text/anchors mechanically or post stale comments. An unchanged valid artifact keeps its approval; materially revised actions return to the review gate.

GitHub: reuse the matching pending/submitted review when present; otherwise create one pending review. Add only missing marked comments and submit `COMMENT` only if not already submitted. Never approve, merge, resolve, close, or delete.

GitLab: inspect current capability; when MCP lacks the required discussion mutation, use the approved `glab api` commands as `mcpFallback` and record why. Execute only the exact GitLab commands in the approved publication contract; do not derive, alter, or replace an action. Execute every `inline-comment` command as its approved Fish block using `--form="body=$body"` and the approved `--form='position[...]={value}'` arguments. Treat `-f`, `-F`, `--field`, or any other encoding for an inline discussion position as a malformed action; GitLab must receive nested multipart `position[...]` parameters. Execute a generic MR note only for an approved `generic-comment` action. After each inline command, retrieve the created discussion by its marker and verify its returned `position` is text and matches the approved path and line; `position: null is an error for an inline action`. Do not downgrade a failed or malformed inline action to a generic comment. Record the publication type, returned discussion or note ID, and any approved fallback reason.

`ready`: every approved action exists on the host, with each inline-or-approved-fallback publication recorded.
`handoff`: transient failure.
`refresh`: an open review source/state changed and requires fetch/revalidation.
`done`: review merged/closed; report actual completed/unconfirmed/undelivered actions locally without further publication.
`blocked`: identity, authority or ambiguous write state cannot be reconciled safely.
