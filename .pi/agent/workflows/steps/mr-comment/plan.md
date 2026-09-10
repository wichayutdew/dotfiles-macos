Decide each unresolved review comment. Read-only on the bound checkout.

Input: `{{workflow.input}}`
Evidence: `{{last.summary}}`
Rejected plan: `{{gate.artifact}}`
Feedback: `{{gate.feedback}}`

Base each verdict on the current checkout and host evidence. Preserve every unresolved comment identity and anchor; do not plan an unapproved remote action or command.

`ready`: every comment has the required artifact content and is ready for review.
`handoff`: transient API failure.
`blocked`: unsafe or missing anchors.
