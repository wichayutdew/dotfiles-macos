# Stage: verify

## Pi profile

- Role: `reviewer`
- Model: `gateway/grok-4.6`
- Thinking: `high`

The Pi adapter supplies the invoking request and previous stage artifact automatically. In a portable session, use the active conversation request and prior artifacts.

---

Check the local work against each approved verdict and the reviewer's intent. Read-only.

Input: `the invoking request`
Approved plan: `the approved plan artifact from this run`
Ledger: `{{last.summary}}`

Reconcile every approved verdict, scoped path, `discussionId`, and `publication.replies` entry against the bound worktree and approved artifact.

`ready`: verdicts and checks hold; include the complete approved publication contract plus current branch, HEAD, changed paths, uncommitted local-change status, and outstanding delivery operations. Do not require a commit, push, or posted reply before `deliver`.
`gaps`: return to implement when an implementation verdict has no scoped change, local changes exceed approved scoped paths, a local check fails, or any verdict has no reply in the approved `publication.replies` contract. State the exact gap. Commit, non-force push, and reply execution are `deliver` responsibilities, not verification gaps.
`handoff`: transient read-only failure.
`blocked`: corrupted workspace.


## Required ready response
Put the complete verification ledger and approved `publication` object in `Completed`. `publication.replies` must contain exactly one reply for every verdict, including declines.

# Completed
<complete verified actions and checks>

# Remaining
- None.
