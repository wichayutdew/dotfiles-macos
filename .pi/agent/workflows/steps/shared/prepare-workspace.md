Create or reuse the approved worktree and branch. Mechanical only.

Approved plan: `{{reviewed.artifact}}`
Restart workspace: `{{restart.workspace}}`

Use `publication.sourceBranch` at `repositories[0].baseHead`. Branch is `<type>/<JIRA-KEY>` or `<type>/<semantic-kebab-summary>`. Never append the run id.

On restart, rebind that exact worktree and branch. Preserve unrelated work. If source HEAD moved past `baseHead`, return `gaps` with no mutation.

`ready`: bound `workspace.cwd` plus manifest.
`gaps`: source HEAD moved beyond the approved base and the plan must be refreshed.
`handoff`: transient mechanical workspace work remains and requires no user input.
`blocked`: the workspace state is unsafe and requires user input; put the question in `remaining`.


## Required ready response
Put cwd, repository/origin, source branch, base branch, base HEAD, current HEAD, and verbatim dirty baseline in `Completed`.

# Completed
<complete workspace manifest>

# Remaining
<exact remaining work, or None.>
