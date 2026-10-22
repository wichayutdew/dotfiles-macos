# Stage: verify

Use the invoking request and complete source evidence, inline or through the evidence references defined in SKILL.md.

---

Independently check the implementation against the approved goal and acceptance criteria. Read-only.

Request: `the invoking request`
Approved plan: `the approved plan artifact from this run`
Feedback: `approval feedback from this run`
Ledger: `{{last.summary}}`

Run the approved reviewer/check commands in `repositories[0].cwd` and confirm its status versus dirty baseline, that every `role: reference` clone is unchanged, and each acceptance criterion. Reuse valid results for the same code/environment; broaden or repeat checks when changes, failures or unresolved concerns justify it. Confirm commit title only when commits are authorized. Verify actual job results against the current change; a command being started, tests being written, or a worker saying “done” is not evidence of a pass. Include any required checks missing from the planned command list. Reduced broad regression scope does not waive verification of the changed work.

For changed API contracts, check parity of request/query variables, selected fields, DTOs and realistic fixtures, and run executable request collections when applicable. Return gaps to implementation for missing/stale collections, fixtures or code; do not edit them during verification. For changed UI behavior, exercise the affected flow in a browser with controlled dependencies. For download/save changes, inspect the actual file bytes, row/content counts and format rather than trusting the extension or serialization unit tests. Cover relevant empty, cancellation, error and stale-result paths. State native-dialog or browser limits precisely.

Assert the behavior at its test layer: visible UI in component/browser checks, data/logic in unit/integration checks. Avoid test-only production counters or hidden state. Ignored/unrun tests are not passing coverage. Respect explicit reduced-scope waivers and repository test layout/commands.

Before publication, confirm the relevant local checks passed. The publish stage owns post-push CI waiting and readback: it must inspect the pipeline for the published commit, including required downstream jobs, before reporting delivery complete. A previous commit's green pipeline is not current evidence. For merged-result pipelines, verify the current source association and record both source and synthetic merge-result SHAs. Record the tested commit, pipeline/job links, and final statuses; do not claim a pending, skipped required, canceled, failing, or unavailable check passed. Explicit user waivers remain stated limitations, never green results.

Return code or test failures through the implementation and verification loop. Report infrastructure failures with their actual job evidence; do not assume they are unrelated to the change. Keep waiting/running CI distinct from completed verification, and report unavailable access as a factual blocker.

`ready`: acceptance criteria and required local checks pass; proceed to publication. A publication contract is complete only after current-source required CI passes or an explicit waiver is reported. Local-only/no-commit contracts finish with verified local evidence and do not require a push or CI.
`gaps`: return to implement with the exact failed or missing check.
`handoff`: local checks are still running or a transient read-only failure prevents confirmation; resume verification without claiming completion. Post-push CI handoffs belong to publish.
`blocked`: corrupted workspace or required verification evidence cannot be accessed or obtained safely.
