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

Include an overall architecture and data-flow Mermaid diagram or picture in `Flow`. Show the relevant entry points, components, interfaces/dependencies, data stores where applicable, and data movement through the affected path. A task dependency diagram or prose alone is insufficient. If Mermaid cannot render, include a picture instead.

Start `Implementation Steps and Tests` with short TDD overview bullets: the behavior/contract each task will test, intended failing test (red), implementation (green), and refactor/check steps where TDD is useful. Identify tasks whose cycles can run in parallel and the prerequisites that force sequencing; justify sequential work when none is independent. Include an execution table in `Implementation Steps and Tests`: task ID and coherent deliverable, dependencies, exclusive writable paths, interface prerequisites, verification commands, testing approach with rationale, and intended concurrency group. Plan for 2–3 concurrent ready implementers within available runtime capacity. Establish changing shared contracts before their consumers; serialize overlapping paths or shared check resources. Group small related edits rather than creating a worker per tiny edit. If work is tightly coupled, state why sequential execution is appropriate. The parent owns shared-file integration and Git/index operations. Identify checks that need exclusive resources or a combined-tree rerun.

Require unit tests for every code/behavior change and record coverage and commands in `Implementation Steps and Tests`, outside the E2E methods list. Choose TDD where a failing behavioral test has an assessable benefit; mandatory unit tests do not imply blanket TDD. Mechanical docs/config-only edits use relevant validation without invented unit tests or a forced red-green cycle. Carry explicit user/repository testing mandates into the plan. Apply this skill’s execution policy rather than importing conflicting generic serial/TDD workflows.

Identify prerequisites needed for the requested result, their verified readiness or remaining assumptions, and any user action needed before dependent work. Check affected interfaces and consumers at revisions and conditions relevant to the intended use. Keep these checks scoped; optional unavailable evidence is a limitation, not automatically a blocker.

In `Validation`, list all applicable E2E verification methods separately from unit/TDD and other required checks. Map each method to acceptance criteria, local startup/setup prerequisites, real entry point, inputs/actions, expected observable result, and planned evidence path under `<workspace.root>/.artifacts/`. Exercise the local app/API with executable requests or render and interact with the changed UI; capture API requests/responses or UI screenshots as appropriate and attach/link that evidence in the verification results. Cover the happy path and 1–2 relevant edge cases, including both variants for experiments. For changed UI/save flows, inspect actual downloaded bytes/format. Unit tests, mocks, static checks and CI alone are not E2E evidence. For docs/config-only changes without a runnable feature, explain why E2E captures do not apply and plan a workflow/example walkthrough instead. Match assertions to the test layer, preserve repository test layout, and use established commands rather than inventing new tooling.

Branch: `<type>/<KEY>` or `<type>/<semantic-kebab-summary>`. No random suffix or run id.

Workspace: `workspace.workId` is the tracker key exactly as returned (e.g. `ACTMKT-123`, `ENG-42`; with several keys use the primary one named in the request), or a short descriptive kebab-case requirement summary when no key is present. Set `workIdSource: tracker` or `summary`; do not use opaque IDs, timestamps or branch-type prefixes. For new work, `workspace.root` is `<captured-launchDirectory>/<workId>`, independent of the directory from which stage/helper commands run. An explicit user location overrides this default. Preserve the actual root and paths for an explicitly approved existing context or continuation. List every affected repository in `repositories[]`: the coordinating repository is `primary`, other changed repositories are `editable`, and evidence-only repositories are `reference`. Each changed repository gets its own branch worktree and observed base/source identity; references are read-only at pinned SHAs. Use distinct names for equal repository basenames. Record evidence for inclusion, existing clone or missing-clone acquisition, guidance, base/head, scoped paths and checks for each repository. Include per-repository commit/push/review authorizations in `publication.repositories[]`; discovery is not publication authority. Put the complete manifest and handoff fields in the Execution appendix.

Before `ready`, put every user-answerable missing fact, decision, required authorization, and publication choice in the artifact's `Risks/Decisions Needed` section. Do not ask these separately or invent answers. Approval feedback returns to this plan stage and the artifact is re-presented at the same review gate.

Prepare the conversation review using the [approval procedure](../generic/approval-review.md): outcome, observable acceptance criteria, architecture/data-flow visual, TDD overview bullets with parallel groups/dependencies, separate E2E verification methods list, and exact decision. Display all these elements in the active conversation; keep the detailed task table, check commands and execution appendix in the linked complete artifact.

`ready`: the complete plan artifact and publication metadata, including all open decision questions, are ready for review.
`gaps`: intake evidence is incomplete; name the missing fields.
`handoff`: actionable planning work remains and requires no user input.
`blocked`: required evidence or authority is unavailable, contradictory, or unsafe to assume. Report the exact factual blocker in `remaining` without asking a question. Put user-answerable decisions in the plan artifact for review instead.

When Intake evidence is absent or incomplete, return `gaps` with exact missing fields so the workflow re-enters intake.
