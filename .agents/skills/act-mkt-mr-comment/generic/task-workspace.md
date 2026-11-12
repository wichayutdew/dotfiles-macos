# Recover or establish the review-comment workspace

## Recover a matching task across conversations

Before using the current directory, resolve the canonical review identity (host/project/number plus source/target identities) against the supplied durable review-to-task mapping, current conversation and explicitly recorded artifact paths. A scheduled run follows the same recovery contract as an interactive run. Read the matching `<root>/.task-context.json`; do not require that the original work ran in this conversation. Carry forward:

- `workspace.launchDirectory`, `workId`, `workIdSource` and absolute `root`; the root's existing ticket-ID or short-summary name stays unchanged.
- Every `repositories[]` entry: unique name, role, origin, backing checkout, actual cwd, base branch/SHA, source branch and current head, plus verbatim dirty baseline and known local progress.
- Review URL/host/project/number and source branch/head per repository. Keep fork `sourceOrigin` and `targetOrigin` distinct; fixes belong to the source origin/branch already backing that review.
- Cleanup ledger path, approved artifact/decisions, verified check revisions, completed/unconfirmed commit/push/review/reply IDs and exact remaining work.

The original work task creates `<captured-launch-directory>/<ticket-ID-or-short-summary>/`, with repository worktrees below it. This skill reuses that absolute root even from an unrelated or non-Git launch directory. Do not allocate another root, rename it, switch to a preferred fixed directory, or create replacement branches for existing reviews. An explicitly approved custom working context retains its actual paths.

Persist each fetch/checkout/plan/implementation/verification/delivery checkpoint to that same `.task-context.json`, preserving work-stage decisions and completed IDs. Carry its absolute path in the session so compaction does not turn a fresh invocation directory into a workspace choice. The helper owns `<root>/.task-workspace.json` for mechanical workspace state; that file is distinct from the richer task context and must not overwrite it.

## Validate without changing checkouts

For an already prepared helper-managed workspace, use this package’s helper with its absolute manifest path (unprepared standalone entries follow the preparation section below after approval):

```bash
python3 /absolute/path/to/act-mkt-mr-comment/scripts/task-workspace.py /absolute/task-manifest.json --check
```

`--check` performs no creation or fetch. Compare each reported origin, cwd, branch/head and dirty state with the handoff and fetched review identity. Approved local commits after the base are progress, not automatic scope drift. Read host state and fetch incoming source objects only in the retrieval/reconciliation stage; never use `repo-sync.sh`, checkout, reset, stash, clean or pull to make an inherited editable worktree match a fresh remote head. Preserve local work and distinguish verified local progress from outside commits.

The helper accepts JSON of this shape (use verified values):

```json
{
  "workspace": {
    "launchDirectory": "/absolute/original-launch-directory",
    "workId": "ACTB-3022",
    "workIdSource": "tracker",
    "root": "/absolute/original-launch-directory/ACTB-3022"
  },
  "repositories": [
    {
      "name": "service",
      "role": "primary",
      "origin": "git@example.com:team/service.git",
      "primaryCheckout": "/absolute/existing-service-clone",
      "cwd": "/absolute/original-launch-directory/ACTB-3022/service",
      "baseBranch": "main",
      "baseHead": "<verified-base-sha>",
      "sourceBranch": "feat/ACTB-3022"
    }
  ]
}
```

`primary` and `editable` entries are branch worktrees; `reference` entries are read-only and pinned with `rev`. Several editable repositories have independent bases, source branches, checks and publication actions. `primaryCheckout` is a verified backing checkout or null; missing backing clones use `<root>/.sources/<name>`. Repository names must be unique safe path segments. Manifest fields such as dirty baselines, current heads, review identities and publication IDs also travel in the task record even when not helper inputs.

## Recover a missing handoff or path

