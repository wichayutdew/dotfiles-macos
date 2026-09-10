Turn reviewer findings into comments the user can approve.

Input: `{{workflow.input}}`
Findings: `{{last.summary}}`
Rejected plan: `{{gate.artifact}}`
Feedback: `{{gate.feedback}}`

Use only actionable, evidence-based findings anchored to the reviewed head. Keep the proposed published text specific, professional, and consistent with its detailed suggestion.

`ready`: every intended comment has the required artifact content and is ready for review.
`handoff`: transient read failure.
`blocked`: stale head.
