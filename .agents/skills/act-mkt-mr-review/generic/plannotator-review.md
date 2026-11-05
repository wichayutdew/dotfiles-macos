# Plannotator review procedure

Read the latest canonical artifact and preserve user edits. Save its complete current content as Markdown, retain the reviewed version and approval purpose in the task record, and present any known decisions with the exact actions being authorized. Save the local review copy under `<root>/.artifacts/`; if the user or repository instructions require another review location, use that location too and record both paths. Record the pending decision and continuation state, and state the exact actions approval would authorize.

Submit the artifact to Plannotator Inbox as an attachment with a `:::question` requesting explicit approval or feedback. Notify the user with the review reference and end the turn; do not poll, wait for the decision, launch a blocking CLI session, or open duplicate reviews. If Inbox is unavailable, report the blocker and provide the artifact path. Honor an explicit user choice of another review interface.

On a later response, reconcile the same artifact and review record. Explicit approval of the current artifact and scoped actions permits the next stage; carry approval notes forward without routine reconfirmation. On feedback, revise the same artifact, validate it, submit the revised version for review, notify the user, and end that turn. Dismissal, silence, elapsed time, a submission acknowledgment, failure, or approval of a materially different version is not approval. Reuse valid explicit approval without reopening the gate.

## Approval purpose and next stage

Approval authorizes only the exact review comments/actions in the reviewed artifact and actions ledger. Continue to approved publication, refreshing stale evidence or anchors before any mutation. With no actionable findings and no requested summary publication, finish locally without an empty approval cycle.
