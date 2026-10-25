# Stage: prepare-workspace

Use the invoking request and complete source evidence, inline or through the evidence references defined in SKILL.md.

---

Create or reuse the approved ticket workspace. Mechanical only.

Approved plan: `the approved plan artifact from this run`
Restart workspace: `available workspace facts`

When the plan binds an existing working context, verify its path, origin, branch, base/HEAD and relevant uncommitted state against the approved record, then reuse it in place. Preserve required prior work and unrelated edits. Record the actual root and repository paths; do not create another workspace merely to fit the default layout. On continuation, revalidate that same binding before resuming. The helper route below applies to new or already helper-managed ticket layouts.

Use `publication.sourceBranch` at `repositories[0].baseHead`. Branch is `<type>/<KEY>` or `<type>/<semantic-kebab-summary>`. Never append the run id.

Create or reuse the whole ticket layout with one call. It makes `~/repositories/worktrees/<workId>/<repo-name>` a worktree of `primaryCheckout` on `sourceBranch` (a direct clone when `primaryCheckout` is null), syncs each read-only reference repo via [`repo-sync.sh`](../scripts/repo-sync.sh), and prints `{root, repositories:[{name, role, cwd, head, branch}]}`:

    bash scripts/ticket-workspace.sh <workId> <origin> <baseBranch> <baseHead> <sourceBranch> [--primary-checkout <primaryCheckout>] [--ref <origin>#<rev>]...

Exit `3` (path exists as something else, origin or branch mismatch, branch checked out in another worktree) → `blocked`; never remove or overwrite that path. Create nothing directly under `~/repositories/worktrees/` other than the `<workId>/` folder.

For a helper-managed layout on restart, run the same command with `--check` (creates nothing): exit `0` rebinds, `3` → `blocked`, `10` (baseHead no longer an ancestor of HEAD) → `gaps`. Compare the printed heads and primary `dirty` count with the checkpoint's dirty baseline. Our recorded implementation commits after baseHead are expected progress, not an automatic reason to replan. If external source/base movement invalidates assumptions, return `gaps` before editing; refresh the plan and approval as needed. Preserve unrelated work and never reset/stash it to make the workspace fit.

`ready`: bound `workspace.root` and every `repositories[i].cwd` plus manifest.
`gaps`: external movement or missing evidence invalidates the approved workspace/base assumptions.
`handoff`: transient mechanical workspace work remains and requires no user input.
`blocked`: the workspace state is unsafe or cannot be repaired within the approved plan. Report the observed state and exact blocker in `remaining`; do not ask a question, wait for input, or mutate around the safety check.


## Required ready response
Put `workspace.workId`/`workIdSource`/`root`, and per repository: name, role, cwd, origin, primaryCheckout (primary), source/base branch, base HEAD or rev, current HEAD, and verbatim dirty baseline in `Completed`.

# Completed
<complete workspace manifest>

# Remaining
<exact remaining work, or None.>
