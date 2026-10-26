# Local code access

Inspect code only in local Git clones searched with `rg`. Do not use Sourcegraph or any remote code-search/file-read tool (code_finder, keyword_search, nls_search, deepsearch, host "get file contents" APIs) for code. PR/MR metadata, diffs, discussions and CI come from the `glab`/`gh` CLI per [Host CLI](host-cli.md).

## Location

- Capture the invoking cwd before any `cd`. For new work, the task root is `<launchDirectory>/<ticket-ID-or-short-summary>`; see [Task workspace](task-workspace.md). The launch repository does not establish the affected repository set.
- Use verified origins and distinct safe repository names. Discovery/backing clones go under `<task-root>/.sources/<name>`, separate from `<task-root>/<name>` branch worktrees. To use `repo-sync.sh` for discovery, pass `<task-root>/.sources` as root and `REPO_DIRNAME=<unique-name>` when names collide; record its actual returned path/SHA.
- An already bound checkout with required branch/revision or prior edits must not be synced or switched. Resume its recorded absolute path.

## Get or refresh: `scripts/repo-sync.sh`

```bash
bash scripts/repo-sync.sh <clone-url> <root> [<sha>|<ref>|HEAD] [--mr <iid>|--pr <n>]
```

It prints `{"dir":…,"origin":…,"sha":…}` and does, in order:
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
- New clones and side worktrees are automatically registered in the shared cleanup ledger. Keep them until the user requests cleanup; then follow [Workspace cleanup](cleanup.md). Existing reused checkouts are not enrolled.
