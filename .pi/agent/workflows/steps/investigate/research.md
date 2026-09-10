Deep-research the approved scope. Do not write the destination file yet.

Input: `{{workflow.input}}`
Approved scope: `{{reviewed.artifact}}`
Feedback: `{{reviewed.feedback}}`
Prior draft: `{{last.summary}}`

Use only resources justified in the scope (Sourcegraph, Glean, Grafana, Superset, Query Writer, Slack, GitLab, Bash). Search with `rg` via Bash.

A parent recovery `handoff` is unconfirmed context, not proof that research was completed. Reconcile the approved scope, request, and prior draft before continuing; do not infer evidence, findings, or progress from it.

Handoff a complete draft:

# Brief description
# Goal
# Non Goal
# Risks
# Stories breakdown

Each story:

## Brief Title
## Brief description
## Things to implement
## Acceptance Criteria
## Dependency

`ready`: draft complete with cited evidence.
`handoff`: transient tool failure.
`blocked`: required evidence inaccessible.
