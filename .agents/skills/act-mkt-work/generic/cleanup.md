# Workspace cleanup

Keep repositories available for review until the user requests cleanup. A request such as “clean everything up” authorizes deleting **all resources recorded in the cleanup ledger**, including dirty files in workflow-created clones and worktrees. Execute cleanup without another confirmation. This is a cleanup-only route: do not rerun intake, planning, or publication.

## Track creation

`task-workspace.py`, `repo-sync.sh` and the legacy `ticket-workspace.sh` automatically record only resources they create, immediately after creation. Track newly acquired `.sources` backing clones and linked worktrees separately; cleanup removes linked worktrees before their backing clones. Reused existing checkouts are never newly enrolled. For a worktree or clone created by another Git command, immediately record it with this skill's shipped helper:

```bash
python3 scripts/cleanup-workspaces.py register --kind worktree <new-worktree-path>
python3 scripts/cleanup-workspaces.py register --kind clone <new-clone-path>
```

Run only the matching command, and only for a resource just created by this workflow. Never register a pre-existing primary checkout or reusable repository merely because it was inspected. Record the ledger path with the workspace checkpoint. For runtime-managed worktrees, retain the runtime attachment/identity too; use its native archive/remove facility during cleanup so its application metadata stays consistent, then reconcile the ledger with the helper.

New tasks use `<root>/.artifacts/cleanup-ledger.json` and export `ACT_MKT_CLEANUP_LEDGER` and `ACT_MKT_REGISTER_LEDGER=1` to register that ledger in the shared index. The ledger and its lock live outside each tracked clone/worktree, within the task root. Retain inherited legacy ledger paths for existing tasks. With no ledger override, `list` and `clean --all` consult the shared index and the legacy shared ledger, validate their combined resources, and remove all tracked resources and their verified owned task roots, including artifacts and ledgers. With an explicit ledger override they operate on that ledger only; unset the task override for a global cleanup. The shared index is infrastructure, not a task artifact; do not delete it or scan arbitrary directories.

## Clean everything up

From a retained skill installation, after changing the shell's working directory outside the resources being removed:

```bash
python3 scripts/cleanup-workspaces.py list
python3 scripts/cleanup-workspaces.py clean --all
python3 scripts/cleanup-workspaces.py clean --all --apply
```

The second command previews and validates; the third deletes. Use `--apply` only after the user's cleanup instruction. Ownership markers and Git identity must still match. The helper validates the whole set first, removes linked worktrees with Git before deleting their owned clones, and retains existing primary checkouts, branches, remote branches, and PRs/MRs. It refuses replaced/symlinked paths or a clone with an untracked linked/nested checkout. Report any such blocker and exact retained paths instead of claiming everything was removed. Re-running cleanup is safe after success or partial completion; missing paths are reconciled. Older untracked resources require creation evidence from the checkpoint before registration, never a broad directory deletion.

## Remove task roots

When establishing a new empty task directory, run `python3 /absolute/skill/scripts/cleanup-workspaces.py register-root <absolute-root>` immediately. This records ownership and a task ledger even for tasks with no Git repository. After registering, use the returned ledger for all task workers. Scoped cleanup (`--ledger <task-ledger> clean --all --apply`) removes the entire verified task root; global cleanup includes all registered roots. The preview lists roots in `wouldDeleteRoots`. Index entries are removed after root deletion and interrupted cleanup is reconciled on retry. Legacy task roots are removed only when their recorded workspace identity can be verified. Unowned checkouts, unsafe paths, and ambiguous roots block deletion. External review copies remain outside the task root.
