# Worktree Placement

Two placement strategies. Subfolder is the default.

## Option 1: Subfolder (default)

Worktrees live inside `.worktrees/` within the repo:

```
my-repo/
├── .worktrees/
│   ├── feature-a/
│   └── bugfix-b/
├── src/
└── ...
```

**Path**: `.worktrees/<folder-name>`

**Pros**:
- Everything in one place
- Easy to find and manage

**Cons**:
- Some IDEs may index the subfolder (usually excludable)
- Must be in `.gitignore`

### .gitignore setup

Verify with `git check-ignore` on a fake subpath (respects global and system gitignore, not just the repo's `.gitignore`). The subpath probe works whether or not `.worktrees/` exists on disk yet:

```bash
git check-ignore -q .worktrees/x
```

If the exit code is non-zero, append and stage:

```bash
echo '.worktrees/' >> .gitignore
git add .gitignore
```

## Option 2: Parent folder (sibling directory)

Worktrees live alongside the repo:

```
Developer/
├── my-repo/                    (main worktree)
├── my-repo-feature-a/          (worktree)
└── my-repo-bugfix-b/           (worktree)
```

**Path**: `../<repo-name>-<folder-name>`

Get the repo name programmatically:

```bash
basename "$(git rev-parse --show-toplevel)"
```

**Pros**:
- Full IDE isolation, each worktree is a separate project folder
- No `.gitignore` changes needed

**Cons**:
- Worktrees scattered in the parent directory
- Harder to distinguish worktrees from standalone repos

## Naming convention

Default the folder name to the last segment of the branch name:

- `feature/auth` becomes `auth`
- `feature/new-thing` becomes `new-thing`
- `bugfix/login-crash` becomes `login-crash`
