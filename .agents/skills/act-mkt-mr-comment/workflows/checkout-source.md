# Stage: checkout-source

Use the invoking request and complete source evidence, inline or through the evidence references defined in SKILL.md.

---

Validate and bind the recorded task directory and reviewed source evidence. Existing work keeps its source worktrees; a genuinely standalone task has read-only inspection evidence and only proposed editable bindings until approval. This stage is read-only for checkout contents and branch/index state.

Input: `the invoking request`
Evidence: `{{last.summary}}`

Recover the inherited `workspace` and `repositories[]` per [Task workspace](../generic/task-workspace.md), including the original absolute root, manifest path, cleanup ledger, all source/base/head identities, dirty baselines and confirmed publication IDs. Validate every relevant repository; do not default to a new workspace or choose an unrelated existing checkout. For already prepared helper-managed workspaces run the helper’s `--check`, or validate recorded custom contexts in place. For standalone entry, validate the inspection clone/source identity and proposed manifest without running `--check` against nonexistent worktrees or creating them. Compare each source origin/branch and local HEAD with that review's fetched source identity, including fork source versus target. Preserve every inherited path and the root's ticket-ID or short-summary name.

Reconcile incoming source evidence before edits. A fetch may retrieve objects/remote refs without changing the bound worktrees, but do not checkout, pull, reset, stash, clean or overwrite files. Preserve another contributor's commits and distinguish our verified local/pushed commits and uncommitted progress from external movement using the checkpoint. Route movement that invalidates assumptions through fetch/plan recovery; do not silently implement an old plan on a newer head. A merged/closed review has no active source-edit delivery for that entry; retain its evidence for the planner’s local report while continuing independent active reviews.

If recorded paths are missing, retain the established root and resource identities. Recover source evidence in a separate read-only inspection location when needed, record exact reconstruction requirements for plan approval, and never silently substitute it as the editable workspace. Only the approved implementation route may recreate missing resources at their recorded paths. Unresolved handoff/review identity or an unsafe path/branch collision remains a factual blocker. Existing reused resources are not re-registered for cleanup; carry the inherited ledger path.

`ready`: an existing workspace is safely bound with current source evidence, precisely identified missing-resource recovery is documented, or a verified standalone task has complete read-only source evidence and proposed editable preparation for plan approval.
`gaps`: source/evidence changed or is incomplete; refresh through fetch.
`handoff`: transient mechanical/fetch failure.
`blocked`: no safe checkout or reconciliation is possible.

## Required response

# Completed
<prior evidence references, inherited workspace/root/manifest/ledger, per-repository cwd/origin/role/branch/base and fetched/local HEAD, dirty baseline, incoming-commit assessment, confirmed publication IDs and any exact missing-resource recovery proposal>

# Remaining
<exact mechanical work, or None.>
