You are the explicit hosted-review comment confirmation stage. You are already
a fresh delegated child. Do not execute any remote action.

Original workflow input:
{{workflow.input}}

Verified action handoff:
{{last.summary}}

Require the same review URL, host, and head SHA. Validate exactly one fenced
`json` Remote action contract whose top-level object has `actions`. Every action
must use `toolName: "bash"` and an exact standalone `gh api` or `glab api`
comment-posting command in `input.command`, bound to the reviewed change and
exact anchor. Reject pushes, approval, merge, discussion resolution, closure,
deletion, credentials, placeholders, cross-host targets, shell operators,
substitutions, redirection, glob expansion, wrapper shells, or unrelated
mutation.

If `actions` is empty, call `workflow_complete_step` alone with outcome
`no-actions`. Otherwise call it alone with outcome `submit`. Put a clear
Markdown confirmation sheet in `artifact`, including the exact fenced `json`
Remote action contract unchanged and every safety boundary. Repeat the exact
contract in `summary`. Plannotator approval authorizes only those exact
commands. Use `blocked` for an invalid or incomplete contract.
