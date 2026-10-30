# Host CLI (GitLab `glab`, GitHub `gh`)

Use the CLI for all PR/MR metadata, diffs, discussions, comments, MR/PR create/update and CI. Do not use GitLab/GitHub MCP tools; use MCP only when the needed CLI is missing or the preflight below confirms it is unauthenticated, and record why. Run commands with `bash` (scripts are bash; they do not depend on the interactive shell).

## Preflight (once per run)

- Run `glab auth status` to discover the configured GitLab endpoint and account; use `gh auth status --hostname <host>` for GitHub.
- If sandbox restrictions prevent network access or hide existing credentials, retry the read-only authentication check outside the sandbox through the execution tool's approved escalation mechanism (for example, `sandbox_permissions: "require_escalated"`). A sandbox failure alone does not establish that the user needs to log in.
- When authentication succeeds outside the sandbox, run subsequent authorized host CLI commands and required helper scripts/Git operations in that working environment. Escalation does not expand the task's scope or authorize remote writes beyond the existing publication contract.
- If escalation is denied or unavailable, report that access restriction separately from authentication failure; do not bypass it through another tool. Request login only when the accessible environment confirms missing or invalid authentication (`glab auth login --hostname <verified-host>`). Keep network failures distinct from authentication failures.
- Let the CLI use existing credentials; never extract, print, copy or persist tokens or dump the environment.
- `python3`, `jq`, `git`, `rg` must be on `PATH`.

## Addressing

- Preserve the original PR/MR URL as the review identity. When a configured CodeMaster proxy serves a different GitLab hostname, verify the requested project's path and external URL through a read-only project metadata query before using that proxy; do not infer the mapping from authentication success alone.
- Pass the verified host explicitly (`--hostname <host>` for `glab api`/`gh api`; `-R <host>/<project>` for `glab mr …`/`gh pr …`) where supported. If the CLI rejects a configured proxy's `host:port`, use its verified configured default or repository context and an explicit project API path; do not drop the port or substitute an unverified host.
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
