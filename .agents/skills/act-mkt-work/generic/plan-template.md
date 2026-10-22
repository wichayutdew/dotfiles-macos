# Work plan

## Goal/Acceptance Criteria
<Requested outcome and observable completion criteria.>

## Non Goal
<Scope boundaries and behavior outside this change.>

## Implementation Steps and Tests
<Scoped changes, existing code to reuse, dependencies, and relevant local checks within the requested test scope.>

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
