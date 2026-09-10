Write and commit only the approved knowledge-base files.

A parent recovery `handoff` is unconfirmed context, not proof that files were written or committed. Reconcile the approved plan, staged report, and repository state before returning a valid outcome; do not infer progress from it.

Input: `{{workflow.input}}`
Approved plan: `{{reviewed.artifact}}`
Feedback: `{{reviewed.feedback}}`

Before mutation, verify that the approved `Staged KB report` exists at its approved `/tmp/sprint-triage/<period>/ticket-summaries.md` path and that its SHA-256 equals the approved `Integrity SHA-256`. Block on a missing file, path mismatch, or hash mismatch.

Copy that staged report verbatim to the approved `Report path`. Do not regenerate, edit, summarize, or merge its ticket records. Write the approved index exactly as approved. The staged report already contains the approved ledger; do not create a separate ledger file unless the approved publication contract names a distinct `Ledger path`. Commit with the approved message. Do not push.

`ready`: files committed.
`handoff`: actionable implementation work remains and requires no user input.
`blocked`: a path or hash mismatch requires user input; put the question in `remaining`.
