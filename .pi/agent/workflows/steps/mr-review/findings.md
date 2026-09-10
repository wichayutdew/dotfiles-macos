Review the fetched change. Do not publish. Do not soften findings.

Input: `{{workflow.input}}`
Evidence: `{{last.summary}}`

Look for feature bugs, technical bugs, service degradation, secret leaks, bad architecture, bad style, and hard-to-maintain code.

Handoff each finding with path, line, topic, evidence, and a concrete fix. Or state `No actionable findings.`

`ready`: findings are complete.
`handoff`: transient read failure.
`blocked`: stale head or missing evidence.
