Check the local work against each approved verdict and the reviewer's intent. Read-only.

Input: `{{workflow.input}}`
Approved plan: `{{reviewed.artifact}}`
Ledger: `{{last.summary}}`

Reconcile every approved verdict, scoped path, `discussionId`, and `publication.replies` entry against the bound worktree and approved artifact.

`ready`: verdicts and checks hold; include the complete approved publication contract plus current branch, HEAD, changed paths, commit status, and outstanding delivery operations.
`gaps`: return to implement when an implementation verdict has no scoped change, approved scoped changes are uncommitted without the approved commit subject, an accepted verdict has no reply for its `discussionId`, or an implementation verdict lacks the required non-force push. State the exact gap.
`handoff`: transient read-only failure.
`blocked`: corrupted workspace.


## Required ready response
Put the complete verification ledger and approved `publication` object in `Completed`. An empty publication list is valid only when every verdict is `decline`; never use it for an accepted implementation or reply-only verdict.

# Completed
<complete verified actions and checks>

# Remaining
- None.
