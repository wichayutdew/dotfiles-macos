---
name: dev-glab
description: Use the glab CLI to interact with GitLab. Use when working with merge requests, issues, CI/CD pipelines, repository operations, or making raw GitLab API calls. Covers all glab subcommands beyond MR creation (for MR creation in this project, prefer the dev-create-merge-request skill).
---

# glab CLI

```bash
glab auth status          # verify auth
glab mr list -F json      # most commands support -F json
glab api projects/:id     # :id auto-resolves current project from git remote
```

## Auth

```bash
glab auth status   # shows hostname, logged-in username, token scopes
```

## Merge Requests

### Create

```bash
glab mr create \
  --title "feat: add feature X" \
  --source-branch feat/my-branch \
  --target-branch master \
  --description "$(cat /tmp/mr_description.txt)" \
  --label "backend" --assignee username --reviewer username \
  --draft --remove-source-branch --squash-before-merge --yes
```

Never use `--fill` - it discards the project MR template.

### List / View

```bash
glab mr list                         # open MRs
glab mr list --merged --author @me --per-page 100
glab mr list --reviewer @me --label "backend" -F json
glab mr view <iid>                   # summary
glab mr view <iid> --comments        # with discussion
glab mr view <iid> -F json           # full JSON
glab mr view --web                   # open in browser
```

### Update

```bash
glab mr update <iid> --title "new title"
glab mr update <iid> --description "$(cat /tmp/desc.txt)"
glab mr update <iid> --label "needs-review" --assignee user --reviewer user
glab mr update <iid> --milestone "Q2-S1"
glab mr update <iid> --draft         # convert to draft
glab mr update <iid> --ready         # mark ready (remove draft)
```

### Approve / Merge / Close

```bash
glab mr approve <iid>
glab mr revoke <iid>
glab mr merge <iid> --squash --remove-source-branch
glab mr merge <iid> --when-pipeline-succeeds
glab mr close <iid>
glab mr reopen <iid>
```

### Checkout / Diff / Note

```bash
glab mr checkout <iid>
glab mr diff <iid>
glab mr note <iid> --message "LGTM"
```

## Issues

For issue create/list/update/close/labels, see `references/issue-commands.md`.

## Pipelines

```bash
glab ci list                             # default branch
glab ci list --ref feat/x --status failed -F json
glab ci view --pipelineid <pipeline-id>  # jobs grouped by stage
glab ci view                             # latest on current branch
glab ci run --branch feat/x --variables "KEY:val,K2:v2"
glab ci cancel pipeline <pipeline-id>
glab api "projects/:id/pipelines/<pipeline-id>/retry" -X POST
glab ci status                           # latest pipeline status
glab ci status --live                    # poll until finished
```

## Jobs

```bash
glab ci view                             # interactive job view for current branch
glab api "projects/:id/pipelines/<pipeline-id>/jobs?per_page=100" -F json
glab ci trace <job-id>                   # stream job logs
glab ci retry <job-id>
glab ci cancel job <job-id>
glab ci trigger <job-id>                 # trigger manual job
glab job artifact <ref> <job-name>               # download artifacts
glab job artifact <ref> <job-name> --path "path/to/file"
```

## CI/CD Variables

```bash
glab variable list
glab variable get MY_VAR
glab variable set MY_VAR "value" --masked --protected
glab variable set MY_VAR "value" --type file --scope develop
glab variable delete MY_VAR
```

## JSON Extraction

Always use `python3` - never `grep | cut | sed` on JSON output.

```bash
# Extract from list commands
glab mr list -F json | python3 -c "
import sys, json
for mr in json.load(sys.stdin):
    print(mr['iid'], mr['title'])
"

# Extract nested fields
glab mr view <iid> -F json | python3 -c "
import sys, json; mr = json.load(sys.stdin)
print('assignees:', [a['username'] for a in mr.get('assignees', [])])
print('reviewers:', [r['username'] for r in mr.get('reviewers', [])])
"

# Get latest pipeline ID for a branch
glab ci list --ref feat/x -F json | python3 -c \
  "import sys, json; print(json.load(sys.stdin)[0]['id'])"

# Retry all failed jobs in a pipeline
glab api "projects/:id/pipelines/<id>/jobs?per_page=100" | python3 -c "
import sys, json, subprocess
for job in json.load(sys.stdin):
    if job['status'] == 'failed':
        subprocess.run(['glab', 'ci', 'retry', str(job['id'])])
"
```

## Gotchas

- In worktrees, always pass `--source-branch` and `--target-branch` to `glab mr create` - glab can misdetect the active branch.
- `glab api` uses `:id` (not a literal value) to auto-resolve the current project ID. Only works inside a git repo directory.
- `--paginate` is only valid on `glab api` calls. For `glab mr list` / `glab issue list`, use `--per-page 100`.
- JSON from `glab mr list -F json` is a flat array; `glab api` responses may differ in structure.
- Never use `grep -o | cut | sed` to extract values from JSON - use `python3` with `json.load`.
- `glab pipeline` is an alias for `glab ci`. Prefer `glab ci` for clarity.
- `glab ci list` lists pipelines, not jobs. To list jobs for a specific pipeline use `glab api "projects/:id/pipelines/<id>/jobs"`.
- `glab ci cancel` requires a subcommand: `glab ci cancel job <id>` or `glab ci cancel pipeline <id>`.
- `glab ci artifact` is deprecated. Use `glab job artifact <ref> <jobName>`.

## Raw API (`glab api`)

`glab api` makes authenticated REST calls relative to `/api/v4/`. Use `:id` for the current project.

```bash
# GET (default method)
glab api "projects/:id/merge_requests?state=opened&per_page=100"

# GET all pages - --paginate concatenates into one JSON array
glab api "projects/:id/merge_requests?state=opened&per_page=100" --paginate

# PUT with form fields
glab api "projects/:id/merge_requests/<iid>" -X PUT \
  -f "description=$(cat /tmp/mr_desc.txt)"

# POST
glab api "projects/:id/merge_requests/<iid>/approve" -X POST

# DELETE
glab api "projects/:id/repository/branches/feat%2Fold-branch" -X DELETE
```

For more endpoints, see `references/api-commands.md`.

## References

- `references/issue-commands.md` - issue create, list, update, close, labels
- `references/api-commands.md` - full `glab api` endpoint catalog
