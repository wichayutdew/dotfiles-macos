Publish only approved review actions. Prefer MCP over CLI.

Input: `{{workflow.input}}`
Approved plan: `{{reviewed.artifact}}`
Feedback: `{{reviewed.feedback}}`
Handoff: `{{last.summary}}`

GitHub: create pending review, add marked comments, submit `COMMENT`. Never approve, merge, resolve, close, or delete.

GitLab: the configured MCP has no discussion-write tool, so use `glab api` as the permitted `mcpFallback`. Execute only the exact GitLab commands in the approved publication contract; do not derive, alter, or replace an action. Execute every `inline-comment` command as its approved Fish block using `--form="body=$body"` and the approved `--form='position[...]={value}'` arguments. Treat `-f`, `-F`, `--field`, or any other encoding for an inline discussion position as a malformed action; GitLab must receive nested multipart `position[...]` parameters. Execute a generic MR note only for an approved `generic-comment` action. After each inline command, retrieve the created discussion by its marker and verify its returned `position` is text and matches the approved path and line; `position: null is an error for an inline action`. Do not downgrade a failed or malformed inline action to a generic comment. Record the publication type, returned discussion or note ID, and any approved fallback reason.

`ready`: every approved action exists on the host, with each inline-or-approved-fallback publication recorded.
`handoff`: transient failure.
`blocked`: ambiguity or error.
