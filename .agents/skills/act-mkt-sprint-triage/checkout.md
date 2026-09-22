# Stage: checkout

## Pi profile

- Role: `scout`
- Model: `gateway/gemini-3.8-flash`
- Thinking: `low`

The Pi adapter supplies the invoking request and previous stage artifact automatically. In a portable session, use the active conversation request and prior artifacts.

---

Create the knowledge-base worktree and publication branch. Mechanical only.

Input: `the invoking request`
Approved plan: `the approved plan artifact from this run`

Use `sprint-triage.yaml` in this skill directory. If it is absent, ask the user to create it from `sprint-triage.example.yaml`, replace every placeholder locally, and keep the concrete file uncommitted. Dates must be `YYYY-MM-DD YYYY-MM-DD`.

1. Validate `knowledgeBase.localRepositoryPath` and `gitlab.targetBranch`.
2. Open the configured repository only as its clean primary checkout. Capture its target-branch base SHA and block if it has tracked or untracked changes.
3. Create a new linked worktree from `gitlab.targetBranch` and create a topic branch named `docs/sprint-triage-<start>-to-<end>`. Do not reuse the primary checkout or an existing publication branch.
4. Return the worktree path, topic branch, and base SHA. Missing content directory or index is fine.

`ready`: `workspace: {cwd: "<worktree-path>", branch: "docs/sprint-triage-<start>-to-<end>", baseSha: "<target-branch SHA>"}`.
`handoff`: transient mechanical worktree work remains and requires no user input.
`blocked`: bad dates, missing repository information, or an unsafe Git state requiring user input; put the question in `remaining`.
