Define investigation scope. Read-only.

Input: `{{workflow.input}}`
Intake: `{{last.summary}}`
Rejected plan: `{{gate.artifact}}`
Feedback: `{{gate.feedback}}`

Base scope, sources, and open questions on the intake evidence. Do not invent system names, access, or investigative results.

`ready`: the complete scope artifact is ready for review.
`handoff`: transient read failure.
`blocked`: empty input or required Jira missing.
