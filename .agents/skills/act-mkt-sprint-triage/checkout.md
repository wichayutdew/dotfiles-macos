# Stage: checkout

Use the invoking request and complete prior stage artifacts from the active conversation or their existing evidence files.

---

Create the knowledge-base worktree and publication branch. Mechanical only.

Input: `the invoking request`
Approved plan: `the approved plan artifact from this run`

Use `sprint-triage.yaml` in this skill directory. Dates must be `YYYY-MM-DD YYYY-MM-DD`. If the configuration is absent or incomplete, do not ask the user to create or complete it and do not infer values; report the exact missing file/keys as a terminal `blocked` outcome.

1. Validate `knowledgeBase.localRepositoryPath` and `gitlab.targetBranch`.
2. Open the configured repository only as its clean primary checkout. Capture its target-branch base SHA and block if it has tracked or untracked changes.
3. Create a new linked worktree from `gitlab.targetBranch` and create a topic branch named `docs/sprint-triage-<start>-to-<end>`. Do not reuse the primary checkout or an existing publication branch.
4. Return the worktree path, topic branch, and base SHA. Missing content directory or index is fine.

`ready`: `workspace: {cwd: "<worktree-path>", branch: "docs/sprint-triage-<start>-to-<end>", baseSha: "<target-branch SHA>"}`.
`handoff`: transient mechanical worktree work remains and requires no user input.
`blocked`: bad dates, missing required repository/configuration information, or an unsafe Git state. Report the exact observed blocker in `remaining`; do not ask a question, wait for input, or mutate around a safety check.
