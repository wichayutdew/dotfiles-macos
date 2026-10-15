# Stage: verify

Use the invoking request and complete prior stage artifacts from the active conversation or their existing evidence files.

---

Independently check the implementation against the approved goal and acceptance criteria. Read-only.

Request: `the invoking request`
Approved plan: `the approved plan artifact from this run`
Feedback: `approval feedback from this run`
Ledger: `{{last.summary}}`

Re-run `repositories[0].reviewer[]`. Confirm commit title, status vs dirty baseline, and each acceptance criterion. Verify actual job results against the current change; a command being started, tests being written, or a worker saying “done” is not evidence of a pass. Include any required checks missing from the planned command list. Reduced broad regression scope does not waive verification of the changed work.

Before publication, confirm the relevant local checks passed. After publication triggers CI, inspect the pipeline for the published commit, including required downstream jobs, and confirm it is green before reporting the work complete. A previous commit's green pipeline is not current evidence. Record the tested commit, pipeline/job links, and final statuses; do not claim a pending, skipped required, canceled, failing, or unavailable check passed. Explicit user waivers remain stated limitations, never green results.

Return code or test failures through the implementation and verification loop. Report infrastructure failures with their actual job evidence; do not assume they are unrelated to the change. Keep waiting/running CI distinct from completed verification, and report unavailable access as a factual blocker.

`ready`: acceptance criteria and required local checks pass; proceed to publication. Overall work is complete only after the published commit's required CI pipeline is green.
`gaps`: return to implement with the exact failed or missing check.
`handoff`: checks or CI are still running, or a transient read-only failure prevents confirmation; resume verification without claiming completion.
`blocked`: corrupted workspace or required verification evidence cannot be accessed or obtained safely.
