Implement the approved plan in the bound worktree.

Request: `{{workflow.input}}`
Approved plan: `{{reviewed.artifact}}`
Feedback: `{{reviewed.feedback}}`
Ledger: `{{last.summary}}`

Stay in `repositories[0].cwd`. Run only `worker` commands. Use TDD only for tests listed with an assessable benefit. Do not add tests to justify extra code. Leave pre-existing dirty files alone. Do not push, open reviews, or mutate Jira.

Work in bounded passes. At the start of each pass, inspect the bound worktree, approved plan, original request, and previous handoff. Select and complete at least one smallest coherent feature directly supported by the approved plan or request. Commit and test it before returning. Record the completed feature, commit, changed files, verification, and exact remaining approved work in the `completed` and `remaining` items only.

A parent recovery `handoff` is unconfirmed context, not evidence of completed work. Reconcile the bound worktree, approved plan, request, and ledger before selecting the next slice; never infer a commit, test result, or feature completion from it.

When approved work remains after the committed feature, return `handoff`; do not attempt further slices. Use `blocked` only for a real missing prerequisite, authority, or unrecoverable blocker.

`ready`: every approved implementation slice is complete, with red/green evidence and commits; use exactly `No active-step work remains.` in `remaining`.
`handoff`: red/green evidence and a commit for one coherent slice; remaining approved work is explicitly listed in `remaining`.
`blocked`: missing authority, prerequisite, or unrecoverable blocker; include the user question in `remaining`.
