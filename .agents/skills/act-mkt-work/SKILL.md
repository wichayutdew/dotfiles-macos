---
name: act-mkt-work
description: Use when implementing a feature, bug fix, or scoped software change from a request or tracker issue.
---

# Work

## Workflow direction

Treat the text that invoked this skill as the authoritative work request. Derive repository, Git, tracker, and hosted-review context from that request and the active workspace.

Execute the linked stages sequentially and automatically. Carry the invoking request and complete source evidence forward using the continuation contract below. After each stage, immediately dispatch its declared outcome route without returning control to the user. `gaps` and `handoff` follow their declared recovery routes automatically.

The only user wait is the complete plan-review gate below. Put every user-answerable question, missing decision, required authorization, and publication choice in the plan artifact before presenting it. Revise and re-present at that same gate until explicitly approved. After approval, execute the approved routes and publication contract autonomously; changed assumptions follow the recovery contract below.

A `blocked` outcome is terminal only when safe continuation is impossible: report the factual blocker, never bypass required evidence, access, authority, or safety checks. Report recoverable stale evidence through the declared recovery route instead.

Use the model specified for each stage when available; otherwise, use an equivalent model available in the current environment with comparable capability for that stage. Preserve the specified thinking level, using the closest supported equivalent if the selected model uses different effort labels. Use an available equivalent without stalling for an unavailable gateway model. Model selection does not approve a plan, authorize delegation, or authorize publication.

## Continuation and recovery

- Keep a resumable checkpoint in the conversation or an approved artifact: stage, canonical plan/version or digest, explicit approval evidence, workspace/base/head, full-source references, checks, completed/unconfirmed action IDs and exact remaining work. Template variables denote those artifacts; they do not require a particular orchestrator.
- Complete evidence may be inline or in stable, readable full-content references. Preserve original source ordering and identities; read missing chunks/pages before deciding. A summary or truncated preview is not source proof. Carry references rather than duplicating entire diffs at every handoff.
- Resume the same approved artifact/scope after compaction or continuation. Reconcile actual state first; consume an existing Plannotator result/process session before reopening. Feedback revises the same gate; approval advances execution without another nudge.
- Apply later user corrections throughout scope, checks and publication. An explicit instruction to make a small scoped fix directly takes precedence over a redundant skill gate. Revalidate base/head before edits and publication; refresh stale evidence. Re-present a plan when scope, verdicts, publication actions or base assumptions invalidate its approval. A user-authorized rebase/continuation remains authorized.
- Follow declared recovery routes automatically. Retry transient failures with bounded backoff and retained progress; repeated failure without new evidence is a factual blocker. Reconcile ambiguous writes before retrying. Never turn recovery into authority for unrelated edits or remote actions.

## Stages

| Stage | Prompt | Model | Thinking | Outcomes |
| --- | --- | --- | --- | --- |
| intake | [intake.md](intake.md) | `gateway/gemini-3.8-flash` | low | `ready` → plan; `blocked` → terminal report; `handoff` → intake |
| plan | [plan.md](plan.md) | `gateway/gpt-6.1-sol` | high | `ready` → plan review, then prepare-workspace on approval; `gaps` → intake; `blocked` → terminal report; `handoff` → plan |
| prepare-workspace | [prepare-workspace.md](prepare-workspace.md) | `gateway/gemini-3.8-flash` | low | `ready` → implement; `gaps` → plan; `blocked` → terminal report; `handoff` → prepare-workspace |
| implement | [implement.md](implement.md) | `gateway/kimi-k3` | high | `ready` → verify; `refresh` → plan; `blocked` → terminal report; `handoff` → implement |
| verify | [verify.md](verify.md) | `gateway/grok-4.7` | high | `ready` → publish; `gaps` → implement; `blocked` → terminal report; `handoff` → verify |
| publish | [publish-remote.md](publish-remote.md) | `gateway/gemini-3.8-flash` | low | `ready` → done; `done` → local report; `gaps` → implement; `refresh` → plan; `blocked` → terminal report; `handoff` → publish |

## Plan approval gate

Before `plan` can continue with `ready`, obtain explicit approval for an artifact with these exact level-2 headings:

- `Goal/Acceptance Criteria`
- `Non Goal`
- `Implementation Steps and Tests`
- `Validation`
- `Risks/Decisions Needed`
- `Publications Contract/Metadata`
- `Execution appendix (machine-readable)`

Obtain explicit human approval of the complete artifact before continuing. Include every user-resolvable question, missing decision, and required authorization in this artifact; do not ask separately. On denial or feedback, revise and re-present the artifact at this gate. After approval, ask no questions.

Plannotator is optional; explicit human approval is required. Save the complete artifact as a Markdown file. If a Plannotator tool or installed CLI is available, use it to present the complete artifact for approval. Otherwise, provide the Markdown file path and explicitly ask the user to review the file and approve in a chat response. Wait for explicit approval through the selected interface before continuing. Silence, dismissal, or a tool failure is not approval; revise and re-present the artifact on feedback.
