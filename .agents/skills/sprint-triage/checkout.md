# Stage: checkout

## Pi profile

- Role: `scout`
- Model: `gateway/gemini-3.8-flash`
- Thinking: `low`

The Pi adapter supplies the invoking request and previous stage artifact automatically. In a portable session, use the active conversation request and prior artifacts.

---

Create the knowledge-base worktree. Mechanical only.

Input: `the invoking request`
Approved plan: `the approved plan artifact from this run`

Use `sprint-triage.yaml` in this skill directory. If it is absent, ask the user to create it from `sprint-triage.example.yaml`, replace every placeholder locally, and keep the concrete file uncommitted. Dates must be `YYYY-MM-DD YYYY-MM-DD`. Create a linked worktree and add `docs/sprint-triage-<start>-to-<end>`. Missing content dir or index is fine.

`ready`: `workspace: {cwd: "<worktree-path>"}`.
`handoff`: transient mechanical worktree work remains and requires no user input.
`blocked`: bad dates, missing repository information, or an unsafe Git state requiring user input; put the question in `remaining`.
