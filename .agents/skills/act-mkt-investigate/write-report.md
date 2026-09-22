# Stage: write-report

## Pi profile

- Role: `scout`
- Model: `gateway/gemini-3.8-flash`
- Thinking: `low`

The Pi adapter supplies the invoking request and previous stage artifact automatically. In a portable session, use the active conversation request and prior artifacts.

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
