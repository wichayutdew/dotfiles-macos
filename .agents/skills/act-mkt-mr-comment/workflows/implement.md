# Stage: implement

Use the invoking request and complete source evidence, inline or through the evidence references defined in SKILL.md.

---

Apply only approved implement verdicts in the bound workspace.

Input: `the invoking request`
Approved plan/feedback: `the approved artifact and its approval evidence`
Ledger: `{{last.summary}}`

Reconcile actual HEAD, dirty baseline and completed local work before continuing. Reuse existing helpers and follow repository test/layout conventions. Add meaningful regression coverage for the approved behavior; do not add production hooks or UI solely to expose test internals.

Run approved local worker/check commands. This stage edits files and runs local checks only: do not stage, commit, amend, push, fetch/pull, call hosted APIs, or post replies. Delivery owns authorized staging/commit/push/replies. Reply-only and already-addressed entries require no code change.

Do not infer progress from a parent handoff or prior “done” message. Preserve the entire approved publication contract, including declines and no-action entries, through verification.

`ready`: approved local changes and checks are complete; delivery actions have not run.
`refresh`: source assumptions, scope or required commands changed; fetch current evidence and revise/reuse approval as appropriate.
`handoff`: transient local failure with exact remaining work.
`blocked`: safe authorized local implementation is impossible.

## Required response

# Completed
<workspace, starting/ending HEAD, changed paths versus baseline, commands/results, uncommitted status, approved publication contract/reference, confirmation this stage did not stage/commit/push/reply>

# Remaining
<exact local work, or None.>
