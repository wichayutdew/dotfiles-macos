---
name: act-mkt-work
description: Use when implementing a feature, bug fix, or scoped software change from a request or tracker issue.
---

# Work

Run `scripts/...` commands from this skill root (beside `SKILL.md`) or use absolute paths. Markdown links are relative to their containing document.

## Concise output

Apply this format to plans, reports, reviews, replies and chat responses:

- Lead with the answer, verdict or decision in one short sentence.
- Prefer compact tables for comparisons, findings, tasks, risks and validation results; keep cells brief.
- Prefer a small Mermaid diagram for flows, dependencies or interactions when it makes the relationships clearer. If the destination cannot render Mermaid, use a concise numbered flow or bullets.
- Put necessary detail in short bullets, one point each. Use short prose only for nuance that needs it; keep simple answers to a sentence or a few bullets.
- Let each table or diagram replace the equivalent prose. Include only visuals that explain the content.
- Preserve technical facts, evidence links, material limitations, required handoffs and complete required artifact or machine-readable fields. Honor explicitly requested detail; link supporting evidence instead of repeating it. Use plain, concise language without requiring a separate brevity skill.

## Local resources and cleanup

This package includes its own [local code access](generic/local-code-access.md), [host CLI](generic/host-cli.md), and [cleanup script and instructions](generic/cleanup.md); no sibling skill installation is required. Track every newly created clone/worktree. When the user says “clean everything up”, take the cleanup-only route and delete all tracked local resources, including recent clones, using the shipped cleanup helper. Carry the cleanup ledger path in every checkpoint; do not enroll reused existing checkouts.

## Workflow direction

Treat the invoking request and later user steering as the authoritative work request. Capture the absolute invocation directory before changing directories or running skill helpers. Derive repository, Git, tracker, and hosted-review context from complete requirements and verified repository identities; the launch directory may be non-Git or unrelated and is not repository authority. Inspect code, in this or any other repository, only through local clones searched with `rg` per [Local code access](generic/local-code-access.md). Use `glab`/`gh` for every MR/PR and CI read or write per [Host CLI](generic/host-cli.md). For new work, create `<invocation-directory>/<ticket-ID-or-short-summary>/` with one branch worktree per repository requiring changes, using [task workspace](generic/task-workspace.md) and [prepare-workspace](workflows/prepare-workspace.md). Use the ticket ID itself when present, otherwise a short descriptive summary; keep branch prefixes out of directory names. Honor explicit existing-context instructions and resume the recorded absolute paths. Save the complete work-to-comment handoff so `act-mkt-mr-comment` in the same session reuses this directory and its worktrees after the PR/MR is created.

Execute the linked lifecycle stages in order and automatically; within implementation, schedule independent tasks concurrently using this skill’s execution policy below. Carry the invoking request and complete source evidence forward using the continuation contract below. After each stage, immediately dispatch its declared outcome route without returning control to the user. `gaps` and `handoff` follow their declared recovery routes automatically.

Collect known user decisions, required authorizations and publication choices in the complete plan-review gate below. After approval, continue every authorized route without routine reconfirmation. If a new material decision or required user action prevents dependent work, raise only that item through the applicable review or clarification route and continue independent approved work. Preserve explicit user exceptions within their stated scope; changed assumptions follow the recovery contract below.

A `blocked` outcome is terminal only when safe continuation is impossible: report the factual blocker, never bypass required evidence, access, authority, or safety checks. Report recoverable stale evidence through the declared recovery route instead.

## Model selection and task delegation

- Use your judgment to choose an available model and supported thinking effort for each task, balancing complexity, quality, latency and cost. The stage table gives starting guidance, not eligibility requirements; adjust it when the task or results warrant it. Respect an explicit user model choice and actual runtime restrictions.
- The parent agent coordinates the workflow. Spawn a fresh subagent for each bounded task, including stage work, implementation slices, reviews and recovery tasks. This skill authorizes task delegation; it does not approve a plan or authorize publication. A worker assigned a bounded task completes it and returns evidence to the parent rather than recursively spawning a replacement for itself.
- When model selection is exposed, choose a suitable model from the available options. When model selection or parent-model introspection is unavailable, launch the subagent with its configured/default model and continue. An unknown parent model, unavailable tier catalog or inability to switch models inline is not a blocker. Do not claim a model identity or tier was verified when it was not.
- If subagent tools are unavailable or dispatch fails, continue the task inline using the available model and briefly record the fallback. Report a blocker only when a real task prerequisite, runtime restriction or required authorization prevents safe progress.
- Give each worker the original request, bounded scope, applicable stage prompt, approved plan and approval evidence when required, `workspace.root` and `repositories[]` (cwd/base/head), full-source references, relevant checks and expected outcome. The parent dispatches subsequent routes and remains accountable for reviewing diffs, checking evidence and reporting results.
- Run independent tasks concurrently when they can avoid conflicting edits; run dependent stages and tasks sequentially. Preserve the approval gates, workspace restrictions and publication contract across every handoff.

## Implementation execution policy

This skill supplies the complete scheduling, testing and review policy for its stages. Use it directly rather than importing a generic implementation workflow that requires serial implementers, a review gate before each next task, one-feature handoffs, or blanket TDD. Explicit user and repository requirements remain binding; include any required exceptions or decisions in the plan gate.

