Define investigation scope. Read-only.

Input: `{{workflow.input}}`
Intake: `{{last.summary}}`
Rejected plan: `{{gate.artifact}}`
Feedback: `{{gate.feedback}}`

Base scope, sources, and open questions on the intake evidence. Do not invent system names, access, or investigative results.

`ready`: the complete scope artifact is ready for review.
`handoff`: transient read failure.
`blocked`: empty input or required Jira missing.


## Required ready response
On `ready` or `handoff`, put the complete current scope draft in `Completed`: scope, sources, open questions, observed Jira/input facts, and every gate-artifact field.

# Completed
<complete scope draft and factual basis>

# Remaining
<exact planning work, or None.>

When Intake evidence is absent or incomplete, return `gaps` with exact missing fields so the workflow re-enters intake.
