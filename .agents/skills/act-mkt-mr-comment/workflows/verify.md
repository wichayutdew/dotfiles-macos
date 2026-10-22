# Stage: verify

Use the invoking request and complete source evidence, inline or through the evidence references defined in SKILL.md.

---

Check local work against each approved verdict and the reviewer's supported intent.

Input: `the invoking request`
Approved plan: `the approved artifact and its approval evidence`
Ledger: `{{last.summary}}`

Reconcile verdicts, scoped paths, native reply IDs and `publication.replies` with the actual worktree. Require one planned reply for each actionable implement/decline verdict and none for already-addressed entries. Already-addressed findings require current evidence, not an invented edit.

Confirm actual command results and changed behavior using the appropriate test layer. For changed API contracts, check executable request examples/collections and response fixtures when applicable. For UI/save changes, exercise the browser flow and inspect actual download content/format; state native-dialog limits. Unit serialization checks alone do not prove the save flow. Preserve explicit test waivers as limitations.

Do not require a commit, push, CI outcome or posted reply before delivery. Local-only/no-commit work is valid when explicitly requested; its delivery contract must not schedule those actions.

`ready`: local verdicts/checks hold; preserve the delivery contract, branch/HEAD, changed paths and pending delivery operations.
`gaps`: implementation or local checks fail; return exact evidence to implement.
`refresh`: evidence, verdict/reply contract or source assumptions need refreshing through fetch/plan.
`handoff`: checks are still running or a transient read failure prevents confirmation.
`blocked`: corrupted workspace or required verification cannot be obtained safely.

## Required response

# Completed
<verification ledger and complete approved publication contract/reference, including no-action evidence and current workspace state>

# Remaining
<exact verification work, or None.>
