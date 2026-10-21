# Stage: plan

Use the invoking request and complete source evidence, inline or through the evidence references defined in SKILL.md.

---

Validate the current feedback against the bound code and explicit user intent. Read-only.

Input: `the invoking request`
Evidence: `{{last.summary}}`
Prior artifact/feedback: `{{gate.artifact}}` / `{{gate.feedback}}`

Reconcile all relevant comments with current code, replies and the checkpoint. Distinguish new/changed or reopened feedback from already-addressed feedback. An older unresolved thread with a confirmed adequate reply needs no identical reply; new follow-up text still needs assessment.

For each comment record identity/anchor, evidence, and an `implement`, `decline`, or `already-addressed` verdict. Validate suggestions rather than accepting them blindly. Reuse existing code/helpers/tests where suitable and keep fixes within approved scope.

For each actionable implement/decline verdict, provide one exact response and one `publication.replies` entry with its native discussion/comment ID and reply type. Inline feedback uses its existing discussion; a general comment uses the host's general-comment capability. Already-addressed/no-action entries have evidence but no new reply. An implement reply may claim only checks that delivery will actually confirm.

For code changes, list scoped paths, local worker/check commands, required CI and one imperative Conventional Commit `publication.commitSubject`, source branch and non-force push action. Honor explicit local-only/no-commit restrictions by disabling those delivery actions. Include all implementation, validation and publication choices in the complete approval artifact; feedback revises that artifact at the same gate.

A newer head requires revalidation; a changed verdict, scope or publication action requires approval of the revised artifact. Retain existing approval when that artifact and its assumptions remain valid. New comments are a separate delta, never implicit authority to expand an approved plan.

`ready`: actionable verdicts and exact delivery contract are ready for the approval gate.
`done`: no actionable delta; report evidence locally without an empty approval/publication cycle. For an externally merged/closed review, report completed and undelivered actions without reopening code delivery.
`gaps`: incomplete/stale host evidence; return to fetch.
`handoff`: transient read failure.
`blocked`: actionable feedback has no safe identity, access or authorized reply capability.

## Required response

# Completed
<comment/verdict ledger, exact scoped changes/checks/replies, publication contract, approval identity or no-action rationale>

# Remaining
<exact decisions/work, or None.>
