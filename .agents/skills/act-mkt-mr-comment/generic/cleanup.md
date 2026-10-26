# Workspace cleanup

Keep repositories available for review until the user requests cleanup. A request such as “clean everything up” authorizes deleting **all resources recorded in the cleanup ledger**, including dirty files in workflow-created clones and worktrees. Execute cleanup without another confirmation. This is a cleanup-only route: do not rerun intake, planning, or publication.

## Track creation

`repo-sync.sh` and `task-workspace.py` automatically record only resources they create, immediately after creation. Legacy `ticket-workspace.sh` in packages that include it retains the same creation-ledger contract. Register backing clones and linked worktrees separately so cleanup removes worktrees before their owned backing clones. Reused existing checkouts are never newly enrolled. For a worktree or clone created by another Git command, immediately record it with this skill's shipped helper:

```bash
python3 scripts/cleanup-workspaces.py register --kind worktree <new-worktree-path>
python3 scripts/cleanup-workspaces.py register --kind clone <new-clone-path>
```

Run only the matching command, and only for a resource just created by this workflow. Never register a pre-existing primary checkout or reusable repository merely because it was inspected. Record the ledger path with the canonical `<root>/.task-context.json` checkpoint and retain it across work-to-comment continuation; helper-owned `<root>/.task-workspace.json` is separate mechanical state. For runtime-managed worktrees, retain the runtime attachment/identity too; use its native archive/remove facility during cleanup so its application metadata stays consistent, then reconcile the ledger with the helper.

The four repository workflows share `~/.local/state/act-mkt/workspaces.json` by default, even when skills are installed separately. Set `ACT_MKT_CLEANUP_LEDGER` to an absolute path **outside the resources being deleted** for an isolated task or environment; use that same value in every worker and after resuming. `--ledger <path>` before the subcommand is an equivalent explicit override. The ledger tracks creation, not directory ages; do not sweep arbitrary recently modified directories.

## Clean everything up

From a retained skill installation, after changing the shell's working directory outside the resources being removed:

```bash
python3 scripts/cleanup-workspaces.py list
python3 scripts/cleanup-workspaces.py clean --all
python3 scripts/cleanup-workspaces.py clean --all --apply
```

The second command previews and validates; the third deletes. Use `--apply` only after the user's cleanup instruction. Ownership markers and Git identity must still match. The helper validates the whole set first, removes linked worktrees with Git before deleting their owned clones, and retains existing primary checkouts, branches, remote branches, and PRs/MRs. It refuses replaced/symlinked paths or a clone with an untracked linked/nested checkout. Report any such blocker and exact retained paths instead of claiming everything was removed. Re-running cleanup is safe after success or partial completion; missing paths are reconciled. Older untracked resources require creation evidence from the checkpoint before registration, never a broad directory deletion.
