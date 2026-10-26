# Task workspace

## Requirement and repository discovery

Capture the absolute invoking directory before any `cd` or worker dispatch. A skill can be invoked from a non-Git directory or an unrelated checkout. Read the complete Jira/Linear issue and required linked sources, or retain the direct user requirement. Determine affected repositories from explicit repository/review URLs, existing project guidance, dependency and consumer evidence, verified local origins, and available host metadata. Search code only through local clones with `rg`. Do not guess a repository or default to the launch checkout; put unresolved identity/base decisions in the plan gate.

For new work, create `<launchDirectory>/<workId>/`: use the ticket ID itself when present (e.g. `ACTB-3022`), otherwise a short descriptive kebab-case summary (e.g. `improve-offer-cache`). Do not add branch prefixes, timestamps or opaque run IDs to this directory name. An explicit user path overrides this default; continuations retain their recorded absolute root. Within it use distinct repository names, including namespace/host qualifiers when basenames collide.

Every repository needing changes gets a `primary` or `editable` branch worktree. `primary` is only the coordinating designation, not the only editable repository. Repositories used solely as evidence are `reference` and stay pinned/read-only. Verify each repository's origin and actual base branch/SHA, and inspect its applicable guidance and checks. Use a verified existing local clone as backing storage without changing its checkout. If none exists, acquire a backing clone at `<root>/.sources/<name>`; discovery clones use that same separate area so they cannot occupy future worktree paths. Never treat a direct clone or detached checkout as the final editable worktree.

## Manifest and preparation

Save the initial approved JSON manifest outside the new task root (for example beside the reviewed plan), leaving only discovery clones in `.sources` before first preparation, and invoke the helper by absolute path:

```bash
python3 /absolute/skill/scripts/task-workspace.py /absolute/workspace-manifest.json
python3 /absolute/skill/scripts/task-workspace.py /absolute/workspace-manifest.json --check
```

Example shape (replace example identities/revisions with verified values):

```json
{
  "workspace": {"launchDirectory": "/projects", "workId": "ACTB-3022", "workIdSource": "tracker", "root": "/projects/ACTB-3022"},
  "repositories": [
    {"name": "api", "role": "primary", "origin": "git@example.com:team/api.git", "primaryCheckout": "/clones/api", "cwd": "/projects/ACTB-3022/api", "baseBranch": "main", "baseHead": "<verified-sha>", "sourceBranch": "feat/ACTB-3022"},
    {"name": "ui", "role": "editable", "origin": "git@example.com:team/ui.git", "primaryCheckout": null, "cwd": "/projects/ACTB-3022/ui", "baseBranch": "main", "baseHead": "<verified-sha>", "sourceBranch": "feat/ACTB-3022"},
    {"name": "contracts", "role": "reference", "origin": "git@example.com:team/contracts.git", "primaryCheckout": null, "cwd": "/projects/ACTB-3022/contracts", "rev": "<verified-sha>"}
  ]
}
```

The helper creates real linked worktrees, records its mechanical state in `<root>/.task-workspace.json`, and prints actual repository heads, branches and dirty baselines plus the cleanup ledger. Register new backing clones/worktrees; do not enroll reused existing clones. Retain partial progress and retry the same manifest after resolving a factual conflict. `--check` reads existing state without fetching, creating, switching, registering or updating state. Compare actual heads/dirty baselines with the task checkpoint as well: local approved progress is different from an external contributor moving the source. Validate origin, branch/base ancestry and pinned reference SHA for every entry. Never reset/stash, overwrite collisions or steal a branch checked out elsewhere. After approval expands the affected repository set, unchanged existing bindings may be extended with new entries in the same root; never silently remove or rebind repositories. For approved reconstruction, retain `baseHead` as the original ancestry boundary and supply the verified recorded current `head` as the recovery starting commit. A missing worktree still reserved in Git is a branch-in-use conflict: reconcile only its precisely owned stale registration through the recovery plan, never broad pruning or forced branch reuse. The helper inherits the recorded cleanup ledger; conflicting overrides are rejected. An explicitly approved existing context outside this layout is validated in place instead of forced through the helper.

When the task root is nested in another Git checkout, keep all staging limited to approved paths in each bound repository. Never stage the generated task tree from the launch checkout or modify its ignore files implicitly.

## Work-to-comment handoff

The helper state is not the complete task record. Persist `<root>/.task-context.json` and carry its absolute path in the same session, including `workspace`, `repositories[]`, source/approval references, cleanup ledger, checks, per-repository publication actions and completed/unconfirmed IDs. Keep `reviews[]` with each canonical URL, host/project/number, sourceOrigin/targetOrigin, sourceBranch/sourceHead and target branch, plus confirmed commit/push/CI/reply IDs. Record actual heads and verbatim dirty baseline after each relevant stage.

`act-mkt-mr-comment` runs after this work creates the PR/MR. Its first action is to recover and validate this same task record and reuse its directory/worktrees, even when invoked elsewhere. Do not rename/recreate the root or switch branches to fit a new cwd. Preserve fork source identity separately from review target identity. Recover missing context from recorded artifacts and verified review identities; unresolved or unsafe bindings require the normal recovery/plan route before edits.
