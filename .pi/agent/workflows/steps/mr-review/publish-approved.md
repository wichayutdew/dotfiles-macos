Publish only approved review actions. Prefer MCP over CLI.

Input: `{{workflow.input}}`
Approved plan: `{{reviewed.artifact}}`
Feedback: `{{reviewed.feedback}}`
Handoff: `{{last.summary}}`

GitHub: create pending review, add marked comments, submit `COMMENT`. Never approve, merge, resolve, close, or delete.

`ready`: every approved action exists on the host.
`handoff`: transient failure.
`blocked`: ambiguity or error.
