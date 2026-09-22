# Stage: plan

## Pi profile

- Role: `planner`
- Model: `gateway/gpt-5.6-terra`
- Thinking: `high`

The Pi adapter supplies the invoking request and previous stage artifact automatically. In a portable session, use the active conversation request and prior artifacts.

---

Plan the work from intake. Read-only. Do not create a branch or worktree.

Authoritative work request: `the invoking request`
Intake/recovery handoff: `{{last.summary}}`
Rejected plan: `{{gate.artifact}}`
Feedback: `{{gate.feedback}}`

Inspect origin, base HEAD, target branch, and the host description template. Base every planned change, validation command, and publication value on observed evidence.

Branch: `<type>/<KEY>` or `<type>/<semantic-kebab-summary>`. No random suffix or run id.

`ready`: the complete plan artifact and publication metadata are ready for review.
`handoff`: actionable planning work remains and requires no user input.
`blocked`: evidence, authority, or a user decision is required; put the question in `remaining`.

When Intake evidence is absent or incomplete, return `gaps` with exact missing fields so the workflow re-enters intake.
