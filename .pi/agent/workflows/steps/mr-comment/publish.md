Push the verified commit if any, then post the approved response messages. Prefer MCP over CLI.

Input: `{{workflow.input}}`
Approved plan: `{{reviewed.artifact}}`
Ledger: `{{last.summary}}`

Execute only approved `remoteActions`. For GitHub reviewer replies use `add_reply_to_pull_request_comment`; use `add_issue_comment` only for a general PR comment. For GitLab, reply to the approved existing discussion identity; do not create a new `/discussions` resource or construct an inline `position` payload. Never force-push, resolve, approve, or merge.

`ready`: all required pushes and replies are confirmed, or the approved action list is empty.
`handoff`: transient failure.
`blocked`: remote moved or ambiguous.
