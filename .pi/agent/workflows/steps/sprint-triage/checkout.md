Create the knowledge-base worktree. Mechanical only.

Input: `{{workflow.input}}`
Approved plan: `{{reviewed.artifact}}`

Read `~/.pi/agent/workflows/steps/sprint-triage/sprint-triage.yaml`. Dates must be `YYYY-MM-DD YYYY-MM-DD`. Create a linked worktree and add `docs/sprint-triage-<start>-to-<end>`. Missing content dir or index is fine.

`ready`: `workspace: {cwd: "<worktree-path>"}`.
`handoff`: transient mechanical worktree work remains and requires no user input.
`blocked`: bad dates, missing repository information, or an unsafe Git state requiring user input; put the question in `remaining`.
