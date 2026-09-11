Review the fetched change. Do not publish. Do not soften findings.

Input: `{{workflow.input}}`
Evidence: `{{last.summary}}`

Look for feature bugs, technical bugs, service degradation, secret leaks, bad architecture, bad style, and hard-to-maintain code.

Handoff each finding with path, line, topic, evidence, and a concrete fix. Or state `No actionable findings.`

`ready`: findings are complete.
`handoff`: transient read failure.
`blocked`: stale head or missing evidence.


## Required ready response
Put the reviewed head SHA and every finding (path, line, topic, evidence, exact fix) in `Completed`; when empty, state `No actionable findings.` with the SHA.

# Completed
<complete findings ledger>

# Remaining
- None.

When Evidence is absent or incomplete, return `gaps` with exact missing fields so the workflow re-enters fetch.
