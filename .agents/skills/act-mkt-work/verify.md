# Stage: verify

## Pi profile

- Role: `reviewer`
- Model: `gateway/grok-4.6`
- Thinking: `high`

The Pi adapter supplies the invoking request and previous stage artifact automatically. In a portable session, use the active conversation request and prior artifacts.

---

Independently check the implementation against the approved goal and acceptance criteria. Read-only.

Request: `the invoking request`
Approved plan: `the approved plan artifact from this run`
Feedback: `approval feedback from this run`
Ledger: `{{last.summary}}`

Re-run `repositories[0].reviewer[]`. Confirm commit title, status vs dirty baseline, and each acceptance criterion. A skipped or failing check is a fail.

`ready`: criteria and checks hold.
`gaps`: return to implement with the exact gap.
`handoff`: transient read-only failure.
`blocked`: corrupted workspace.
