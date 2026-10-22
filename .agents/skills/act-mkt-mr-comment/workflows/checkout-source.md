# Stage: checkout-source

Use the invoking request and complete source evidence, inline or through the evidence references defined in SKILL.md.

---

Bind the reviewed source branch without disturbing unrelated work.

Input: `the invoking request`
Evidence: `{{last.summary}}`

Reuse a suitable existing source checkout/worktree. Compare its origin, branch, HEAD and dirty baseline with fetched source identity. If isolation is needed, use the runtime's worktree facility or a safe isolated checkout. Immediately register a newly created worktree/clone per [Workspace cleanup](../generic/cleanup.md); never register an existing reused checkout. Carry the ledger path with the workspace identity. Never stash, reset, clean, delete, or overwrite unrelated files.

Fetch/reconcile incoming commits before edits. Preserve another contributor's commits; do not silently implement an old plan on a newer head. On continuation, distinguish our verified local/pushed commits from external movement using the checkpoint. A merged/closed review has no active source-edit delivery; retain evidence for the planner to report remaining work.

`ready`: workspace is safely bound with current source evidence.
`gaps`: source/evidence changed or is incomplete; refresh through fetch.
`handoff`: transient mechanical/fetch failure.
`blocked`: no safe checkout or reconciliation is possible.

## Required response

# Completed
<prior evidence references, workspace cwd/origin/branch, fetched and local HEAD, dirty baseline, incoming-commit assessment>

# Remaining
<exact mechanical work, or None.>
