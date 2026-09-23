---
name: dev-worktree-manager
description: "Git worktree management with safe defaults and consistent placement. Use when the user asks to (1) create a new worktree or work on multiple branches in parallel, (2) list existing worktrees, (3) remove or clean up worktrees, or any other git worktree operation."
---

# Worktree Manager

Manage git worktrees with consistent conventions and automatic housekeeping.

## Agent behavior contract

1. Always use `--force` when removing worktrees. Repos with submodules will fail without it.
2. Always run `git worktree prune` after removing a worktree to clean up stale references.
3. Default placement is `.worktrees/<name>` (subfolder). Verify the directory is git-ignored before creating the first one.
4. Verify ignore status with `git check-ignore -q .worktrees/x` (a fake subpath), not by grepping `.gitignore`. This respects local, global, and system gitignore. Probing the bare directory name returns "not ignored" when the directory does not yet exist on disk, which would cause duplicate `.gitignore` appends.
5. Never hardcode worktree paths in remove operations. Always read from `git worktree list`.
6. Default the worktree folder name to the last segment of the branch name (e.g., `feature/auth` becomes `auth`).
7. Use `AskUserQuestion` for branch name, start point, and placement choice when not provided.

## Triage (detect action)

If the user supplied an action (`create`, `list`, `remove`), use it. Otherwise ask via `AskUserQuestion` which action they want:

- **create**: create a new worktree with a new branch
- **list**: list all current worktrees
- **remove**: remove an existing worktree

Then read the matching reference.

## Routing map

- Creating a worktree: `references/creating.md`
- Listing worktrees: `references/listing.md`
- Removing a worktree: `references/removing.md`
- Placement strategies and conventions: `references/placement.md`
- Common issues and troubleshooting: `references/troubleshooting.md`

## Common errors and next move

- `working trees containing submodules cannot be moved or removed`: use `--force` (see `references/removing.md`).
- Stale worktree references after manual deletion: run `git worktree prune` (see `references/removing.md`).
- Branch already checked out in another worktree: list worktrees, remove the conflicting one, or pick a different branch.
- `.worktrees/` showing in `git status`: add it to `.gitignore` (see `references/placement.md`).
