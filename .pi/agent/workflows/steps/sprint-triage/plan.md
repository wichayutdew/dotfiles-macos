Summarize collected tickets for two audiences. Do not mutate Git or Confluence.

Input: `{{workflow.input}}`
Collection: `{{last.summary}}`
Rejected plan: `{{gate.artifact}}`
Feedback: `{{gate.feedback}}`

Re-read `~/.pi/agent/workflows/steps/sprint-triage/sprint-triage.yaml`. Fetch the Confluence page as HTML for existing-guide comparison and top-insertion context.

`ready`: both products and the complete approval artifact are ready for review.
`gaps`: the collection evidence is missing, incomplete, or not a complete verifiable structured collection result; it must be recollected before planning can continue. Report the factual missing evidence in `remaining`.
`handoff`: actionable planning work remains and requires no user input.
`blocked`: unsafe redaction or another user decision is required; put the question in `remaining`.
