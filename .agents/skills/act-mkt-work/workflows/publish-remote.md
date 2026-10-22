# Stage: publish

Use the invoking request and complete source evidence, inline or through the evidence references defined in SKILL.md.

---

Push the verified branch and open or update the PR/MR with `glab`/`gh` per [Host CLI](../generic/host-cli.md). Use MCP only if the CLI is missing or unauthenticated, and record why.

Request: `the invoking request`
Approved plan: `the approved plan artifact from this run`

First reconcile workspace, current remote SHA, existing PR/MR state and completed actions. On a timeout, read remote state before retrying a push/create/update; reuse the existing branch/review and record returned IDs. Do not repeat an ambiguous mutation until its state is established. External movement on an open review returns refresh without overwriting contributor commits. A merged/closed review returns done and stops obsolete delivery with an accurate completed/unconfirmed/remaining report; do not claim undelivered actions completed.

A local-only/no-commit/no-publication contract skips prohibited actions and returns the verified local result.

Derive host, repository, and target from the observed `origin` of `repositories[0].cwd`. Never push from `role: reference` clones. Validate the approved Conventional Commit title first. Push only with non-force `git push --set-upstream origin <sourceBranch>`.

GitLab: find an open MR with `glab api --hostname <host> "projects/<id>/merge_requests?state=opened&source_branch=<sourceBranch>"`; create with `glab mr create -R <host>/<project> -s <sourceBranch> -b <target> -t '<approved title>' -d "$(cat <body.md>)" -y`. GitHub: `gh pr list -R <host>/<owner>/<repo> --head <sourceBranch> --json number,url,state`; create with `gh pr create -R <host>/<owner>/<repo> -H <sourceBranch> -B <target> -t '<approved title>' -F <body.md>`. Read back with `glab api --hostname <host> projects/<id>/merge_requests/<iid>` / `gh pr view <n> -R … --json url,title,body,headRefOid`.

New review: fill only a verified repository or host description template (local `.gitlab/merge_request_templates/*.md` or `.github/pull_request_template.md` in `repositories[0].cwd`). Never invent a free-form body. If no template is verified, create it with no description adjustment; read back its description and treat that exact body as the template before updating the managed region.

Existing open review: title is immutable. Change only the interior of one matching pair:

<!-- ai-only-start -->
<!-- ai-only-end -->

Run `bash scripts/update-managed-region.sh <gitlab|github> <host> <project> <iid> <region.md>`: no markers → it appends one pair; mixed, duplicated, or malformed markers → exit `3` (`blocked`); merged/closed → exit `11` (`done`); it reads the description back. Never replace the whole body. Never approve, merge, or close.

After push and the permitted review update, inspect CI for the published commit as required by [verify](verify.md) with `bash scripts/ci-wait.sh <gitlab|github> <host> <project> <pushed sha> [--mr <iid>]` (polls every 90 s for up to 45 min): exit `0` → continue; `1` → `gaps` with the printed job evidence; `2` → `handoff` (rerun later for the same SHA); `10` → `refresh`. Return `handoff` while required CI is running, and return failures to the implementation/verification loop. A successful push or review creation alone does not mean the work is complete.

`ready`: authorized delivery is read back and current-source required CI passes (or explicit waivers are stated); local-only contracts report verified local work.
`gaps`: a required CI job failed or a required check is missing; return to implement with job evidence.
`refresh`: external movement on an open review invalidates delivery; reconcile the plan and its approval before further mutation.
`done`: review merged/closed; report actual delivery state locally without obsolete push/update actions.
`handoff`: required CI is running, or a transient failure prevents confirmation; resume from the existing pushed commit and review.
`blocked`: unsafe or ambiguous state.

On `ready` or `done`, retain resources for review and report the cleanup ledger path. If the user requests cleanup, follow [Workspace cleanup](../generic/cleanup.md) and run the shipped helper to remove all tracked worktrees and recent clones; do not use a broad `rm -rf <workspace.root>`.
