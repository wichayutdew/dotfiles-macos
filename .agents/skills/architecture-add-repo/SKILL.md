---
name: architecture-add-repo
description: |
  Manage repositories in this multi-repo workspace using the bare-clone + worktree strategy.
  Use this skill whenever the user wants to add a new repo, remove a repo, check repo status,
  update repos, or clean up incorrectly cloned repositories. Also trigger when you detect a need
  to clone or add a repository to the workspace — never run raw git clone into repos/ or repo-cache/
  without this skill.
user-invocable: true
---

# Repo Management

This workspace uses **bare-clone + worktree** — not regular git clones.

```
repo-cache/<name>.git   (bare clone, shared object store)
    └── worktree →  repos/<name>   (working directory)
```

- `repos.conf` — source of truth for which repos belong
- Both `repos/` and `repo-cache/` are gitignored

**Never run `git clone` directly into `repos/` or `repo-cache/`.** Always run the scripts shipped with this skill: `bash "${SKILL_ROOT}/scripts/add-repo.sh" ...`. Do not assume the project has `./scripts/add-repo.sh` at its root.

Run from the **multi-repo workspace root** (directory containing `repos.conf`), or set `ARCHITECTURE_WORKSPACE_ROOT` to that directory when invoking the scripts.

## Add a Repo

```bash
bash "${SKILL_ROOT}/scripts/add-repo.sh" <git-url> [directory-name] [branch]
```

The repo will be added to `repos.conf` automatically. To update the workspace documentation with the new repo, run the `architecture-generate-architecture-docs` skill in workspace mode.

## Remove a Repo

```bash
git -C repo-cache/<name>.git worktree remove repos/<name>
rm -rf repo-cache/<name>.git   # optional: remove bare cache
```

Then delete the entry from `repos.conf`. To update the workspace documentation after removal, run the `architecture-generate-architecture-docs` skill in workspace mode.

## Status / Pull / Init

```bash
bash "${SKILL_ROOT}/scripts/init.sh" --status   # branch + changes per repo
bash "${SKILL_ROOT}/scripts/init.sh" --pull     # fetch + pull all
bash "${SKILL_ROOT}/scripts/init.sh"             # set up missing repos from repos.conf
bash "${SKILL_ROOT}/scripts/init.sh" --clean    # wipe and re-clone everything
```

## Clean Up Unexpected Clones

A correct repo has `.git` as a **file** (worktree pointer). A plain clone has `.git` as a **directory**.

**Detect problems:**
```bash
for dir in repos/*/; do
  name=$(basename "$dir")
  if [ -d "$dir/.git" ]; then echo "PLAIN CLONE: $name"
  elif [ -f "$dir/.git" ]; then echo "OK: $name"
  fi
done
# Also check for repos not in repos.conf
for dir in repos/*/; do
  name=$(basename "$dir")
  grep -q "^${name}\b" repos.conf 2>/dev/null || echo "UNLISTED: $name"
done
```

**Fix a plain clone:**
1. Check for uncommitted changes: `git -C repos/<name> status --short`
2. Get remote URL: `git -C repos/<name> remote get-url origin`
3. Get branch: `git -C repos/<name> branch --show-current`
4. Remove: `rm -rf repos/<name>`
5. Re-add: `bash "${SKILL_ROOT}/scripts/add-repo.sh" <url> <name> [branch]`
