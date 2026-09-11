Check the local work against each approved verdict and the reviewer's intent. Read-only.

Input: `{{workflow.input}}`
Approved plan: `{{reviewed.artifact}}`
Ledger: `{{last.summary}}`

`ready`: verdicts and checks hold; include `remoteActions`, explicitly empty when nothing remains.
`gaps`: return to implement with the exact gap.
`handoff`: transient read-only failure.
`blocked`: corrupted workspace.


## Required ready response
Put the complete verification ledger and `remoteActions` (explicitly `[]` when empty) in `Completed`.

# Completed
<complete verified actions and checks>

# Remaining
- None.