- Plan tasks with dependencies, exclusive writable paths, stable interface prerequisites, verification commands and a testing rationale. Group small related edits into coherent tasks; parallelize only genuinely independent work.
- After approval and workspace preparation, the parent normally runs 2–3 ready implementation workers concurrently, bounded by available runtime capacity. A task is ready when its prerequisites are verified and its writable paths, interface changes and check resources do not conflict with running tasks. Keep coupled work sequential; an independent task can run while another task is reviewed.
- Give each worker exclusive file ownership inside the approved `primary` and `editable` repository worktrees, qualified by repository name. The parent owns shared-file integration and Git/index mutations. Reference repositories remain read-only. Workers report changed paths and verification evidence; the parent reconciles the combined tree before independent verification.
- Choose TDD for behavioral changes where a failing test usefully proves the intended correction or contract. Mechanical documentation/configuration edits use relevant validation; do not invent tests, force a red-green cycle, or request a routine TDD exception for them. Record the choice and assessable benefit per task. Honor explicit user/repository test requirements.
- Review task results as they arrive, keep unrelated ready work moving, and run the required combined verification after integration. Do not impose a new human approval gate between approved tasks. Preserve the existing plan and publication gates.

## Continuation and recovery

- Keep one resumable task record in the conversation or an approved artifact: current requirements and boundaries, accepted decisions, stage, canonical plan/version or digest, explicit approval evidence, `workspace.launchDirectory`/`workId`/`root`, `repositories[]` (absolute cwd/origin/backing checkout/base/source branch/head/dirty baseline), cleanup ledger, full-source references, checks, per-repository publication and review identities, completed/unconfirmed action IDs and exact remaining work. Persist the resumable handoff at `<workspace.root>/.task-context.json` and carry its absolute path in the session; update it after workspace preparation and every delivery/continuation checkpoint. Include `reviews[]` with canonical URL, host/project/number, sourceOrigin/targetOrigin, sourceBranch/sourceHead, and confirmed commit/push/reply/CI IDs. This is the starting context for the subsequent `act-mkt-mr-comment` run, even when invoked from a different directory. Template variables denote those artifacts; they do not require a particular orchestrator.
- Complete evidence may be inline or in stable, readable full-content references. Preserve original source ordering and identities; read missing chunks/pages before deciding. A summary or truncated preview is not source proof. Carry references rather than duplicating entire diffs at every handoff.
- Resume the same approved artifact/scope after compaction or continuation. Reconcile actual state first; consume an existing Plannotator result/process session before reopening. Feedback revises the same gate; approval advances execution without another nudge.
- Apply later user corrections and related additions to the same task record, scope, checks and publication contract. When another workflow becomes relevant, integrate its necessary steps into that task without restarting completed stages, duplicating active work or expanding authorization. An explicit instruction to make a small scoped fix directly takes precedence over a redundant skill gate. Revalidate base/head before edits and publication; refresh stale evidence. Re-present affected scope when requirements, verdicts, publication actions or base assumptions invalidate its approval; continue unaffected approved work when its prerequisites remain valid. A user-authorized rebase/continuation remains authorized.
- Follow declared recovery routes automatically. Retry transient failures with bounded backoff and retained progress; repeated failure without new evidence is a factual blocker. Reconcile ambiguous writes before retrying. Never turn recovery into authority for unrelated edits or remote actions.

## Stages

| Stage | Prompt | Model guidance | Thinking guidance | Outcomes |
| --- | --- | --- | --- | --- |
| intake | [intake.md](workflows/intake.md) | fast economical | low | `ready` → plan; `blocked` → terminal report; `handoff` → intake |
| plan | [plan.md](workflows/plan.md) | strong reasoning | high | `ready` → plan review, then prepare-workspace on approval; `gaps` → intake; `blocked` → terminal report; `handoff` → plan |
| prepare-workspace | [prepare-workspace.md](workflows/prepare-workspace.md) | fast economical | low | `ready` → implement; `gaps` → plan; `blocked` → terminal report; `handoff` → prepare-workspace |
| implement | [implement.md](workflows/implement.md) | balanced | medium | `ready` → verify; `refresh` → plan; `blocked` → terminal report; `handoff` → implement |
| verify | [verify.md](workflows/verify.md) | balanced | medium | `ready` → publish; `gaps` → implement; `blocked` → terminal report; `handoff` → verify |
| publish | [publish-remote.md](workflows/publish-remote.md) | fast economical | low | `ready` → done; `done` → local report; `gaps` → implement; `refresh` → plan; `blocked` → terminal report; `handoff` → publish |

## Plan approval gate

Build the complete artifact using this skill’s [plan template](generic/plan-template.md), preserving its required headings and fields. Before `plan` continues with `ready`, present that full artifact for approval.

Obtain explicit human approval of the complete artifact before continuing. Include every user-resolvable question, missing decision, and required authorization in this artifact; do not ask separately. On denial or feedback, revise and re-present the artifact at this gate. After approval, continue under the task record and recovery rules above.

Follow this skill’s [approval review procedure](generic/plannotator-review.md) to present the complete artifact, await the final decision and take the next authorized action. It defines Plannotator execution, permitted fallback when tooling is absent, revision handling and approval scope. A running session or tool failure is not approval.
