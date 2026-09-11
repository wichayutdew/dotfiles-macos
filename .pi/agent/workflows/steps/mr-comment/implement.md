Apply only approved comment verdicts.

Input: `{{workflow.input}}`
Approved plan: `{{reviewed.artifact}}`
Feedback: `{{reviewed.feedback}}`
Ledger: `{{last.summary}}`

Run only approved local `workerCommands`. This step owns local file edits and local test/check execution only. Do not commit, amend, push, fetch, pull, invoke `glab`, invoke `gh`, call hosted APIs, or create/update GitLab/GitHub content. Do not stage files: `deliver` alone stages, commits, non-force-pushes, and posts replies. Reply-only plans require no local code change.

A parent recovery `handoff` is unconfirmed context, not proof that local work or a reply is complete. Reconcile the approved verdicts, plan, and ledger before returning a valid outcome; do not infer progress from it.

`ready`: all approved local work and checks are complete, no commit, push, or reply has occurred in this step, and the complete approved publication contract is preserved for `verify` and `deliver`.
`handoff`: transient tool failure.
`blocked`: an unapproved command is required.


## Required ready response
Put workspace, starting/ending HEAD, current branch, changed paths, exact local commands/outcomes, uncommitted local-change status, and the approved `publication` object verbatim in `Completed`. State explicitly that no files were staged, committed, pushed, or replied to. `publication.replies` must contain exactly one reply for every approved verdict, including declines.

# Completed
<complete implementation ledger>

# Remaining
<exact remaining work, or None.>
