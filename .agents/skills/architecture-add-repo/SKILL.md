---
name: architecture-add-repo
description: |
  Use when adding or removing workspace repositories, checking repository status,
  updating managed checkouts, or repairing incorrectly cloned repositories.
user-invocable: true
---

# Repository Management

Use the scripts shipped with this skill. `repos.conf` owns membership;
`repo-cache/<name>.git` holds the bare Git store and `repos/<name>` is its worktree.
Never clone directly into these directories or delete them with `rm -rf`.

Run from the workspace containing `repos.conf`, or set
`ARCHITECTURE_WORKSPACE_ROOT` to its absolute path. `SKILL_ROOT` below is the
installed directory containing this `SKILL.md`. Scripts require Python 3.9 or later and Git
on Linux or macOS. They do not read or write delegation state or profile settings.

## Add a Repository

```bash
bash "${SKILL_ROOT}/scripts/add-repo.sh" <git-url> [directory-name] [branch]
```

The script creates a bare cache and worktree before registering the repository.
An existing matching worktree is preserved. Conflicting manifest rows, origins,
branches, unmanaged clones, unsafe names, and symlinked managed paths are refused.
Use HTTPS URLs without embedded credentials in the workspace manifest.

## Remove a Repository

Preserve local work first. Remove the named checkout and manifest entry with:

```bash
bash "${SKILL_ROOT}/scripts/remove-repo.sh" <directory-name>
```

The cache is retained by default. When removal of that exact cache is authorized:

```bash
bash "${SKILL_ROOT}/scripts/remove-repo.sh" <directory-name> --remove-cache
```

Removal refuses dirty or ignored files, unpushed commits, locked or stale worktrees,
hidden index flags (assume-unchanged or skip-worktree), foreign origins, and caches used by any other worktree. Cache deletion also checks
local branch, tag, stash, and note tips against freshly fetched remote history.
A fetch failure refuses removal. Resolve the reported condition and rerun the
same command; do not bypass checks with force or manual deletion. These Git
checks do not prove an agent has stopped: stop any owner and its tools before
requesting removal.

## Status, Pull, and Setup

```bash
bash "${SKILL_ROOT}/scripts/init.sh" --status
bash "${SKILL_ROOT}/scripts/init.sh" --pull
bash "${SKILL_ROOT}/scripts/init.sh"
```

Setup reads `repos.conf` and creates missing repositories. Pull refuses local
changes and uses fast-forward updates. Add `--no-check` to skip the shipped
post-pull hook. Failures return a nonzero exit code. Bulk `--clean` is disabled;
remove individually named repositories after preserving their work.

## Repair Unexpected Clones

A managed worktree has a `.git` file; a plain clone has a `.git` directory.
Check `git -C repos/<name> status --short`, its origin, branch, and unpushed work.
Preserve the unexpected clone outside managed directories before running add.
The scripts refuse to replace it automatically.

After membership changes, refresh architecture docs with
`architecture-generate-architecture-docs` in workspace mode. Refresh repository
search metadata with `python3 scripts/repo-map.py refresh` when available; it uses
live GitLab metadata. The map remains a discovery hint, never a search boundary.
