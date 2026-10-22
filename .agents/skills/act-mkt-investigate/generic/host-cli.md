# Host CLI (GitLab `glab`, GitHub `gh`)

Use the CLI for all PR/MR metadata, diffs, discussions, comments, MR/PR create/update and CI. Do not use GitLab/GitHub MCP tools; use MCP only when the needed CLI is missing or unauthenticated, and record why. Run commands with `bash` (scripts are bash; they do not depend on the interactive shell).

## Preflight (once per run)

- `glab auth status --hostname <host>` / `gh auth status --hostname <host>`. Unauthenticated → `blocked` with the login command for the user (`glab auth login --hostname <host>`); never handle tokens.
- `python3`, `jq`, `git`, `rg` must be on `PATH`.

## Addressing

- Pass the host explicitly (`--hostname <host>` for `glab api`/`gh api`; `-R <host>/<project>` for `glab mr …`/`gh pr …`) so commands work from any directory.
- GitLab API project id = URL-encoded full path: `jq -rn --arg p '<group/sub/repo>' '$p|@uri'`.
- Paginate and merge: `glab api --paginate … | jq -s add`; `gh api --paginate … | jq -s add`.

## Scripts

Paths below are relative to the skill root containing `SKILL.md`. Run stage commands from that root, not from `workflows/` or `generic/`.

| Script | Use |
| --- | --- |
| `scripts/repo-sync.sh` | clone/fetch/pin a local clone ([Local code access](local-code-access.md)) |
| `scripts/cleanup-workspaces.py` | register/list/preview/delete workflow-created resources ([Cleanup](cleanup.md)) |

Exit codes shared by the scripts: `0` ok · `1` failed check/CI · `2` still running / timeout (→ `handoff`) · `3` unsafe or ambiguous state (→ `blocked`) · `10` head moved (→ `refresh`) · `11` merged/closed (→ `done`).

## Common commands

| Need | GitLab | GitHub |
| --- | --- | --- |
| MR/PR JSON | `glab api --hostname H projects/<id>/merge_requests/<iid>` | `gh pr view <n> -R H/o/r --json …` |
| Raw diff | `glab mr diff <iid> -R H/<project> --raw` | `gh pr diff <n> -R H/o/r` |
| Find open MR for branch | `glab api --hostname H "projects/<id>/merge_requests?state=opened&source_branch=<b>"` | `gh pr list -R H/o/r --head <b> --json number,url,state` |
| Create | `glab mr create -R H/<project> -s <src> -b <target> -t '<title>' -d "$(cat <body.md>)" -y` | `gh pr create -R H/o/r -H <src> -B <target> -t '<title>' -F <body.md>` |


Read the current pipeline/check status once as context when relevant. This workflow does not wait for CI or require green checks before reviewing or publishing approved comments/reports. CI waiting belongs only to code delivery in `act-mkt-work` and `act-mkt-mr-comment`.
