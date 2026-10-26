# Listing Worktrees

## Basic list

```bash
git worktree list
```

Output shows path, commit, and branch:

```
/path/to/repo                       abc1234 [main]
/path/to/repo/.worktrees/feature-x  def5678 [feature/x]
```

## Porcelain format (for scripting)

```bash
git worktree list --porcelain
```

Machine-readable, one attribute per line:

```
worktree /path/to/repo
HEAD abc1234abc1234abc1234abc1234abc1234abc1234
branch refs/heads/main

worktree /path/to/repo/.worktrees/feature-x
HEAD def5678def5678def5678def5678def5678def5678
branch refs/heads/feature/x
```

## Step-by-step process for agents

1. Run `git worktree list`.
2. Present the output to the user in a readable format.
3. If only the main worktree is shown, tell the user no additional worktrees exist.
