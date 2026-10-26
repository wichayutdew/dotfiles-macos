# Local code access

Inspect code only in local Git clones searched with `rg`. Do not use Sourcegraph or any remote code-search/file-read tool (code_finder, keyword_search, nls_search, deepsearch, host "get file contents" APIs) for code. PR/MR metadata, diffs, discussions and CI come from the `glab`/`gh` CLI per [Host CLI](host-cli.md).

## Location

- `<root>` is the absolute `workspace.root` inherited from the preceding `act-mkt-work` run in this session. Its name is the ticket ID itself or a short descriptive summary, and its original default location is below that run's captured invocation directory. Keep its actual path when this skill is launched elsewhere.
- Each repository's `cwd`, origin, source branch/base/head and editable/reference role come from the [task workspace manifest](task-workspace.md). Names are unique within the root; use a namespace prefix for equal remote basenames.
- Inspect inherited worktrees in place without syncing, detaching or switching their branches. Use the helper's read-only `--check` for a helper-managed layout; validate explicitly approved custom contexts against their recorded identities directly.
- If additional read-only source evidence is required, use a dedicated inspection location such as `<root>/.inspection/`, record it and its SHA, and keep it separate from worktree paths. Do not infer a new editable repository from a reference alone; include material scope additions in plan review.

## Get or refresh: `scripts/repo-sync.sh`

```bash
bash scripts/repo-sync.sh <clone-url> <root> [<sha>|<ref>|HEAD] [--mr <iid>|--pr <n>]
```

Use this only for dedicated inspection clones, never an inherited editable worktree or its intended path. It prints `{"dir":…,"origin":…,"sha":…}` and does, in order:
1. Existing `<dir>/.git`: origin must match the expected host/project (ssh/https form ignored), else exit 3 (`blocked`; never reuse or delete). Then `git fetch --prune --filter=blob:none origin`.
2. Absent: `git clone --filter=blob:none --no-checkout <url> <dir>` (partial clone: file contents are fetched on demand).
3. Pin: `git fetch origin <sha>`; if the SHA is not advertised, `refs/merge-requests/<iid>/head` (GitLab) or `pull/<n>/head` (GitHub).
4. Clean clone (`git status --porcelain` empty): `git checkout --detach <sha>`. Dirty clone: no stash/reset; it adds `git worktree add --detach <dir>@<short-sha> <sha>` and prints that path as `dir`.

Huge repo: after the first sync, `git -C <dir> sparse-checkout set <dir1> <dir2>`. Run independent syncs in parallel.

## Search

Start with `rg --files` to discover paths, then use `rg -n` for content. Narrow early with file globs, language filters and subdirectories. Use `ast-grep` only for structural matches and `git grep` or `git log` for history. Avoid broad scans and `grep -R`.

- `rg --files <dir> | rg '<name-fragment>'`
- `rg -n '<pattern>' <dir>/<subdir>`; narrow with `-t java -t scala`, `-g '!**/generated/**'`
- Baseline without checkout: `git -C <dir> show <base_sha>:<path>`, `git -C <dir> diff <base_sha>...<head_sha> -- <path>`

## Rules

- Record every repo used as evidence: url, `dir`, searched SHA.
- Clones made for inspection are read-only: never commit, push, stash, reset or clean them.
- New clones and side worktrees made by these shipped helpers are registered in the shared cleanup ledger; explicitly register resources created through another safe facility. Keep them until the user requests cleanup; then follow [Workspace cleanup](cleanup.md). Existing reused checkouts are not enrolled.
