Plan the work from intake. Read-only. Do not create a branch or worktree.

Authoritative work request: `{{workflow.input}}`
Intake/recovery handoff: `{{last.summary}}`
Rejected plan: `{{gate.artifact}}`
Feedback: `{{gate.feedback}}`

Inspect origin, base HEAD, target branch, and the host description template. Base every planned change, validation command, and publication value on observed evidence.

Branch: `<type>/<KEY>` or `<type>/<semantic-kebab-summary>`. No random suffix or run id.

`ready`: the complete plan artifact and publication metadata are ready for review.
`handoff`: actionable planning work remains and requires no user input.
`blocked`: evidence, authority, or a user decision is required; put the question in `remaining`.

When Intake evidence is absent or incomplete, return `gaps` with exact missing fields so the workflow re-enters intake.
