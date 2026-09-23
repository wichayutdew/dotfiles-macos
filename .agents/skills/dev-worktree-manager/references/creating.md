# Creating Worktrees

## With a new branch (most common)

```bash
git worktree add -b <branch-name> <path> <start-point>
```

- `-b <branch-name>`: new branch to create (e.g., `feature/my-thing`)
- `<path>`: where the worktree lives on disk (e.g., `.worktrees/my-thing`)
- `<start-point>`: branch or commit to base it on (e.g., `main`, `develop`)

If `<start-point>` is omitted, it defaults to `HEAD`.

### Example

```bash
git worktree add -b feature/auth .worktrees/auth main
```

Creates branch `feature/auth` off `main`, checked out at `.worktrees/auth`.

## With an existing branch

```bash
git worktree add <path> <branch>
```

### Example

```bash
git worktree add .worktrees/bugfix feature/existing-branch
```

## Step-by-step process for agents

1. Use `AskUserQuestion` to gather missing inputs:
   - **Branch name**: the new branch to create
   - **Worktree folder name**: defaults to the last segment of the branch name
   - **Start point**: branch to base it on (default: the repo's main/default branch)
   - **Placement**: subfolder (default) or parent folder (see `placement.md`)

2. For subfolder placement, verify `.worktrees/` is git-ignored before creating. Probe a fake subpath so the check works regardless of whether the directory exists on disk yet:

   ```bash
   git check-ignore -q .worktrees/x
   ```

   If the command exits non-zero, append `.worktrees/` to `.gitignore` and stage it:

   ```bash
   echo '.worktrees/' >> .gitignore
   git add .gitignore
   ```

   Surface this change to the user before committing it.

3. Create the worktree:
   - Subfolder: `git worktree add -b <branch-name> .worktrees/<folder-name> <start-point>`
   - Parent folder: `git worktree add -b <branch-name> ../<repo-name>-<folder-name> <start-point>`

4. Confirm success and report the full path.

## Notes

- `git worktree add` creates intermediate directories automatically.
- The same branch cannot be checked out in two worktrees at once.
- Being explicit with the start point is safer than relying on `HEAD`.
