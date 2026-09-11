Write only the approved report file. Mechanical.

Input: `{{workflow.input}}`
Approved scope: `{{reviewed.artifact}}`
Validated draft: `{{last.summary}}`

Write or replace only the path under `# Report destination`. Use the validated draft headings. Do not stage or commit.

`ready`: file written.
`handoff`: transient write failure.
`blocked`: destination missing or unsafe.

When the Validated draft payload is absent or incomplete, return `gaps` with exact missing fields so the workflow re-enters validation.
