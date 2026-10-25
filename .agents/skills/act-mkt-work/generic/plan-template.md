# Work plan

## Goal/Acceptance Criteria
<Current requested outcome and observable completion criteria, including relevant conditions and affected consumers.>

## Non Goal
<Scope boundaries and behavior outside this change.>

## Implementation Steps and Tests
<Scoped changes and applicable repository guidance. Record candidate paths/symbols, fit or gap, reuse/extension/new-code decision, and owning responsibilities. Group coherent tasks and explain independence or necessary serialization.>

| Task / deliverable | Depends on | Exclusive writable paths | Interface prerequisites | Checks / exclusive resources | Testing approach and rationale | Concurrency group |
| --- | --- | --- | --- | --- | --- | --- |
| <ID and coherent result> | <IDs or none> | <paths owned by this task> | <stable contracts or prerequisite results> | <commands, shared services/build outputs, combined reruns> | <TDD with benefit, or relevant validation> | <ready together or sequential reason> |

<Parent scheduling: normally 2–3 independent ready workers, bounded by runtime capacity; parent owns shared-file integration and Git/index mutations. Record any explicit test mandates.>

## Validation
<Evidence required per acceptance criterion, the artifact/revision/environment checked, applicable current-source CI, and any explicit waivers/limitations. Reuse valid checks; rerun those invalidated by later changes.>

## Risks/Decisions Needed
<Material risks, required prerequisites with confirmed readiness or remaining assumptions, user-answerable decisions/actions, and required authorizations.>

## Publications Contract/Metadata
<Authorized commit/push/review actions and exact publication content/fields, or local-only restrictions; observed host, branches and template.>

## Execution appendix (machine-readable)
<Concrete worker/check/publication commands and verified repository identities. Retain current scope/decisions, approval or scoped exception evidence, completed actions and remaining work in one task record. An approved existing context retains its actual paths and relevant prior edits; the layout below is the new-workspace default.>

```yaml
workspace: {workId: <tracker-key-or-branch-derived-id>, workIdSource: <tracker-or-branch>, root: <absolute-ticket-root>}
repositories:
  - {name: <repo>, role: primary, origin: <url>, primaryCheckout: <existing-checkout-or-null>, cwd: <ticket-root/repo>, baseBranch: <branch>, baseHead: <sha>, sourceBranch: <branch>}
  - {name: <repo>, role: reference, origin: <url>, cwd: <ticket-root/repo>, rev: <sha-or-ref>}
```
