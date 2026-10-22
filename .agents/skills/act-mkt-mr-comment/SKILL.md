---
name: act-mkt-mr-comment
description: Use when addressing, validating, or responding to PR or merge-request review feedback.
---

# MR Comment

Run `scripts/...` commands from this skill root (beside `SKILL.md`) or use absolute paths. Markdown links are relative to their containing document.

## Local resources and cleanup

This package includes its own [local code access](generic/local-code-access.md), [host CLI](generic/host-cli.md), and [cleanup script and instructions](generic/cleanup.md); no sibling skill installation is required. Track every newly created clone/worktree. When the user says “clean everything up”, take the cleanup-only route and delete all tracked local resources, including recent clones, using the shipped cleanup helper. Carry the cleanup ledger path in every checkpoint; do not enroll reused existing checkouts.

## Workflow direction

Treat the text that invoked this skill as the authoritative review-comment request. Derive the hosted-review URL, repository, branch, and unresolved-discussion context from that request and the active workspace.

Execute the linked stages sequentially and automatically. Carry the invoking request and complete source evidence forward using the continuation contract below. After each stage, immediately dispatch its declared outcome route without returning control to the user. `gaps` and `handoff` follow their declared recovery routes automatically.

The only user wait is the complete plan-review gate below. Put every user-answerable question, missing decision, required authorization, and publication choice in the plan artifact before presenting it. Revise and re-present at that same gate until explicitly approved. After approval, execute the approved routes and publication contract autonomously; changed assumptions follow the recovery contract below.

A `blocked` outcome is terminal only when safe continuation is impossible: report the factual blocker, never bypass required evidence, access, authority, or safety checks. Report recoverable stale evidence through the declared recovery route instead.

## Model selection and task delegation

- Use your judgment to choose an available model and supported thinking effort for each task, balancing complexity, quality, latency and cost. The stage table gives starting guidance, not eligibility requirements; adjust it when the task or results warrant it. Respect an explicit user model choice and actual runtime restrictions.
- The parent agent coordinates the workflow. Spawn a fresh subagent for each bounded task, including stage work, implementation slices, reviews and recovery tasks. This skill authorizes task delegation; it does not approve a plan or authorize publication. A worker assigned a bounded task completes it and returns evidence to the parent rather than recursively spawning a replacement for itself.
- When model selection is exposed, choose a suitable model from the available options. When model selection or parent-model introspection is unavailable, launch the subagent with its configured/default model and continue. An unknown parent model, unavailable tier catalog or inability to switch models inline is not a blocker. Do not claim a model identity or tier was verified when it was not.
- If subagent tools are unavailable or dispatch fails, continue the task inline using the available model and briefly record the fallback. Report a blocker only when a real task prerequisite, runtime restriction or required authorization prevents safe progress.
- Give each worker the original request, bounded scope, applicable stage prompt, approved plan and approval evidence when required, workspace/base/head, full-source references, relevant checks and expected outcome. The parent dispatches subsequent routes and remains accountable for reviewing diffs, checking evidence and reporting results.
- Run independent tasks concurrently when they can avoid conflicting edits; run dependent stages and tasks sequentially. Preserve the approval gates, workspace restrictions and publication contract across every handoff.

## Continuation and recovery

- Keep a resumable checkpoint in the conversation or an approved artifact: stage, canonical plan/version or digest, explicit approval evidence, workspace/base/head, full-source references, checks, completed/unconfirmed action IDs and exact remaining work. Template variables denote those artifacts; they do not require a particular orchestrator.
- Complete evidence may be inline or in stable, readable full-content references. Preserve original source ordering and identities; read missing chunks/pages before deciding. A summary or truncated preview is not source proof. Carry references rather than duplicating entire diffs at every handoff.
- Resume the same approved artifact/scope after compaction or continuation. Reconcile actual state first; consume an existing Plannotator result/process session before reopening. Feedback revises the same gate; approval advances execution without another nudge.
- Apply later user corrections throughout scope, checks and publication. An explicit instruction to make a small scoped fix directly takes precedence over a redundant skill gate. Revalidate base/head before edits and publication; refresh stale evidence. Re-present a plan when scope, verdicts, publication actions or base assumptions invalidate its approval. A user-authorized rebase/continuation remains authorized.
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

Obtain explicit human approval of the complete artifact before continuing. Include every current comment verdict, implementation choice, validation decision, and exact actionable publication reply in this artifact; do not ask separately. On denial or feedback, revise and re-present the artifact at this gate. After approval, ask no questions.

Plannotator is optional; explicit human approval is required. Save the complete artifact as a Markdown file. If a Plannotator tool or installed CLI is available, use it to present the complete artifact for approval. Otherwise, provide the Markdown file path and explicitly ask the user to review the file and approve in a chat response. Wait for explicit approval through the selected interface before continuing. Silence, dismissal, or a tool failure is not approval; revise and re-present the artifact on feedback.
