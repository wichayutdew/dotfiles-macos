# Stage: write-report

Use the invoking request and complete prior stage artifacts from the active conversation or their existing evidence files.

---

Write only the approved report file. Mechanical.

Input: `the invoking request`
Approved scope: `the approved plan artifact from this run`
Validated draft: `{{last.summary}}`

Write or replace only the path under `# Report destination`. Use the validated draft headings. Do not stage or commit.

`ready`: file written.
`handoff`: transient write failure.
`blocked`: destination missing or unsafe.

When the Validated draft payload is absent or incomplete, return `gaps` with exact missing fields so the workflow re-enters validation.
