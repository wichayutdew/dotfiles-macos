# Stage: plan

Use the invoking request and complete source evidence, inline or through the evidence references defined in SKILL.md.

---

Plan the work from intake. Read-only. Do not create a branch or worktree.

Authoritative work request: `the invoking request`
Intake/recovery handoff: `{{last.summary}}`
Rejected plan: `{{gate.artifact}}`
Feedback: `{{gate.feedback}}`

Inspect origin, base HEAD, target branch, and the host description template. Base every planned change, validation command, and publication value on observed evidence.

Inspect the closest existing client/query, utility, service, test and verification command before proposing another one. State what will be reused/extended and why any new abstraction is needed. Preserve the user's explicit semantics and numeric/operational bounds; do not add speculative guarantees.

Map each contract change to observable acceptance and verification: executable API/request collections and realistic response fixtures where applicable; browser interaction and actual downloaded bytes/format for changed UI/save flows. Match assertions to the test layer, preserve repository test layout, and use established commands rather than inventing new tooling.

Branch: `<type>/<KEY>` or `<type>/<semantic-kebab-summary>`. No random suffix or run id.

Before `ready`, put every user-answerable missing fact, decision, required authorization, and publication choice in the artifact's `Risks/Decisions Needed` section. Do not ask these separately or invent answers. Approval feedback returns to this plan stage and the artifact is re-presented at the same review gate.

`ready`: the complete plan artifact and publication metadata, including all open decision questions, are ready for review.
`gaps`: intake evidence is incomplete; name the missing fields.
`handoff`: actionable planning work remains and requires no user input.
`blocked`: required evidence or authority is unavailable, contradictory, or unsafe to assume. Report the exact factual blocker in `remaining` without asking a question. Put user-answerable decisions in the plan artifact for review instead.

When Intake evidence is absent or incomplete, return `gaps` with exact missing fields so the workflow re-enters intake.
