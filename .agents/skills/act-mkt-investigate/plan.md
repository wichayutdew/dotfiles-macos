# Stage: plan

Use the invoking request and complete prior stage artifacts from the active conversation or their existing evidence files.

---

Define investigation scope. Read-only.

Input: `the invoking request`
Intake: `{{last.summary}}`
Rejected plan: `{{gate.artifact}}`
Feedback: `{{gate.feedback}}`

Base scope, sources, and open questions on the intake evidence. Do not invent system names, access, or investigative results. Put every user-answerable clarification or decision in the required `Questions` section of the plan artifact; do not ask separately. Approval feedback returns here and the artifact is re-presented at the same review gate.

`ready`: the complete scope artifact, including any user-answerable open questions in `Questions`, is ready for review.
`handoff`: transient read failure.
`blocked`: intake evidence is absent/unusable or required source evidence is inaccessible, contradictory, or unsafe to assume. Report the factual blocker in `Remaining` without asking a question. A user-answerable missing issue identifier or scope clarification belongs in `Questions` for plan review, not in a separate prompt.


## Required ready response
On `ready` or `handoff`, put the complete current scope draft in `Completed`: scope, sources, open questions, observed Jira/input facts, and every gate-artifact field.

# Completed
<complete scope draft and factual basis>

# Remaining
<exact planning work, or None.>

When Intake evidence is absent or incomplete, return `gaps` with exact missing fields so the workflow re-enters intake.
