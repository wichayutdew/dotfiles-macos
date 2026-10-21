# Stage: implement

Use the invoking request and complete source evidence, inline or through the evidence references defined in SKILL.md.

---

Implement the approved plan in the bound worktree.

Request: `the invoking request`
Approved plan: `the approved plan artifact from this run`
Feedback: `approval feedback from this run`
Ledger: `{{last.summary}}`

Stay in `repositories[0].cwd`. Run approved local worker commands; the field names describe the artifact, not a required runtime. Use TDD only for tests listed with an assessable benefit. Do not add tests to justify extra code. Leave pre-existing dirty files alone. Do not push, open reviews, or mutate tracker records. Reuse established clients/helpers/query paths and keep additions minimal. Honor local-only/no-commit requests; disposable live-smoke helpers and credentials must never be staged. Remove disposable artifacts after use and verify status without disturbing existing edits.

Work in bounded passes. At the start of each pass, inspect the bound worktree, approved plan, original request, and previous handoff. Select and complete at least one smallest coherent feature directly supported by the approved plan or request. Test it before returning; commit only when the approved contract authorizes it. Record the completed feature, commit or explicit uncommitted status, changed files, verification and exact remaining approved work.

A parent recovery `handoff` is unconfirmed context, not evidence of completed work. Reconcile the bound worktree, approved plan, request, and ledger before selecting the next slice; never infer a commit, test result, or feature completion from it.

When approved work remains after that feature, return `handoff`; do not attempt further slices. Use `blocked` only for a real missing prerequisite, authority, or unrecoverable blocker.

`ready`: every approved implementation slice is complete, with meaningful test evidence and authorized commits or explicit uncommitted status; use exactly `No active-step work remains.` in `remaining`.
`handoff`: one coherent slice is verified and remaining approved work is listed; the route resumes automatically.
`refresh`: required scope, commands or assumptions changed; revise the plan through its gate.
`blocked`: a required prerequisite or safe authorized path is unavailable; report the factual blocker without exceeding scope.


## Required ready response
Put completed feature, authorized commit SHA/subject or uncommitted status, changed paths, meaningful test commands and outputs, and exact remaining approved work in `Completed`.

# Completed
<complete implementation ledger>

# Remaining
<exact remaining work, or None.>
