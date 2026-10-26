# Continue the work task workspace

## Bind the same session

`act-mkt-mr-comment` follows `act-mkt-work` creating a PR/MR. Before using the current directory, recover the preceding work checkpoint and its canonical `<root>/.task-context.json` from this conversation or its recorded absolute artifact path. Carry forward:

- `workspace.launchDirectory`, `workId`, `workIdSource` and absolute `root`; the root's existing ticket-ID or short-summary name stays unchanged.
- Every `repositories[]` entry: unique name, role, origin, backing checkout, actual cwd, base branch/SHA, source branch and current head, plus verbatim dirty baseline and known local progress.
- Review URL/host/project/number and source branch/head per repository. Keep fork `sourceOrigin` and `targetOrigin` distinct; fixes belong to the source origin/branch already backing that review.
- Cleanup ledger path, approved artifact/decisions, verified check revisions, completed/unconfirmed commit/push/review/reply IDs and exact remaining work.

The original work task creates `<captured-launch-directory>/<ticket-ID-or-short-summary>/`, with repository worktrees below it. This skill reuses that absolute root even from an unrelated or non-Git launch directory. Do not allocate another root, rename it, switch to a preferred fixed directory, or create replacement branches for existing reviews. An explicitly approved custom working context retains its actual paths.

Persist each fetch/checkout/plan/implementation/verification/delivery checkpoint to that same `.task-context.json`, preserving work-stage decisions and completed IDs. Carry its absolute path in the session so compaction does not turn a fresh invocation directory into a workspace choice. The helper owns `<root>/.task-workspace.json` for mechanical workspace state; that file is distinct from the richer task context and must not overwrite it.

## Validate without changing checkouts

For a helper-managed workspace, use this package's helper with its absolute manifest path:

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

Search the same session's prior task record and explicitly referenced artifacts first. If needed, inspect recorded task paths and match the canonical review/source identities; a basename or current directory alone is insufficient. Preserve partial preparation and existing resource ownership. Do not scan or modify unrelated checkouts as a substitute for identity evidence.

When a recorded resource is missing, establish its original root, origin, source branch/SHA, ownership and intended backing checkout before proposing reconstruction. Record the exact missing resources and any unresolved identity/branch collision decisions in the complete comment plan. After approval, the helper without `--check` may recreate only those approved missing resources at the inherited paths; it is not permission to create a new root or discard local progress. Keep the original `baseHead` and supply the verified recorded current `head` when approved reconstruction must preserve later commits. A missing worktree still reserved in Git remains a branch-in-use conflict until its precisely owned stale registration is reconciled through the recovery plan; never broad-prune or force branch reuse. The helper inherits the recorded cleanup ledger and rejects conflicting overrides. Register new backing clones/worktrees through the existing [cleanup mechanism](cleanup.md), and never enroll reused resources again. For incompatible custom contexts, validate/recover their actual recorded paths instead of forcing the default layout.

Unresolved source/workspace identity or an occupied branch/path is a factual blocker; do not steal branches, overwrite paths or guess a replacement review. Reconcile external source movement through fetch/plan recovery before dependent edits or publication. Keep independent safe work moving within the approved scope.
