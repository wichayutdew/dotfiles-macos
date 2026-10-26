# Stage: publish

Use the invoking request and complete source evidence, inline or through the evidence references defined in SKILL.md.

---

Push the verified branch and open or update the PR/MR with `glab`/`gh` per [Host CLI](../generic/host-cli.md). Use MCP only if the CLI is missing or unauthenticated, and record why.

Request: `the invoking request`
Approved plan: `the approved plan artifact from this run`

First reconcile workspace, current remote SHA, existing PR/MR state and completed actions. On a timeout, read remote state before retrying a push/create/update; reuse the existing branch/review and record returned IDs. Do not repeat an ambiguous mutation until its state is established. External movement on an open review returns refresh without overwriting contributor commits. A merged/closed review stops obsolete delivery for that entry with an accurate completed/unconfirmed/remaining report; continue other independent authorized entries and return `done` only when no active delivery remains. Do not claim undelivered actions completed.

A local-only/no-commit/no-publication contract skips prohibited actions and returns the verified local result.

Process only authorized `publication.repositories[]` entries, serializing remote writes. Bind each entry to its approved repository cwd, source origin/branch, target origin/branch and expected head; derive host/project from verified identity. Apply the following delivery steps independently to each entry and retain per-repository action/CI state. Never push from `role: reference` worktrees or treat authorization for one repository as approval for another. Validate the approved Conventional Commit title first. Push only with non-force `git push --set-upstream origin <sourceBranch>`.

Resolve existing reviews against the approved source **and** target repository identities, source branch and target branch; a branch name alone is not unique across forks. Use paginated host CLI reads and inspect the full records before reuse. GitLab: query the target project’s open merge requests with `glab api --hostname <host> --paginate "projects/<target-id>/merge_requests?state=opened&source_branch=<encoded-source-branch>"` and match `source_project_id`, `target_project_id`, `source_branch` and `target_branch`. GitHub: query `gh api --hostname <host> --paginate "repos/<target-owner>/<target-repo>/pulls?state=open"` and match `head.repo.full_name`, `head.ref`, `base.repo.full_name` and `base.ref`. Ambiguous/missing source identity is a gap, not permission to select a same-named branch.

For GitHub creation, use the verified source-owner-qualified head (`<source-owner>:<sourceBranch>`) with the approved target repository/base; never use an unqualified branch for a fork. For GitLab creation, address the source project and explicitly bind the target project for a fork. Verify available CLI flags before use; when shorthand cannot express both identities, use the host CLI API with an approved JSON request file (`gh api --method POST ... --input <request.json>` or `glab api --method POST ... --input <request.json>`), retaining all source/target fields. Do not guess a target or branch. Keep actual multiline bodies in files. Read back the full created/reused review record with `glab api --hostname <host> projects/<target-id>/merge_requests/<iid>` or `gh api --hostname <host> repos/<target-owner>/<target-repo>/pulls/<number>` and confirm both repository identities, branches and source SHA before recording success or updating a description. If a write response is ambiguous, reconcile this same identity tuple before retrying.

New review: fill only a verified repository or host description template (local `.gitlab/merge_request_templates/*.md` or `.github/pull_request_template.md` in the current publication entry’s repository cwd). Never invent a free-form body. If no template is verified, create it with no description adjustment; read back its description and treat that exact body as the template before updating the managed region.

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

At each checkpoint and on `ready` or `done`, persist and carry `<workspace.root>/.task-context.json` with the absolute launch directory/root, full `repositories[]`, per-repository base/source/HEAD/dirty baseline, cleanup ledger, approval/source references and confirmed or unconfirmed action IDs. Record every created review in `reviews[]` with canonical URL, host/project/number, sourceOrigin/targetOrigin, sourceBranch/sourceHead, target branch and commit/push/CI/reply IDs. Hand this same record to the subsequent `act-mkt-mr-comment` invocation in this session; it must reuse these paths rather than create another directory. Retain resources for review and report the context artifact and cleanup ledger paths. If the user requests cleanup, follow [Workspace cleanup](../generic/cleanup.md) and run the shipped helper to remove all tracked worktrees and recent clones; do not use a broad `rm -rf <workspace.root>`.
