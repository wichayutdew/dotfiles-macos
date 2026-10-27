---
name: act-mkt-mr-comment
description: Use when addressing, validating, or responding to PR or merge-request review feedback.
---

# MR Comment

Use absolute helper paths, or run `scripts/...` commands from this skill root (beside `SKILL.md`). Changing directories to run a helper does not change the inherited task workspace. Markdown links are relative to their containing document.

## Concise output

Lead each user-facing report or response with a concise summary; use short bullets where they make the result easier to scan. Keep decision-critical facts, evidence links, material limitations and required handoffs. Honor explicitly requested detail and required artifact or machine-readable formats; keep supporting evidence available without copying it wholesale into every deliverable.

## Local resources and cleanup

This package includes its own [local code access](generic/local-code-access.md), [host CLI](generic/host-cli.md), and [cleanup script and instructions](generic/cleanup.md); no sibling skill installation is required. Track every newly created clone/worktree. When the user says “clean everything up”, take the cleanup-only route and delete all tracked local resources, including recent clones, using the shipped cleanup helper. Carry the cleanup ledger path in every checkpoint; do not enroll reused existing checkouts.

## Workflow direction

Treat the invoking request and later user steering as the authoritative review-comment request. This skill follows `act-mkt-work` creating the PR/MR in the same session. First recover that work task's canonical `<root>/.task-context.json` checkpoint and [workspace manifest](generic/task-workspace.md): absolute task root, repository paths, source branches/heads, review URLs, dirty baselines, cleanup ledger and completed publication IDs. Reuse that same directory and its worktrees even when this skill is invoked from another directory. The launch directory is not repository or review identity evidence; do not create another task root or choose an unrelated checkout.

Derive current hosted-review and discussion evidence from the inherited record and explicit request. Jira/Linear records or direct user input supplement that record; use the named tracker connector for complete linked requirements when needed. Validate each source repository separately, including fork source versus target identities, and retain every affected repository in `repositories[]`. `primary` and `editable` repositories may receive approved fixes; `reference` repositories remain read-only. Missing or stale handoff evidence follows the workspace recovery procedure instead of silently inventing a workspace, review or branch.

Execute the linked stages sequentially and automatically. Carry the invoking request and complete source evidence forward using the continuation contract below. After each stage, immediately dispatch its declared outcome route without returning control to the user. `gaps` and `handoff` follow their declared recovery routes automatically.

Collect known user decisions, required authorizations and publication choices in the complete plan-review gate below. After approval, continue every authorized route without routine reconfirmation. If a new material decision or required user action prevents dependent work, raise only that item through the applicable review or clarification route and continue independent approved work. Preserve explicit user exceptions within their stated scope; changed assumptions follow the recovery contract below.

A `blocked` outcome is terminal only when safe continuation is impossible: report the factual blocker, never bypass required evidence, access, authority, or safety checks. Report recoverable stale evidence through the declared recovery route instead.

## Model selection and task delegation

- Use your judgment to choose an available model and supported thinking effort for each task, balancing complexity, quality, latency and cost. The stage table gives starting guidance, not eligibility requirements; adjust it when the task or results warrant it. Respect an explicit user model choice and actual runtime restrictions.
- The parent agent coordinates the workflow. Spawn a fresh subagent for each bounded task, including stage work, implementation slices, reviews and recovery tasks. This skill authorizes task delegation; it does not approve a plan or authorize publication. A worker assigned a bounded task completes it and returns evidence to the parent rather than recursively spawning a replacement for itself.
- When model selection is exposed, choose a suitable model from the available options. When model selection or parent-model introspection is unavailable, launch the subagent with its configured/default model and continue. An unknown parent model, unavailable tier catalog or inability to switch models inline is not a blocker. Do not claim a model identity or tier was verified when it was not.
- If subagent tools are unavailable or dispatch fails, continue the task inline using the available model and briefly record the fallback. Report a blocker only when a real task prerequisite, runtime restriction or required authorization prevents safe progress.
- Give each worker the original request, bounded scope, applicable stage prompt, approved plan and approval evidence when required, `workspace.root` and `repositories[]` (cwd/origin/base/head), review identities, full-source references, relevant checks and expected outcome. The parent dispatches subsequent routes and remains accountable for reviewing diffs, checking evidence and reporting results.
- Run independent tasks concurrently when they can avoid conflicting edits; run dependent stages and tasks sequentially. Preserve the approval gates, workspace restrictions and publication contract across every handoff.

