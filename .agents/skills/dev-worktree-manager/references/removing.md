# Removing Worktrees

## Basic removal

```bash
git worktree remove <path>
```

Removes the worktree directory and unregisters it from git.

## Force removal (recommended default)

```bash
git worktree remove --force <path>
```

Always use `--force`. Repos with submodules will fail without it. The flag bypasses the submodule safety check, not data protection.

## Pruning stale references

```bash
git worktree prune
```

Cleans up worktree metadata for directories deleted manually (e.g., `rm -rf` instead of `git worktree remove`). No-op if nothing is stale. Always run after removal.

## Step-by-step process for agents

1. Run `git worktree list` to show existing worktrees.
2. Use `AskUserQuestion` to confirm which worktree to remove.
3. Remove using the path from the list:

   ```bash
   git worktree remove --force <worktree-path>
   ```

4. Prune stale references:

   ```bash
   git worktree prune
   ```

5. If the worktree was inside `.worktrees/` and the directory is now empty, clean it up:

   ```bash
   rmdir .worktrees 2>/dev/null
   ```

6. Confirm removal to the user.

## Notes

- The branch is not deleted when the worktree is removed. Delete it separately with `git branch -d <branch>` if no longer needed.
- Never hardcode paths. Always read from `git worktree list`.