Search the current conversation, supplied durable routing mapping and explicitly referenced prior task artifacts first. If needed, inspect recorded task paths and match the canonical review/source identities; a basename or current directory alone is insufficient. Preserve partial preparation and existing resource ownership. Do not scan or modify unrelated checkouts as a substitute for identity evidence.

When a recorded resource is missing, establish its original root, origin, source branch/SHA, ownership and intended backing checkout before proposing reconstruction. Record the exact missing resources and any unresolved identity/branch collision decisions in the complete comment plan. After approval, the helper without `--check` may recreate only those approved missing resources at the inherited paths; it is not permission to create a new root or discard local progress. Keep the original `baseHead` and supply the verified recorded current `head` when approved reconstruction must preserve later commits. A missing worktree still reserved in Git remains a branch-in-use conflict until its precisely owned stale registration is reconciled through the recovery plan; never broad-prune or force branch reuse. The helper inherits the recorded cleanup ledger and rejects conflicting overrides. Register new backing clones/worktrees through the existing [cleanup mechanism](cleanup.md), and never enroll reused resources again. For incompatible custom contexts, validate/recover their actual recorded paths instead of forcing the default layout.

Unresolved source/workspace identity or an occupied branch/path is a factual blocker; do not steal branches, overwrite paths or guess a replacement review. Reconcile external source movement through fetch/plan recovery before dependent edits or publication. Keep independent safe work moving within the approved scope.

Keep new comment plans, evidence, replies and scratch artifacts in the inherited `<root>/.artifacts/`; retain the inherited ledger and all existing paths.

## Genuinely standalone feedback entry

This route applies only when the canonical MR identity is verified and the supplied records establish no prior work task or mapping. An unavailable mapped artifact is missing context, not proof that no task exists. If identity or the existence of prior work is ambiguous, ask for the specific missing reference and keep dependent edits blocked; do not scan unrelated checkouts or allocate a replacement root.

1. Capture the invocation directory and the verified review URL/source and target identities. Select one `<invocation-directory>/mr-<number>-follow-up/` root (a short unique review description when needed), respecting an explicit user location. Refuse collisions with an unidentified existing directory. Create the empty root, immediately register it with `python3 /absolute/skill/scripts/cleanup-workspaces.py register-root <root>`, then write `.task-context.json` with `entryMode: standalone`, the no-prior-context evidence, canonical review identity and cleanup ledger. Persist this mapping for future invocations.
2. Fetch the complete current review/discussions and obtain source evidence in a dedicated `<root>/.sources/` clone through [local code access](local-code-access.md). Record source/fork/target identity, current source head, base SHA and prior hosted replies. This is read-only planning evidence, never an editable workspace. The review request authorizes this inspection, not implementation or publication.
3. For a code-changing plan, define the future `repositories[]` and manifest using verified source identities, the existing review source branch and `<root>/<repo-name>` paths. Retain the original base ancestry boundary and recorded current source `head` when preparing an existing branch. Identify verified backing clones and any branch/path collisions. Show exact workspace preparation, scoped fixes, checks and publication actions in the complete comment plan. Do not create editable branches/worktrees before approval. For reply-only plans, record inspection repositories as pinned `reference` contexts and use null for an absent editable manifest/mechanical state; no editable worktree is needed.
4. After explicit approval, use this package's workspace helper for its supported `root = launchDirectory/workId` and `cwd = root/name` layout, or mechanically validate an explicitly approved custom layout. Register only newly owned resources. Preserve all canonical context/ledger/action IDs through implementation and delivery. Future runs recover this task; they never take the standalone route again for the same mapping.

Retain verified CodeMaster workspace/agent-session and Codex host/thread references when supplied; use null for unknown handles and no secrets. A scheduler keeps one writer per MR/task, retains pending approval across ticks and reconciles actual head/discussion/action state before redispatch. Another bot's interpretation or acknowledgment is not human approval. Do not silently change execution host or claim GUI visibility without evidence.
