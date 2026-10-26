# Stage: plan

Build the plan with this skill’s [plan template](../generic/plan-template.md). The template defines the artifact structure; this prompt defines how to produce it.

Use the invoking request and complete source evidence, inline or through the evidence references defined in SKILL.md.

---

Validate the current feedback against the inherited work task directory, bound code and explicit user intent. Read-only. Preserve its actual root, repository paths, source branches, known local progress and publication IDs even when this skill was launched elsewhere.

Input: `the invoking request`
Evidence: `{{last.summary}}`
Prior artifact/feedback: `{{gate.artifact}}` / `{{gate.feedback}}`

Reconcile all relevant comments with current code, replies and the checkpoint. Distinguish new/changed or reopened feedback from already-addressed feedback. An older unresolved thread with a confirmed adequate reply needs no identical reply; new follow-up text still needs assessment.

For each comment record canonical review/source repository identity, native identity/anchor, evidence, and an `implement`, `decline`, or `already-addressed` verdict. Validate suggestions rather than accepting them blindly. Record applicable repository guidance and existing candidate paths/symbols: fit or gap, reuse/extension/new-code decision, and owning responsibility. Keep fixes within approved scope.

For each actionable implement/decline verdict, provide one exact response and one `publication.replies` entry with canonical review identity, its native discussion/comment ID and reply type; equal numeric IDs in different reviews are distinct. Inline feedback uses its existing discussion; a general comment uses the host's general-comment capability. Already-addressed/no-action entries have evidence but no new reply. An implement reply may claim only checks that delivery will actually confirm.

Group related fixes into coherent tasks. For each changing group, record dependencies, prerequisites with verified readiness or remaining assumptions, affected interfaces/consumers, owned paths and proportionate checks with rationale. Run independent ready groups concurrently when file ownership and check resources do not conflict; the parent owns integration and Git/index operations. Preserve an active task’s working context and approved progress when incorporating these verdicts.

For code changes, list repository-qualified scoped paths, local worker/check commands, required CI and an imperative Conventional Commit subject, verified source origin, existing review source branch and non-force push action per changing repository. Retain `repositories[]` roles: `primary` and `editable` permit approved fixes; `reference` remains read-only. A fix affecting an additional repository must establish its requirement/review identity and obtain approval for the added scope; do not create unrelated review branches. Map each reply claim to all prerequisite repositories/checks. Honor explicit local-only/no-commit restrictions by disabling those delivery actions. Include all implementation, validation and publication choices in the complete approval artifact; feedback revises that artifact at the same gate.

Any missing workspace/resource recovery must name the inherited paths and exact resources to recreate after approval, with identity/collision decisions resolved; do not authorize a second root as a routine fallback.

A newer head requires revalidation; a changed verdict, scope or publication action requires approval of the revised artifact. Retain existing approval when that artifact and its assumptions remain valid. New comments are a separate delta, never implicit authority to expand an approved plan.

`ready`: actionable verdicts and exact delivery contract are ready for the approval gate.
`done`: no actionable delta or active delivery remains across the implicated reviews; report evidence locally without an empty approval/publication cycle. For an externally merged/closed review, retire only that entry’s obsolete delivery and report its completed/undelivered actions; continue planning independent active entries.
`gaps`: incomplete/stale host evidence; return to fetch.
`handoff`: transient read failure.
`blocked`: actionable feedback has no safe identity, access or authorized reply capability.

## Required response

# Completed
<comment/verdict ledger, exact scoped changes/checks/replies, publication contract, approval identity or no-action rationale>

# Remaining
<exact decisions/work, or None.>
