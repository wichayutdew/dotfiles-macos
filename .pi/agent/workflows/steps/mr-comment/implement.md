Apply only approved comment verdicts.

Input: `{{workflow.input}}`
Approved plan: `{{reviewed.artifact}}`
Feedback: `{{reviewed.feedback}}`
Ledger: `{{last.summary}}`

Run only `workerCommands`. Reply-only plans: no commit. Do not push or reply here.

A parent recovery `handoff` is unconfirmed context, not proof that local work or a reply is complete. Reconcile the approved verdicts, plan, and ledger before returning a valid outcome; do not infer progress from it.

`ready`: local work is complete and includes the required remote-action data.
`handoff`: transient tool failure.
`blocked`: an unapproved command is required.


## Required ready response
Put workspace, starting/ending HEAD, commits and subjects, changed paths, exact commands/outcomes, and complete `remoteActions` (or `[]`) in `Completed`.

# Completed
<complete implementation ledger>

# Remaining
<exact remaining work, or None.>
