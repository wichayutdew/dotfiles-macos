# Troubleshooting

## "working trees containing submodules cannot be moved or removed"

**Cause**: The repo has submodules. Plain `git worktree remove` refuses to proceed.

**Fix**: use `--force`:

```bash
git worktree remove --force <path>
```

Safe. Only bypasses the submodule check, not data protection.

## "fatal: '<branch>' is already checked out at '<path>'"

**Cause**: Git does not allow the same branch in two worktrees simultaneously.

**Fix**: any of:

- Remove the existing worktree holding that branch
- Create a new branch instead: `git worktree add -b <new-branch> <path> <start-point>`
- Detach `HEAD` in the other worktree: `git checkout --detach`

## Stale entries in `git worktree list`

**Cause**: A worktree directory was deleted manually instead of via `git worktree remove`.

**Fix**:

```bash
git worktree prune
```

## `.worktrees/` showing in `git status`

**Cause**: `.worktrees/` is not ignored.

**Fix**: verify with `git check-ignore -q .worktrees/x` (a fake subpath, so the probe works whether or not `.worktrees/` exists on disk). If non-zero, append to `.gitignore` and commit:

```bash
echo '.worktrees/' >> .gitignore
git add .gitignore
git commit -m "chore: ignore .worktrees directory"
```

## Worktree not picking up changes from main repo

**Cause**: Worktrees share the same `.git` directory. Branches and commits are shared, but each working tree and index is independent.

**Note**: This is expected. To pull in changes from another branch, use `git merge` or `git rebase` from inside the worktree.
