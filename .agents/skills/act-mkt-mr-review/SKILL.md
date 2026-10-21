---
name: act-mkt-mr-review
description: Use when reviewing a PR or merge request for introduced regressions, compatibility failures, or performance degradation.
---

# MR Review

## Workflow direction

Treat the text that invoked this skill as the authoritative PR/MR review request. Derive the hosted-review URL, repository, branch, and discussion context from that request and the active workspace.

Execute the linked stages sequentially and automatically. Carry the invoking request and complete source evidence forward using the continuation contract below. After each stage, immediately dispatch its declared outcome route without returning control to the user. `gaps` and `handoff` follow their declared recovery routes automatically.

The only user wait is the complete plan-review gate below. Put every user-answerable question, missing decision, required authorization, and publication choice in the plan artifact before presenting it. Revise and re-present at that same gate until explicitly approved. After approval, execute the approved routes and publication contract autonomously; changed assumptions follow the recovery contract below.

A `blocked` outcome is terminal only when safe continuation is impossible: report the factual blocker, never bypass required evidence, access, authority, or safety checks. Report recoverable stale evidence through the declared recovery route instead.

## Model selection

- Never use a flagship model, including for reviewers, subagents, retries or fallbacks. Lowering its thinking effort does not make a flagship model eligible. Near-flagship means a strong reasoning/coding tier below the provider's flagship, not its top model.
- Use the cheapest available non-flagship model suitable for the stage: cheap/fast with low effort for retrieval, worktree/branch operations, running known commands, CI polling, formatting and approved publication; mid-tier with medium effort for routine implementation and bounded analysis; near-flagship with high effort for extensive design/planning, difficult diagnosis and substantive regression/performance review.
- Tables give the starting tier/effort. Escalate routine work to near-flagship/high only when complexity or failed attempts demonstrate that more reasoning is needed. Formatting already validated findings uses cheap/fast/low; reopening technical judgments uses near-flagship/high. For mixed work, resolve the demanding judgment first, then return mechanical follow-up to cheap/fast/low.
- Resolve tiers from the runtime's verified model catalog; no vendor model name or private routing service is required. Do not blindly inherit the runtime default or an unverified alias. If the suggested tier is unavailable, choose the cheapest suitable verified non-flagship alternative and preserve the task’s effort (for example, mid-tier/low for mechanical Git work when cheap models are unavailable). If no eligible model is available or model selection cannot avoid a flagship/unknown default, report the limitation instead of silently using it.
- Use the closest supported effort setting. Execute inline unless the user/runtime authorizes another method; model guidance does not authorize delegation, approve a plan or authorize publication.


## Review focus

Find concrete introduced regressions and performance degradation by tracing the changed behavior against its baseline or explicit new-feature contract. Leave business preferences, style, naming and speculative architecture nits to the user. Validate impact and avoid duplicate root causes.

With no actionable findings, finish locally with the reviewed SHA, coverage and limits. No approval or summary publication is needed unless the user explicitly requested a published summary.

## Continuation and recovery

- Keep a resumable checkpoint in the conversation or an approved artifact: stage, canonical plan/version or digest, explicit approval evidence, workspace/base/head, full-source references, checks, completed/unconfirmed action IDs and exact remaining work. Template variables denote those artifacts; they do not require a particular orchestrator.
- Complete evidence may be inline or in stable, readable full-content references. Preserve original source ordering and identities; read missing chunks/pages before deciding. A summary or truncated preview is not source proof. Carry references rather than duplicating entire diffs at every handoff.
- Resume the same approved artifact/scope after compaction or continuation. Reconcile actual state first; consume an existing Plannotator result/process session before reopening. Feedback revises the same gate; approval advances execution without another nudge.
- Apply later user corrections throughout scope, checks and publication. An explicit instruction to make a small scoped fix directly takes precedence over a redundant skill gate. Revalidate base/head before edits and publication; refresh stale evidence. Re-present a plan when scope, verdicts, publication actions or base assumptions invalidate its approval. A user-authorized rebase/continuation remains authorized.
- Follow declared recovery routes automatically. Retry transient failures with bounded backoff and retained progress; repeated failure without new evidence is a factual blocker. Reconcile ambiguous writes before retrying. Never turn recovery into authority for unrelated edits or remote actions.

## Stages

| Stage | Prompt | Model | Thinking | Outcomes |
| --- | --- | --- | --- | --- |
| fetch | [fetch.md](fetch.md) | cheap/fast | low | `ready` → review; `blocked` → terminal report; `handoff` → fetch |
| review | [findings.md](findings.md) | near-flagship | high | `ready` → plan; `done` → local report; `gaps` → fetch; `blocked` → terminal report; `handoff` → review |
| plan | [plan.md](plan.md) | cheap/fast | low | `ready` → plan review, then publish on approval; `refresh` → fetch; `gaps` → review; `blocked` → terminal report; `handoff` → plan |
| publish | [publish-approved.md](publish-approved.md) | cheap/fast | low | `ready` → done; `done` → local report; `refresh` → fetch; `blocked` → terminal report; `handoff` → publish |

## Review approval gate

Before `plan` can continue with `ready`, obtain explicit approval for an artifact with these exact level-2 headings:

- `Reviews`
- `Publication contract`

Obtain explicit human approval of the complete artifact before continuing. Include all unresolved review decisions and exact publication actions in the artifact; do not ask separately. On denial or feedback, revise and re-present the artifact at this gate. After approval, ask no questions.

Plannotator is optional; explicit human approval is required. Save the complete artifact as a Markdown file. If a Plannotator tool or installed CLI is available, use it to present the complete artifact for approval. Otherwise, provide the Markdown file path and explicitly ask the user to review the file and approve in a chat response. Wait for explicit approval through the selected interface before continuing. Silence, dismissal, or a tool failure is not approval; revise and re-present the artifact on feedback.
