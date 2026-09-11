Publish only approved review actions. Prefer MCP over CLI.

Input: `{{workflow.input}}`
Approved plan: `{{reviewed.artifact}}`
Feedback: `{{reviewed.feedback}}`
Handoff: `{{last.summary}}`

GitHub: create pending review, add marked comments, submit `COMMENT`. Never approve, merge, resolve, close, or delete.

GitLab: publish each action inline when its approved path / line maps to a changed line. The configured GitLab MCP has no discussion-write tool, so use the GitLab API through `glab api` as the permitted `mcpFallback`. Fetch the current MR version and use its `base_commit_sha`, `start_commit_sha`, and `head_commit_sha`; submit a merge-request discussion with `position[position_type]=text`, those three SHAs, `position[new_path]`, `position[old_path]`, and `position[new_line]`. Use the approved `oldPath` when provided, otherwise derive it from the MR diff. Verify an inline response returns a text position matching the approved path / line. If the path / line is not a changed diff line, or a valid text position cannot be constructed, publish a generic MR comment and record the fallback reason. Do not downgrade an eligible inline action to a generic comment merely because the API call fails; report it as an error.

`ready`: every approved action exists on the host, with each inline-or-fallback publication recorded.
`handoff`: transient failure.
`blocked`: ambiguity or error.
