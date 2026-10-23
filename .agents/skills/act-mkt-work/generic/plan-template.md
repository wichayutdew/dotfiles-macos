# Work plan

## Goal/Acceptance Criteria
<Requested outcome and observable completion criteria.>

## Non Goal
<Scope boundaries and behavior outside this change.>

## Implementation Steps and Tests
<Scoped changes and existing code to reuse. Group coherent tasks and explain independence or necessary serialization.>

| Task / deliverable | Depends on | Exclusive writable paths | Interface prerequisites | Checks / exclusive resources | Testing approach and rationale | Concurrency group |
| --- | --- | --- | --- | --- | --- | --- |
| <ID and coherent result> | <IDs or none> | <paths owned by this task> | <stable contracts or prerequisite results> | <commands, shared services/build outputs, combined reruns> | <TDD with benefit, or relevant validation> | <ready together or sequential reason> |

<Parent scheduling: normally 2–3 independent ready workers, bounded by runtime capacity; parent owns shared-file integration and Git/index mutations. Record any explicit test mandates.>

## Validation
<Acceptance verification, applicable current-source CI, and any explicit waivers/limitations.>

## Risks/Decisions Needed
<Material risks, user-answerable missing facts/decisions, and required authorizations.>

## Publications Contract/Metadata
<Authorized commit/push/review actions and exact publication content/fields, or local-only restrictions; observed host, branches and template.>

## Execution appendix (machine-readable)
<Concrete worker/check/publication commands and verified repository identities.>

```yaml
workspace: {workId: <tracker-key-or-branch-derived-id>, workIdSource: <tracker-or-branch>, root: <absolute-ticket-root>}
repositories:
  - {name: <repo>, role: primary, origin: <url>, primaryCheckout: <existing-checkout-or-null>, cwd: <ticket-root/repo>, baseBranch: <branch>, baseHead: <sha>, sourceBranch: <branch>}
  - {name: <repo>, role: reference, origin: <url>, cwd: <ticket-root/repo>, rev: <sha-or-ref>}
```
