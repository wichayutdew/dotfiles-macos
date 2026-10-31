# Review-comment plan

Lead with the response/fix summary. Use compact tables for comment verdicts, fix groups and validation; short bullets for reasoning. Add a small Mermaid diagram when dependencies or interactions need explanation. Preserve exact replies and machine-readable fields.

## Comments
<Canonical review and source repository identity, native comment/discussion identity and anchor, evidence, implement/decline/already-addressed verdict, reasoning, and exact actionable reply. No new reply for already-addressed entries.>

## Implementation plan
<Inherited work task directory and repository manifest; coherent fix groups, repository-qualified scoped paths, applicable repository guidance, existing candidate paths/symbols and reuse decisions, owning responsibilities and dependencies; or no code change with rationale. Record prerequisites/readiness, affected consumers/conditions, exclusive ownership and independent groups where relevant.>

## Validation
<Proportionate checks and rationale per changing group, artifact/revision/environment and expected evidence, applicable required CI for authorized code delivery, explicit waivers, and local-only restrictions. Reuse valid results and rerun checks invalidated by later edits.>

## Execution appendix (machine-readable)
<Inherited workspace launchDirectory/workId/workIdSource/root, manifest path, cleanup ledger, per-repository origin/cwd/role/branch/base/head and verbatim dirty baseline; review source/target identities, known prior edits, repository-qualified scoped paths, worker/check commands, and enabled/disabled delivery actions. Retain the active task’s current scope/decisions, approval or scoped exception evidence, completed actions and remaining work.>

<Per-repository publication commit subject, source origin/branch, authorized non-force push and required CI; replies carry canonical review identity, native parent IDs, reply types and exact bodies. Carry forward existing commit/push/review/reply IDs rather than treating this skill as a new publication run. Any missing-resource recovery is explicit and uses the inherited paths after approval.>

```yaml
workspace: {launchDirectory: <original-absolute-launch-directory>, workId: <ticket-ID-or-short-summary>, workIdSource: <tracker-or-summary>, root: <inherited-absolute-root>}
taskContext: <inherited-root>/.task-context.json
manifest: <absolute-manifest-path>
mechanicalState: <inherited-root>/.task-workspace.json
cleanupLedger: <inherited-ledger-path>
repositories:
  - {name: <repo>, role: primary, origin: <source-origin>, primaryCheckout: <backing-checkout-or-null>, cwd: <inherited-repo-cwd>, baseBranch: <branch>, baseHead: <sha>, sourceBranch: <existing-review-source-branch>, head: <current-local-sha>, dirtyBaseline: <verbatim-status>}
reviews:
  - {url: <canonical-review-url>, repository: <repo-name>, sourceOrigin: <source-origin>, targetOrigin: <target-origin>, sourceBranch: <branch>, sourceHead: <fetched-sha>}
publication:
  repositories: [] # Approved code-delivery actions keyed by repository/review.
  replies: [] # Canonical review plus native parent ID, reply type and exact body.
completedActions: [] # Confirmed IDs carried from work and earlier comment passes.
unconfirmedActions: []
```
