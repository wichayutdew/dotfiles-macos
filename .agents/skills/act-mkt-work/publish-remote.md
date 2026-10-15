# Stage: publish

Use the invoking request and complete prior stage artifacts from the active conversation or their existing evidence files.

---

Push the verified branch and open or update the PR/MR. Prefer MCP over CLI.

Request: `the invoking request`
Approved plan: `the approved plan artifact from this run`

Derive host, repository, and target from observed `origin`. Validate the approved Conventional Commit title first. Push only with non-force `git push --set-upstream origin <sourceBranch>`.

Use GitHub MCP (`pull_request_read`, `create_pull_request`, `update_pull_request`) or GitLab MCP. Use `gh`/`glab` only when MCP cannot do the job, and record why.

New review: fill only a verified repository or host description template. Never invent a free-form body. If no template is verified, create it with no description adjustment; read back its description and treat that exact body as the template before updating the managed region.

Existing open review: title is immutable. Change only the interior of one matching pair:

<!-- ai-only-start -->
<!-- ai-only-end -->

No markers: append one pair. Mixed, duplicated, or malformed markers: `blocked`. Never replace the whole body. Never approve, merge, or close.

After push and the permitted review update, inspect CI for the published commit as required by [verify](verify.md). Return `handoff` while required CI is running, and return failures to the implementation/verification loop. A successful push or review creation alone does not mean the work is complete.

`ready`: push plus permitted create/update, and the published commit's required CI pipeline is green.
`gaps`: a required CI job failed or a required check is missing; return to implement with job evidence.
`handoff`: required CI is running, or a transient failure prevents confirmation; resume from the existing pushed commit and review.
`blocked`: unsafe or ambiguous state.