## Fix execution policy

Group related fixes into coherent tasks with scoped paths, applicable repository guidance, dependencies and a testing rationale. Use regression tests where they establish the correction and relevant existing validation for mechanical changes. Honor explicit test requirements and waivers. Run independent ready groups concurrently within runtime capacity, with exclusive file ownership and no conflicting check resources; serialize shared interfaces, resources and mutations. The parent owns integration and Git/index operations, reviews the combined result and reruns checks invalidated by later changes.

## Continuation and recovery

- Keep one resumable task record in the conversation or an approved artifact: current requirements and boundaries, accepted decisions, stage, canonical plan/version or digest, explicit approval evidence, `workspace.root` and `repositories[]` (cwd/origin/base/head), review identities, dirty baselines and inherited cleanup ledger, full-source references, checks, completed/unconfirmed action IDs and exact remaining work. Persist every comment-stage checkpoint back to the same `<root>/.task-context.json` and carry its absolute path in the session, preserving prior work and confirmed IDs. Keep the helper’s mechanical `<root>/.task-workspace.json` state separate; it is not a replacement for task context. Template variables denote those artifacts; they do not require a particular orchestrator.
- Complete evidence may be inline or in stable, readable full-content references. Preserve original source ordering and identities; read missing chunks/pages before deciding. A summary or truncated preview is not source proof. Carry references rather than duplicating entire diffs at every handoff.
- Resume the same approved artifact/scope and inherited task directory after compaction or continuation. Preserve the preceding work task’s checkpoint, commit/push/review IDs and all confirmed reply IDs; do not recreate resources or replay completed actions. Reconcile actual state first; consume an existing Plannotator result/process session before reopening. Feedback revises the same gate; approval advances execution without another nudge.
- Apply later user corrections and related additions to the same task record, scope, checks and publication contract. When another workflow becomes relevant, integrate its necessary steps into that task without restarting completed stages, duplicating active work or expanding authorization. An explicit instruction to make a small scoped fix directly takes precedence over a redundant skill gate. Revalidate base/head before edits and publication; refresh stale evidence. Re-present affected scope when requirements, verdicts, publication actions or base assumptions invalidate its approval; continue unaffected approved work when its prerequisites remain valid. A user-authorized rebase/continuation remains authorized.
- Follow declared recovery routes automatically. Retry transient failures with bounded backoff and retained progress; repeated failure without new evidence is a factual blocker. Reconcile ambiguous writes before retrying. Never turn recovery into authority for unrelated edits or remote actions.

## Stages

| Stage | Prompt | Model guidance | Thinking guidance | Outcomes |
| --- | --- | --- | --- | --- |
| fetch | [fetch.md](workflows/fetch.md) | fast economical | low | `ready` → checkout-source; `blocked` → terminal report; `handoff` → fetch |
| checkout-source | [checkout-source.md](workflows/checkout-source.md) | fast economical | low | `ready` → plan; `gaps` → fetch; `blocked` → terminal report; `handoff` → checkout-source |
| plan | [plan.md](workflows/plan.md) | strong reasoning | high | `ready` → plan review, then implement on approval; `done` → local report; `gaps` → fetch; `blocked` → terminal report; `handoff` → plan |
| implement | [implement.md](workflows/implement.md) | balanced | medium | `ready` → verify; `refresh` → fetch; `blocked` → terminal report; `handoff` → implement |
| verify | [verify.md](workflows/verify.md) | balanced | medium | `ready` → deliver; `gaps` → implement; `refresh` → fetch; `blocked` → terminal report; `handoff` → verify |
| deliver | [publish.md](workflows/publish.md) | fast economical | low | `ready` → done; `done` → local report; `gaps` → implement; `refresh` → fetch; `blocked` → terminal report; `handoff` → deliver |

## Comment-plan approval gate

Build the complete artifact using this skill’s [plan template](generic/plan-template.md), preserving its required headings and fields. Before `plan` continues with `ready`, present that full artifact for approval.

Obtain explicit human approval of the complete artifact before continuing. Include every current comment verdict, implementation choice, validation decision, and exact actionable publication reply in this artifact; do not ask separately. On denial or feedback, revise and re-present the artifact at this gate. After approval, continue under the task record and recovery rules above.

Follow this skill’s [approval review procedure](generic/plannotator-review.md) to present the complete artifact, await the final decision and take the next authorized action. It defines Plannotator execution, permitted fallback when tooling is absent, revision handling and approval scope. A running session or tool failure is not approval.
