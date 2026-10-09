# Stage: research

Use the invoking request and complete prior stage artifacts from the active conversation or their existing evidence files.

---

Deep-research the approved scope. Do not write the destination file yet.

Input: `the invoking request`
Approved scope: `the approved plan artifact from this run`
Feedback: `approval feedback from this run`
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


## Required ready response
Put the complete research draft in `Completed`, including every required heading, story, citation, source identity, and unresolved evidence gap. On `handoff`, retain the complete partial draft and exact remaining research.

# Completed
<complete draft with cited evidence>

# Remaining
<exact remaining work, or None.>
