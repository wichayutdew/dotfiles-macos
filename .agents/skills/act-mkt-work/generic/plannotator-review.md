# Plannotator review procedure

Read the latest canonical artifact and preserve user edits. Save its complete current content as Markdown, retain the reviewed version and approval purpose in the task record, and present any known decisions with the exact actions being authorized. Use a configured review location; otherwise use `~/repositories/personal/plans/plannotator/` for the local review copy. Record the pending decision and continuation state, and state the exact actions approval would authorize.

Submit the artifact to Plannotator Inbox as an attachment with a `:::question` requesting explicit approval or feedback. Notify the user with the review reference and end the turn; do not poll, wait for the decision, launch a blocking CLI session, or open duplicate reviews. If Inbox is unavailable, report the blocker and provide the artifact path. Honor an explicit user choice of another review interface.

On a later response, reconcile the same artifact and review record. Explicit approval of the current artifact and scoped actions permits the next stage; carry approval notes forward without routine reconfirmation. On feedback, revise the same artifact, validate it, submit the revised version for review, notify the user, and end that turn. Dismissal, silence, elapsed time, a submission acknowledgment, failure, or approval of a materially different version is not approval. Reuse valid explicit approval without reopening the gate.

## Approval purpose and next stage

Approval authorizes the scoped implementation, validation and publication actions explicitly listed in the work plan. Continue to workspace preparation or the recorded approved stage, then complete the authorized lifecycle. It does not authorize unrelated external changes, merging, releases or deployment.
