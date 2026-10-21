# Stage: prepare-workspace

Use the invoking request and complete source evidence, inline or through the evidence references defined in SKILL.md.

---

Create or reuse the approved worktree and branch. Mechanical only.

Approved plan: `the approved plan artifact from this run`
Restart workspace: `available workspace facts`

Use `publication.sourceBranch` at `repositories[0].baseHead`. Branch is `<type>/<KEY>` or `<type>/<semantic-kebab-summary>`. Never append the run id.

On restart, rebind the approved worktree and branch, reusing suitable runtime-managed isolation. Compare origin, branch, HEAD and dirty baseline with the checkpoint. Our recorded implementation commits after baseHead are expected progress, not an automatic reason to replan. If external source/base movement invalidates assumptions, return `gaps` before editing; refresh the plan and approval as needed. Preserve unrelated work and never reset/stash it to make the workspace fit.

`ready`: bound `workspace.cwd` plus manifest.
`gaps`: external movement or missing evidence invalidates the approved workspace/base assumptions.
`handoff`: transient mechanical workspace work remains and requires no user input.
`blocked`: the workspace state is unsafe or cannot be repaired within the approved plan. Report the observed state and exact blocker in `remaining`; do not ask a question, wait for input, or mutate around the safety check.


## Required ready response
Put cwd, repository/origin, source branch, base branch, base HEAD, current HEAD, and verbatim dirty baseline in `Completed`.

# Completed
<complete workspace manifest>

# Remaining
<exact remaining work, or None.>
