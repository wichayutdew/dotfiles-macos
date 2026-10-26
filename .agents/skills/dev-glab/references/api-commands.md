# glab api - Raw GitLab REST API Access

`glab api` is the escape hatch for anything not covered by glab's dedicated subcommands. It makes authenticated REST calls to the GitLab API.

## Syntax

```bash
glab api <endpoint> [flags]
```

The endpoint is a path relative to `/api/v4/`. Use `:id` to auto-resolve the current project's numeric ID from the git remote.

## HTTP Methods

```bash
glab api projects/:id                          # GET (default)
glab api projects/:id/merge_requests -X POST   # POST
glab api projects/:id/merge_requests/5 -X PUT  # PUT
glab api projects/:id/merge_requests/5 -X DELETE
```

## Passing Parameters

### Query params (GET)
```bash
glab api "projects/:id/merge_requests?state=opened&per_page=100"
```

### Form fields (POST/PUT) - use `-f` or `-F`
Both `-f` and `-F` pass key=value form fields. Use them for all POST/PUT parameters.
```bash
glab api projects/:id/merge_requests/5 -X PUT \
  -f "title=new title" \
  -f "description=$(cat /tmp/desc.txt)"
```

```bash
glab api projects/:id/merge_requests -X POST \
  -f "title=My MR" \
  -f "source_branch=feat/x" \
  -f "target_branch=master"
```

## Pagination

```bash
glab api "projects/:id/merge_requests" --paginate      # fetch ALL pages automatically
glab api "projects/:id/issues?per_page=100"            # up to 100 per page (manual)
```

`--paginate` concatenates all pages into a single JSON array.

## Common API Endpoints

### Project info
```bash
glab api projects/:id
glab api projects/:id | python3 -c "import sys, json; d = json.load(sys.stdin); print(d['id'], d['name'], d['web_url'])"
```

### MR template
```bash
glab api "projects/:id?fields=merge_requests_template" | \
  python3 -c "import sys, json; print(json.load(sys.stdin).get('merge_requests_template', ''))"
```

### List merge requests
```bash
glab api "projects/:id/merge_requests?state=opened&per_page=100"
```

### Get a single MR
```bash
glab api "projects/:id/merge_requests/<iid>"
```

### Update MR description
```bash
glab api "projects/:id/merge_requests/<iid>" -X PUT \
  -f "description=$(cat /tmp/mr_description.txt)"
```

### Approve MR
```bash
glab api "projects/:id/merge_requests/<iid>/approve" -X POST
```

### List pipelines for an MR
```bash
glab api "projects/:id/merge_requests/<iid>/pipelines"
```

### List jobs for a pipeline
```bash
glab api "projects/:id/pipelines/<pipeline-id>/jobs?per_page=100"
```

### Retry a pipeline
```bash
glab api "projects/:id/pipelines/<pipeline-id>/retry" -X POST
```

### Get job trace (logs)
```bash
glab api "projects/:id/jobs/<job-id>/trace"     # returns raw text, not JSON
```

### Trigger a pipeline
```bash
glab api "projects/:id/pipeline" -X POST \
  -f "ref=master" \
  -f "variables[][key]=MY_VAR" \
  -f "variables[][value]=my_value"
```

### List project members
```bash
glab api "projects/:id/members/all?per_page=100"
```

### Search users
```bash
glab api "users?search=djain&per_page=10"
```

### List project labels
```bash
glab api "projects/:id/labels?per_page=100"
```

### List milestones
```bash
glab api "projects/:id/milestones?state=active"
```

### Get commit info
```bash
glab api "projects/:id/repository/commits/<sha>"
```

### Get file content from repo
```bash
glab api "projects/:id/repository/files/path%2Fto%2Ffile.txt/raw?ref=master"
```
URL-encode the file path - `/` becomes `%2F`.

### List branches
```bash
glab api "projects/:id/repository/branches?per_page=100"
```

### Create a branch
```bash
glab api "projects/:id/repository/branches" -X POST \
  -f "branch=feat/new-branch" \
  -f "ref=master"
```

### Delete a branch
```bash
glab api "projects/:id/repository/branches/feat%2Fold-branch" -X DELETE
```

### List group projects
```bash
glab api "groups/<group-id>/projects?per_page=100" --paginate
```

---

## Extracting Values - Use python3, Not grep/cut/sed

JSON values from `glab api` can be multi-line (descriptions, templates, notes). Use `python3` for all extraction.

```bash
# Get project numeric ID
glab api projects/:id | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])"

# Get MR web URL
glab api "projects/:id/merge_requests/<iid>" | python3 -c "import sys, json; print(json.load(sys.stdin)['web_url'])"

# Extract a nested value
glab api "projects/:id/merge_requests/<iid>" | python3 -c "
import sys, json
mr = json.load(sys.stdin)
print(mr['author']['username'], mr['state'], mr['merge_status'])
"
```

---

## Notes

- `:id` only auto-resolves when run inside a git repo with an `origin` remote pointing to GitLab.
- For cross-project calls, use the full path-encoded project ID: `groups%2Fsubgroup%2Fproject-name` or look up the numeric ID with `glab api projects/:id | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])"`.
- Job trace (`/jobs/<id>/trace`) returns **plain text**, not JSON - do not pipe to `python3 -c "json.load"`.
- `--paginate` is safe to use on all list endpoints; it stops when the `X-Next-Page` header is empty.
- Rate limits apply at ~10 requests/sec for the GitLab.com API; for self-hosted instances, limits vary.
