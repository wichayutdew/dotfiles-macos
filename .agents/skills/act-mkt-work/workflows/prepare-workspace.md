# Stage: prepare-workspace

Use the invoking request, approved plan and complete source references carried in the task record.

Create or rebind all approved repository worktrees using [task workspace](../generic/task-workspace.md). Mechanical only: do not infer additional repositories or change approved bases.

For a new task, use the captured `workspace.launchDirectory`, ticket-ID-or-summary `workId` and absolute root from the approved manifest. Run with an absolute helper path so changing into the skill directory cannot change the task location:

```bash
python3 /absolute/skill/scripts/task-workspace.py /absolute/approved-workspace.json
```

Each `primary` or `editable` entry becomes a linked branch worktree at its recorded cwd. A verified local checkout supplies Git storage without switching it; missing clones are acquired under `<root>/.sources/<name>`. References remain read-only at pinned revisions. Register newly created backing clones and worktrees with the shipped cleanup helper. Keep partial resources and their ledger on failure; do not delete them or overwrite conflicts to retry.

For an explicitly approved existing context, validate actual paths, origins, branches, base/HEAD and relevant prior edits manually and retain them in place; do not force a different layout. Preserve dirty dependency work, and do not silently replace it with the clean remote base.

On continuation of a helper-managed task, run the same manifest with `--check`: no creation, checkout, fetch, ledger registration or state update. Check every repository against its branch/base or pinned reference SHA and the recorded dirty baseline. Our verified local commits after the base are expected progress; external movement that invalidates assumptions returns `gaps`. Origin, path, branch-in-use or unsafe ownership conflicts return `blocked`; never reset/stash or steal a branch checked out elsewhere.

Persist the prepared manifest, cleanup ledger and source evidence references in `<root>/.task-context.json`; carry that absolute path in the session. Keep it updated through implementation and publication so the later comment workflow can locate this exact workspace.

`ready`: all approved repository paths are safely bound and recorded.
`gaps`: missing evidence or external changes invalidate the approved assumptions.
`handoff`: transient mechanical preparation remains; preserve completed resources and exact remaining entries.
`blocked`: unsafe path, origin, branch, ownership or unresolvable revision; report the factual conflict.

## Required ready response

# Completed
<workspace.launchDirectory/workId/workIdSource/root, context-artifact path, cleanup ledger, and per-repository name/role/cwd/origin/backing checkout/base branch/base SHA/source branch/current HEAD/verbatim dirty baseline; retained existing-context exceptions and full source references>

# Remaining
<exact remaining work, or None.>
