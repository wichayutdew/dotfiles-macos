Check the local work against each approved verdict and the reviewer's intent. Read-only.

Input: `{{workflow.input}}`
Approved plan: `{{reviewed.artifact}}`
Ledger: `{{last.summary}}`

Reconcile every approved verdict, scoped path, `discussionId`, and `publication.replies` entry against the bound worktree and approved artifact.

`ready`: verdicts and checks hold; include the complete approved publication contract plus current branch, HEAD, changed paths, commit status, and outstanding delivery operations.
`gaps`: return to implement when an implementation verdict has no scoped change, approved scoped changes are uncommitted without the approved commit subject, any verdict has no reply for its `discussionId`, or an implementation verdict lacks the required non-force push. State the exact gap.
`handoff`: transient read-only failure.
`blocked`: corrupted workspace.


## Required ready response
Put the complete verification ledger and approved `publication` object in `Completed`. `publication.replies` must contain exactly one reply for every verdict, including declines.

# Completed
<complete verified actions and checks>

# Remaining
- None.
