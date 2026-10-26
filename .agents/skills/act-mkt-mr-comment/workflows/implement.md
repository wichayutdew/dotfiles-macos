# Stage: implement

Use the invoking request and complete source evidence, inline or through the evidence references defined in SKILL.md.

---

Apply only approved implement verdicts in the bound workspace.

Input: `the invoking request`
Approved plan/feedback: `the approved artifact and its approval evidence`
Ledger: `{{last.summary}}`

After approval, revalidate the inherited absolute task root and every affected repository origin/branch/base/head against the approved record; use the helper’s read-only `--check` for its managed layout. Reconcile dirty baselines and completed local work before continuing. Do not create another root or switch branches merely because invocation cwd changed. If the plan explicitly authorizes missing-resource reconstruction, prepare only those missing resources at the recorded paths, register new resources and revalidate the full manifest before edits. Reuse existing helpers and follow applicable repository guidance and test/layout conventions. Apply each group’s approved testing rationale: use regression tests where they establish the correction and relevant existing validation for mechanical edits. Honor explicit mandates and waivers; do not add production hooks or UI solely to expose test internals.

Edit only the approved paths in each `primary` or `editable` repository’s recorded cwd; keep `reference` repositories read-only. Give workers repository-qualified exclusive paths and check commands, and retain per-repository local/published SHAs. Schedule independent ready groups under this skill’s fix execution policy, preserving exclusive ownership and serializing conflicting resources. Inspect the combined result after integration. Reuse still-valid evidence and rerun checks invalidated by later edits.

Once any explicitly approved missing-resource preparation is complete, run approved local worker/check commands. The fix portion edits files and runs local checks only: do not stage, commit, amend, push, fetch/pull, call hosted APIs, or post replies. Delivery owns authorized staging/commit/push/replies. Reply-only and already-addressed entries require no code change.

Do not infer progress from a parent handoff or prior “done” message. Preserve the entire approved publication contract, including declines and no-action entries, through verification.

`ready`: approved local changes and checks are complete; delivery actions have not run.
`refresh`: source assumptions, scope or required commands changed; fetch current evidence and revise/reuse approval as appropriate.
`handoff`: transient local failure with exact remaining work.
`blocked`: safe authorized local implementation is impossible.

## Required response

# Completed
<inherited workspace/root/manifest/cleanup ledger, per-repository origin/branch and starting/ending HEAD, changed paths versus baseline, commands/results, uncommitted status, approved publication contract/reference, confirmation this stage did not stage/commit/push/reply>

# Remaining
<exact local work, or None.>
