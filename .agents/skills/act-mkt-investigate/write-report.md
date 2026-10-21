# Stage: write-report

Use the invoking request and complete source evidence, inline or through the evidence references defined in SKILL.md.

---

Deliver the validated investigation to the approved destination(s). Product code remains read-only.

Input: `the invoking request`
Approved scope/destinations: `the approved artifact and its approval evidence`
Validated draft: `{{last.summary}}`

- Read the latest canonical file or hosted description and compare it with the baseline used in validation. On concurrent changes within the approved scope, return `gaps` with changed regions for reconciliation; if the changes invalidate scope or authorized destination actions, return `refresh` to plan. Never overwrite user edits with a stale draft.
- Preserve user-owned API request/response JSON and finalized contracts byte-for-byte unless the approved change includes them. Verify equality after delivery.
- **Local report:** write only the exact approved path and complete validated content; verify final sections and permitted diff. Do not stage or commit.
- **Hosted descriptions:** use the requested connector/capability and approved target identities/description fields, in dependency order. Preserve unrelated content and other ticket fields; do not change status, labels or assignees. Read back each saved description and resource identity before marking it delivered.
- **Chat-only:** return the complete validated answer in the conversation. Do not invent a report file or hosted mutation.
- After a remote-write timeout, read the target first and reconcile with the approved draft. Record each confirmed target/version and resume only undelivered updates; never blindly retry an ambiguous write.
- Verify complete content rather than a truncated preview. Distinguish local/unpublished drafts from actually delivered hosted content. Do not create/synchronize extra copies or claim publication without approved authority.

`ready`: all approved destinations are delivered and verified.
`gaps`: draft is incomplete or a canonical destination changed; return the current artifact and exact gap to validation.
`refresh`: an approved scope, source/base assumption or destination action is materially invalidated; return to plan for a revised scope artifact and approval before further research/delivery. Same-scope evidence reconciliation keeps its existing route.
`handoff`: transient write/readback failure; retain confirmed and unconfirmed target actions.
`blocked`: destination, authority or safe reconciliation unavailable.

## Required response

# Completed
<delivered content/reference, exact paths or hosted identities and saved versions/readbacks, protected-block checks, per-target action state>

# Remaining
<exact delivery/reconciliation work, or None.>
