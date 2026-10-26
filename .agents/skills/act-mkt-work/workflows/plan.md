# Stage: plan

Build the plan with this skill’s [plan template](../generic/plan-template.md). The template defines the artifact structure; this prompt defines how to produce it.

Use the invoking request and complete source evidence, inline or through the evidence references defined in SKILL.md.

---

Plan the work from intake. Read-only for product code: do not create editable branches/worktrees before approval. Discover all affected repositories from complete Jira/Linear/direct requirements, linked reviews and verified interfaces/consumers using [task workspace](../generic/task-workspace.md). Inspect local clones with `rg`; discovery clones belong under `<workspace.root>/.sources/<unique-name>`, never at the future worktree paths. Honor explicitly bound existing contexts without syncing or switching them.

Authoritative work request: `the invoking request and current task record, including later user steering`
Intake/recovery handoff: `{{last.summary}}`
Rejected plan: `{{gate.artifact}}`
Feedback: `{{gate.feedback}}`

Bind the intended working context and any approved existing work before selecting defaults. Inspect origin, base HEAD, target branch, and the host description template (`rg --files <repo> | rg -i 'merge_request_templates|pull_request_template'`). Base every planned change, validation command, and publication value on observed evidence.

Inspect the closest existing client/query, utility, service, test and verification command before proposing another one. State what will be reused/extended and why any new abstraction is needed. Record applicable repository guidance and the owning responsibility for each changed area. Preserve the user's explicit semantics and numeric/operational bounds; do not add speculative guarantees.

Include an execution table in `Implementation Steps and Tests`: task ID and coherent deliverable, dependencies, exclusive writable paths, interface prerequisites, verification commands, testing approach with rationale, and intended concurrency group. Plan for 2–3 concurrent ready implementers within available runtime capacity. Establish changing shared contracts before their consumers; serialize overlapping paths or shared check resources. Group small related edits rather than creating a worker per tiny edit. If work is tightly coupled, state why sequential execution is appropriate. The parent owns shared-file integration and Git/index operations. Identify checks that need exclusive resources or a combined-tree rerun.

Choose TDD where a failing behavioral test has an assessable benefit; mechanical docs/config edits use relevant validation without a forced red-green cycle. Carry explicit user/repository testing mandates into the plan. Apply this skill’s execution policy rather than importing conflicting generic serial/TDD workflows.

Identify prerequisites needed for the requested result, their verified readiness or remaining assumptions, and any user action needed before dependent work. Check affected interfaces and consumers at revisions and conditions relevant to the intended use. Keep these checks scoped; optional unavailable evidence is a limitation, not automatically a blocker.

Map each contract change to observable acceptance and verification: executable API/request collections and realistic response fixtures where applicable; browser interaction and actual downloaded bytes/format for changed UI/save flows. Match assertions to the test layer, preserve repository test layout, and use established commands rather than inventing new tooling.

Branch: `<type>/<KEY>` or `<type>/<semantic-kebab-summary>`. No random suffix or run id.

Workspace: `workspace.workId` is the tracker key exactly as returned (e.g. `ACTMKT-123`, `ENG-42`; with several keys use the primary one named in the request), or a short descriptive kebab-case requirement summary when no key is present. Set `workIdSource: tracker` or `summary`; do not use opaque IDs, timestamps or branch-type prefixes. For new work, `workspace.root` is `<captured-launchDirectory>/<workId>`, independent of the directory from which stage/helper commands run. An explicit user location overrides this default. Preserve the actual root and paths for an explicitly approved existing context or continuation. List every affected repository in `repositories[]`: the coordinating repository is `primary`, other changed repositories are `editable`, and evidence-only repositories are `reference`. Each changed repository gets its own branch worktree and observed base/source identity; references are read-only at pinned SHAs. Use distinct names for equal repository basenames. Record evidence for inclusion, existing clone or missing-clone acquisition, guidance, base/head, scoped paths and checks for each repository. Include per-repository commit/push/review authorizations in `publication.repositories[]`; discovery is not publication authority. Put the complete manifest and handoff fields in the Execution appendix.

Before `ready`, put every user-answerable missing fact, decision, required authorization, and publication choice in the artifact's `Risks/Decisions Needed` section. Do not ask these separately or invent answers. Approval feedback returns to this plan stage and the artifact is re-presented at the same review gate.

`ready`: the complete plan artifact and publication metadata, including all open decision questions, are ready for review.
`gaps`: intake evidence is incomplete; name the missing fields.
`handoff`: actionable planning work remains and requires no user input.
`blocked`: required evidence or authority is unavailable, contradictory, or unsafe to assume. Report the exact factual blocker in `remaining` without asking a question. Put user-answerable decisions in the plan artifact for review instead.

When Intake evidence is absent or incomplete, return `gaps` with exact missing fields so the workflow re-enters intake.
