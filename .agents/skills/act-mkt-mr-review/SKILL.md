---
name: act-mkt-mr-review
description: Use when reviewing a PR or merge request for introduced regressions, compatibility failures, security or data-loss risks, or performance degradation.
---

# MR Review

Run `scripts/...` commands from this skill root (beside `SKILL.md`) or use absolute paths. Markdown links are relative to their containing document.

## Local resources and cleanup

This package includes its own [local code access](generic/local-code-access.md), [host CLI](generic/host-cli.md), and [cleanup script and instructions](generic/cleanup.md); no sibling skill installation is required. Track every newly created clone/worktree. When the user says “clean everything up”, take the cleanup-only route and delete all tracked local resources, including recent clones, using the shipped cleanup helper. Carry the cleanup ledger path in every checkpoint; do not enroll reused existing checkouts.

## Workflow direction

Treat the invoking request and later user steering as the authoritative PR/MR review request. Derive the hosted-review URL, repository, branch, and discussion context from that request. Use `glab`/`gh` for every host read and write per [Host CLI](generic/host-cli.md). The skill runs from `~/repositories/mr-review/`, which is not the reviewed repository: get the reviewed repository and any other repository it needs under `~/repositories/mr-review/<repo-name>` per [Local code access](generic/local-code-access.md). Clones there are a reusable cache: leave them detached at the reviewed SHA, never edit them, and delete nothing unless the user asks.

Execute the linked stages sequentially and automatically. Carry the invoking request and complete source evidence forward using the continuation contract below. After each stage, immediately dispatch its declared outcome route without returning control to the user. `gaps` and `handoff` follow their declared recovery routes automatically.

Collect known user decisions, required authorizations and publication choices in the complete plan-review gate below. After approval, continue every authorized route without routine reconfirmation. If a new material decision or required user action prevents dependent work, raise only that item through the applicable review or clarification route and continue independent approved work. Preserve explicit user exceptions within their stated scope; changed assumptions follow the recovery contract below.

A `blocked` outcome is terminal only when safe continuation is impossible: report the factual blocker, never bypass required evidence, access, authority, or safety checks. Report recoverable stale evidence through the declared recovery route instead.

Review the current diff and connected code for demonstrated introduced failures or violations of its explicit contract. CI status is context only: do not poll CI, wait for green checks, or block review/comment publication on pending, failed, skipped, or unavailable CI. Publish only within the approved review contract.

## Model selection and task delegation

- Use your judgment to choose an available model and supported thinking effort for each task, balancing complexity, quality, latency and cost. The stage table gives starting guidance, not eligibility requirements; adjust it when the task or results warrant it. Respect an explicit user model choice and actual runtime restrictions.
- The parent agent coordinates the workflow. Spawn a fresh subagent for each bounded task, including stage work, implementation slices, reviews and recovery tasks. This skill authorizes task delegation; it does not approve a plan or authorize publication. A worker assigned a bounded task completes it and returns evidence to the parent rather than recursively spawning a replacement for itself.
- When model selection is exposed, choose a suitable model from the available options. When model selection or parent-model introspection is unavailable, launch the subagent with its configured/default model and continue. An unknown parent model, unavailable tier catalog or inability to switch models inline is not a blocker. Do not claim a model identity or tier was verified when it was not.
- If subagent tools are unavailable or dispatch fails, continue the task inline using the available model and briefly record the fallback. Report a blocker only when a real task prerequisite, runtime restriction or required authorization prevents safe progress.
- Give each worker the original request, bounded scope, applicable stage prompt, approved plan and approval evidence when required, local clone path/SHA, base/head, full-source references, relevant checks and expected outcome. The parent dispatches subsequent routes and remains accountable for reviewing diffs, checking evidence and reporting results.
- Run independent tasks concurrently when they can avoid conflicting edits; run dependent stages and tasks sequentially. Preserve the approval gates, workspace restrictions and publication contract across every handoff.

## Review focus

Find concrete introduced regressions and performance degradation by tracing the changed behavior against its baseline or explicit new-feature contract. Leave business preferences, style, naming and speculative architecture nits to the user. Validate impact and avoid duplicate root causes.

With no actionable findings, finish locally with the reviewed SHA, coverage and limits. No approval or summary publication is needed unless the user explicitly requested a published summary.

## Continuation and recovery

- Keep one resumable task record in the conversation or an approved artifact: current requirements and boundaries, accepted decisions, stage, canonical plan/version or digest, explicit approval evidence, local clone path/SHA, base/head, full-source references, checks, completed/unconfirmed action IDs and exact remaining work. Template variables denote those artifacts; they do not require a particular orchestrator.
- Complete evidence may be inline or in stable, readable full-content references. Preserve original source ordering and identities; read missing chunks/pages before deciding. A summary or truncated preview is not source proof. Carry references rather than duplicating entire diffs at every handoff.
- Resume the same approved artifact/scope after compaction or continuation. Reconcile actual state first; consume an existing Plannotator result/process session before reopening. Feedback revises the same gate; approval advances execution without another nudge.
- Apply later user corrections and related additions to the same task record, scope, checks and publication contract. When another workflow becomes relevant, integrate its necessary steps into that task without restarting completed stages, duplicating active work or expanding authorization. An explicit instruction to make a small scoped fix directly takes precedence over a redundant skill gate. Revalidate base/head before edits and publication; refresh stale evidence. Re-present affected scope when requirements, verdicts, publication actions or base assumptions invalidate its approval; continue unaffected approved work when its prerequisites remain valid. A user-authorized rebase/continuation remains authorized.
- Follow declared recovery routes automatically. Retry transient failures with bounded backoff and retained progress; repeated failure without new evidence is a factual blocker. Reconcile ambiguous writes before retrying. Never turn recovery into authority for unrelated edits or remote actions.

## Stages

| Stage | Prompt | Model guidance | Thinking guidance | Outcomes |
| --- | --- | --- | --- | --- |
| fetch | [fetch.md](workflows/fetch.md) | fast economical | low | `ready` → review; `blocked` → terminal report; `handoff` → fetch |
| review | [findings.md](workflows/findings.md) | strong reasoning | high | `ready` → plan; `gaps` → fetch; `blocked` → terminal report; `handoff` → review |
| plan | [plan.md](workflows/plan.md) | fast economical | low | `ready` → plan review, then publish on approval; `done` → local no-action report; `refresh` → fetch; `gaps` → review; `blocked` → terminal report; `handoff` → plan |
| publish | [publish-approved.md](workflows/publish-approved.md) | fast economical | low | `ready` → done; `done` → local report; `refresh` → fetch; `blocked` → terminal report; `handoff` → publish |

## Review approval gate

Build the complete artifact using this skill’s [plan template](generic/plan-template.md), preserving its required headings and fields. Before `plan` continues with `ready`, present that full artifact for approval.

Obtain explicit human approval of the complete artifact before continuing. Include all unresolved review decisions and exact publication actions in the artifact; do not ask separately. On denial or feedback, revise and re-present the artifact at this gate. After approval, continue under the task record and recovery rules above.

Follow this skill’s [approval review procedure](generic/plannotator-review.md) to present the complete artifact, await the final decision and take the next authorized action. It defines Plannotator execution, permitted fallback when tooling is absent, revision handling and approval scope. A running session or tool failure is not approval.
