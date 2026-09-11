Turn reviewer findings into comments the user can approve.

Input: `{{workflow.input}}`
Findings: `{{last.summary}}`
Rejected plan: `{{gate.artifact}}`
Feedback: `{{gate.feedback}}`

Use only actionable, evidence-based findings anchored to the reviewed head. Keep the proposed published text specific, professional, and consistent with its detailed suggestion.

For GitLab, construct publication actions before submitting this artifact. For every finding on a changed diff line, include an exact Fish-safe `glab api` command that POSTs to the MR `/discussions` endpoint using multipart form data: `--form="body=$body"` and individual single-quoted `--form='position[...]=...'` arguments for the current `position[base_sha]`, `position[start_sha]`, `position[head_sha]`, `position[position_type]=text`, `position[old_path]`, `position[new_path]`, and `position[new_line]` values. Include the exact comment body and a stable marker in the command; no placeholders. Put multiline bodies in a Fish `begin` / `end` block using `set body`, escaping apostrophes. Never use `-f`, `-F`, or `--field` for a GitLab inline discussion position: GitLab must receive nested multipart `position[...]` parameters. Mark such actions `inline-comment`, with their path, line, oldPath, and SHAs in the JSON action. Use `generic-comment` only when a valid text position is impossible; provide its reason and an exact `glab api` POST to the MR `/notes` endpoint. An inline action has no generic fallback if its approved command fails.

`ready`: every intended comment has the required artifact content and is ready for review.
`handoff`: transient read failure.
`blocked`: stale head.


## Required ready response
On `ready` or `handoff`, put the complete proposed review-comment and publication-action ledger in `Completed`.

# Completed
<complete review plan ledger>

# Remaining
<exact remaining work, or None.>

When Findings are absent or incomplete, return `gaps` with exact missing fields so the workflow re-enters review.
