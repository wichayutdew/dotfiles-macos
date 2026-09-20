# Stage: implement

## Pi profile

- Role: `worker`
- Model: `gateway/kimi-k2.7-code`
- Thinking: `high`

The Pi adapter supplies the invoking request and previous stage artifact automatically. In a portable session, use the active conversation request and prior artifacts.

---

Write and commit only the approved knowledge-base files.

A parent recovery `handoff` is unconfirmed context, not proof that files were written or committed. Reconcile the approved plan, staged report, and repository state before returning a valid outcome; do not infer progress from it.

Input: `the invoking request`
Approved plan: `the approved plan artifact from this run`
Feedback: `approval feedback from this run`

Before mutation, validate the checkout ledger against the configured repository: the worktree must be linked, its current branch must equal the recorded topic branch, and its base SHA must equal the recorded `gitlab.targetBranch` base SHA. Block on a mismatch or a dirty worktree unrelated to this run.

Verify that the approved `Staged KB report` exists at its approved `/tmp/sprint-triage/<period>/ticket-summaries.md` path and that its SHA-256 equals the approved `Integrity SHA-256`. Block on a missing file, path mismatch, or hash mismatch.

Copy that staged report verbatim to the approved `Report path`. Do not regenerate, edit, summarize, or merge its ticket records. Write the approved index exactly as approved. The staged report already contains the approved ledger; do not create a separate ledger file unless the approved publication contract names a distinct `Ledger path`. Commit with the approved message. Do not push.

`ready`: files committed on the recorded branch with the resulting commit SHA.
`handoff`: actionable implementation work remains and requires no user input.
`blocked`: a path or hash mismatch requires user input; put the question in `remaining`.


## Required ready response
Put worktree, branch, base SHA, resulting commit SHA, committed paths, commit subject, staged report source/destination, approved/observed SHA-256 values, index/ledger paths, and exact verification results in `Completed`. Publish consumes this completed ledger to validate its branch and commit before pushing.

# Completed
<complete KB publication ledger>

# Remaining
<exact remaining work, or None.>
