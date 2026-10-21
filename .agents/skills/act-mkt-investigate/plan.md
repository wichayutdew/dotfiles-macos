# Stage: plan

Use the invoking request and complete source evidence, inline or through the evidence references defined in SKILL.md.

---

Define investigation scope. Read-only.

Input: `the invoking request`
Intake: `{{last.summary}}`
Rejected plan: `{{gate.artifact}}`
Feedback: `{{gate.feedback}}`

Base scope, sources, and open questions on the intake evidence. Do not invent system names, access, or investigative results. Put every user-answerable clarification or decision in the required `Questions` section of the plan artifact; do not ask separately. Approval feedback returns here and the artifact is re-presented at the same review gate.

- Under # Report destination identify the exact canonical local path, hosted identities/description fields in dependency order, or chat-only output. Include the authorized write scope and readback checks under resources. A user who requested no local report must not be asked for a report path.
- Read the current destination as the revision baseline, preserve unrelated edits/fields, and identify protected contract blocks. Destination authority does not authorize ticket status, label or assignee changes.
- Separate existing behavior, requested changes, components that must remain unchanged, and deferred risks. A diagnosed limitation is not permission to fix it. Preserve the user's latest explicit scope correction rather than carrying forward an earlier interpretation.
- For an RFC, `Goal/Acceptance Criteria` and `Non Goal` describe the product proposal/decision. Record agent permissions, publication authority, and tool limits separately under resources/destination.
- Identify the canonical user-edited report, approved template/reference, and protected request/response contracts. Plan targeted edits and preservation checks; do not promote a stale internal draft over the canonical document.
- Verify supplied ticket summaries against the named feature. Record mismatches and the source needed to resolve them; do not silently substitute a different ticket/component.
- For traffic/monitoring work, name the consumers, source/emitter checks, bounded measurement windows, forecast assumptions, and required read/create/render capabilities. Put missing decisions or external-mutation authority at this gate.

`ready`: the complete scope artifact, including any user-answerable open questions in `Questions`, is ready for review.
`handoff`: transient read failure.
`blocked`: intake evidence is absent/unusable or required source evidence is inaccessible, contradictory, or unsafe to assume. Report the factual blocker in `Remaining` without asking a question. A user-answerable missing issue identifier or scope clarification belongs in `Questions` for plan review, not in a separate prompt.


## Required ready response
On `ready` or `handoff`, put the complete current scope draft in `Completed`: scope, sources, open questions, observed tracker/input facts, and every gate-artifact field.

# Completed
<complete scope draft and factual basis>

# Remaining
<exact planning work, or None.>

When Intake evidence is absent or incomplete, return `gaps` with exact missing fields so the workflow re-enters intake.
