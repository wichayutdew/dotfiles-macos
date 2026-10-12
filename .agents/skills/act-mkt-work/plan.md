# Stage: plan

Use the invoking request and complete prior stage artifacts from the active conversation or their existing evidence files.

---

Plan the work from intake. Read-only. Do not create a branch or worktree.

Authoritative work request: `the invoking request`
Intake/recovery handoff: `{{last.summary}}`
Rejected plan: `{{gate.artifact}}`
Feedback: `{{gate.feedback}}`

Inspect origin, base HEAD, target branch, and the host description template. Base every planned change, validation command, and publication value on observed evidence.

Branch: `<type>/<KEY>` or `<type>/<semantic-kebab-summary>`. No random suffix or run id.

Before `ready`, put every user-answerable missing fact, decision, required authorization, and publication choice in the artifact's `Risks/Decisions Needed` section. Do not ask these separately or invent answers. Approval feedback returns to this plan stage and the artifact is re-presented at the same review gate.

`ready`: the complete plan artifact and publication metadata, including all open decision questions, are ready for review.
`handoff`: actionable planning work remains and requires no user input.
`blocked`: required evidence or authority is unavailable, contradictory, or unsafe to assume. Report the exact factual blocker in `remaining` without asking a question. Put user-answerable decisions in the plan artifact for review instead.

When Intake evidence is absent or incomplete, return `gaps` with exact missing fields so the workflow re-enters intake.
