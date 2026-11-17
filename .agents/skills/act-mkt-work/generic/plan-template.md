# Work plan

Lead with a one-sentence outcome. Use compact tables for acceptance criteria, tasks, validation and risks; short bullets for remaining details. Include an overall architecture and data-flow Mermaid diagram or picture. Keep every required field and machine-readable block in this saved artifact; link supporting evidence instead of repeating it. Present the acceptance criteria, architecture/data-flow visual, TDD overview bullets, separate E2E verification methods list and exact decision in the review conversation; the execution appendix is supporting detail, not the review surface.

## Goal/Acceptance Criteria
<Current requested outcome and observable completion criteria, including relevant conditions and affected consumers.>

## Flow
<Required overall architecture and data-flow Mermaid diagram or picture showing relevant entry points, components, interfaces/dependencies, data stores where applicable, and data movement through the affected path. If Mermaid cannot render, include a picture; prose or task dependencies alone do not replace this visual.>

## Decision to approve
<Recommended choice, material alternatives/risks and the exact scoped implementation, validation and publication actions approval permits. List unresolved user choices without burying them in the execution appendix.>

## Non Goal
<Scope boundaries and behavior outside this change.>

## Implementation Steps and Tests
<Scoped changes and applicable repository guidance. Record candidate paths/symbols, fit or gap, reuse/extension/new-code decision, and owning responsibilities. Group coherent tasks and explain independence or necessary serialization.>

### TDD overview

- <Behavior/contract and unit-test coverage required for each code/behavior change, with established test commands.>
- <Red: intended failing test; green: implementation; refactor/check: cleanup and passing tests where TDD is useful. Unit tests remain mandatory when a forced TDD cycle has no benefit.>
- <Independent task groups whose test/implementation cycles can run in parallel; prerequisites that must finish first and shared files/resources that require sequencing. State why work is sequential when no tasks are independent.>
- <For docs/config-only work, relevant validation and why no unit tests or forced red-green cycle apply.>

| Task / deliverable | Depends on | Exclusive writable paths | Interface prerequisites | Checks / exclusive resources | Testing approach and rationale | Concurrency group |
| --- | --- | --- | --- | --- | --- | --- |
| <ID and coherent result> | <IDs or none> | <paths owned by this task> | <stable contracts or prerequisite results> | <commands, shared services/build outputs, combined reruns> | <TDD with benefit, or relevant validation> | <ready together or sequential reason> |

<Parent scheduling: normally 2–3 independent ready workers, bounded by runtime capacity; parent owns shared-file integration and Git/index mutations. Record any explicit test mandates.>

## Validation
### E2E verification methods

<List all applicable E2E methods through real local entry points, separately from unit/TDD and other checks. Include the happy path and 1–2 relevant edge cases; cover both variants for experiments. Plan API request/response captures or UI screenshots under `<workspace.root>/.artifacts/`, attached/linked from verification results. Unit tests, mocks, static checks and CI alone do not satisfy E2E evidence.>

| Method / acceptance criteria | Local setup / real entry point | Inputs / actions | Expected observable result | Evidence to capture |
| --- | --- | --- | --- | --- |
| <Scenario and AC IDs> | <Startup command, prerequisites, local API or rendered UI> | <Executable request or browser interaction> | <Response/status, rendered behavior or actual downloaded bytes/format> | <Request/response capture or UI screenshot path> |

<For docs/config-only changes with no runnable feature, explain why product E2E captures do not apply and specify a workflow/example walkthrough instead.>

### Other required checks and limitations

<Unit-test coverage and commands are recorded in `Implementation Steps and Tests`. Retain any integration, static, build and applicable current-source CI checks here, separate from the E2E list. Record the artifact/revision/environment checked and explicit waivers/limitations; reuse valid evidence and rerun checks invalidated by later changes.>

## Risks/Decisions Needed
<Material risks, required prerequisites with confirmed readiness or remaining assumptions, user-answerable decisions/actions, and required authorizations.>

## Publications Contract/Metadata
<Authorized commit/push/review actions and exact publication content/fields, or local-only restrictions; observed host, branches and template.>

## Execution appendix (machine-readable)
<Concrete worker/check/publication commands and verified repository identities. Retain current scope/decisions, approval or scoped exception evidence, completed actions and remaining work in one task record. An approved existing context retains its actual paths and relevant prior edits; the layout below is the new-workspace default.>

```yaml
workspace: {launchDirectory: <absolute-invoking-cwd>, workId: <ticket-id-or-short-summary>, workIdSource: <tracker-or-summary>, root: <launchDirectory/workId>}
repositories:
  - {name: <unique-name>, role: primary, origin: <url>, primaryCheckout: <existing-clone-or-null>, cwd: <root/name>, baseBranch: <branch>, baseHead: <sha>, sourceBranch: <branch>}
  - {name: <unique-name>, role: editable, origin: <url>, primaryCheckout: <existing-clone-or-null>, cwd: <root/name>, baseBranch: <branch>, baseHead: <sha>, sourceBranch: <branch>}
  - {name: <unique-name>, role: reference, origin: <url>, primaryCheckout: <existing-clone-or-null>, cwd: <root/name>, rev: <pinned-sha>}
publication:
  repositories: [<per-repository actions, source/target identities, title/template and authorization>]
contextArtifact: <root/.task-context.json>
cleanupLedger: <absolute-ledger-path>
reviews: [<canonical URL, host/project/number, sourceOrigin/targetOrigin, sourceBranch/sourceHead, target branch, taskContext path, known execution workspace/session/host/thread references or null, confirmed commit/push/CI/reply IDs>]
```

Preserve this complete task record and its absolute artifact path across conversations for `act-mkt-mr-comment`; that workflow reuses the root and repository bindings. Store the helper input as JSON using the schema in [Task workspace](task-workspace.md); YAML above is the plan presentation, not helper input.
