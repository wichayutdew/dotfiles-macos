Check the draft against the approved goal. Read-only. Do not write the report file.

Input: `{{workflow.input}}`
Approved scope: `{{reviewed.artifact}}`
Draft: `{{last.summary}}`

Re-check citations. Reject filler, missing stories, or claims that miss the goal.

`ready`: draft satisfies the goal.
`gaps`: return to research with exact gaps.
`handoff`: transient read failure.
`blocked`: irreconcilable evidence.


## Required ready response
Put the complete validated draft verbatim in `Completed`, with criterion-by-criterion validation and citation-check results.

# Completed
<complete validated draft and validation ledger>

# Remaining
- None.
