---
name: act-mkt-investigate
description: Use when investigating a tracker issue or technical/product question, comparing design alternatives, or revising an evidence-backed RFC, report, or ticket description.
---

# Investigate

## Workflow direction

Treat the text that invoked this skill as the authoritative investigation request. Derive tracker, repository, logs, and other integration context from that request and the active workspace.

## Report destination intake

- Honor the requested destination: exact local report path, hosted ticket description(s)/fields, or explicit chat-only answer. Reuse the user's canonical destination for revisions. A request declining a local report must not trigger a report-path question.
- When local output is selected and no canonical path was supplied, ask for the exact path before report writing. Do not invent a path. If destination type is unspecified, put that decision in the scope artifact's Questions at the approval gate.
- Carry the exact path, hosted identities/fields and dependency order, or chat-only choice under # Report destination. Include external-write authorization in the scope gate. Resolve a missing destination at the scope gate before delivery; a scope artifact may present that decision for review.

## Workspace policy

- Investigations and report generation are read-only with respect to product code and use the active repository checkout. Never create a Git worktree for an investigation, switch branches, or check out another revision solely for an investigation.
- Preserve existing checkout state and unrelated changes. Capture branch, `HEAD`, and `git status --short` before any approved local documentation/report write. Hosted updates use current saved content/version as their baseline.
- Keep investigation notes and report artifacts in the approved destination. If product implementation is requested, keep it out of the investigation and route it through the separately approved implementation workflow; do not silently expand scope.

Execute the linked stages sequentially and automatically. Carry the invoking request and complete source evidence forward using the continuation contract below. After each stage, immediately dispatch its declared outcome route without returning control to the user. `gaps` and `handoff` follow their declared recovery routes automatically.

The user waits are a missing exact path when local output was selected, and the complete scope-review gate below. Put every other user-answerable question, missing decision, required authorization, and publication choice in the plan artifact before presenting it. Revise and re-present at that same gate until explicitly approved. After approval, execute the approved routes and publication contract autonomously; changed assumptions follow the recovery contract below.

A `blocked` outcome is terminal only when safe continuation is impossible: report the factual blocker, never bypass required evidence, access, authority, or safety checks. Report recoverable stale evidence through the declared recovery route instead.

## Model selection and task delegation

- Use your judgment to choose an available model and supported thinking effort for each task, balancing complexity, quality, latency and cost. The stage table gives starting guidance, not eligibility requirements; adjust it when the task or results warrant it. Respect an explicit user model choice and actual runtime restrictions.
- The parent agent coordinates the workflow. Spawn a fresh subagent for each bounded task, including stage work, implementation slices, reviews and recovery tasks. This skill authorizes task delegation; it does not approve a plan or authorize publication. A worker assigned a bounded task completes it and returns evidence to the parent rather than recursively spawning a replacement for itself.
- When model selection is exposed, choose a suitable model from the available options. When model selection or parent-model introspection is unavailable, launch the subagent with its configured/default model and continue. An unknown parent model, unavailable tier catalog or inability to switch models inline is not a blocker. Do not claim a model identity or tier was verified when it was not.
- If subagent tools are unavailable or dispatch fails, continue the task inline using the available model and briefly record the fallback. Report a blocker only when a real task prerequisite, runtime restriction or required authorization prevents safe progress.
- Give each worker the original request, bounded scope, applicable stage prompt, approved plan and approval evidence when required, workspace/base/head, full-source references, relevant checks and expected outcome. The parent dispatches subsequent routes and remains accountable for reviewing diffs, checking evidence and reporting results.
- Run independent tasks concurrently when they can avoid conflicting edits; run dependent stages and tasks sequentially. Preserve the approval gates, workspace restrictions and publication contract across every handoff.

## Scope and user-owned artifacts

- Apply the user's latest explicit scope correction throughout the proposal, tests, metrics, rollout, and stories. Findings expose risks; they do not authorize a redesign or stronger guarantees outside the requested change.
- Treat the user's current edited file or hosted description as canonical. Read it before revisions; patch it rather than copying an older draft or mirror over it. Preserve unrelated edits.
- Preserve user-owned API request/response JSON and other finalized contracts byte-for-byte unless the user explicitly requests those changes. Capture a baseline and verify protected blocks after editing; never reconstruct a lost design from guesses.

## Report format

- Lead with the customer/product benefit and decision sought. RFC goals/non-goals describe the proposal, not agent-session permissions. Put implementation and observability detail in their own sections.
- Use diagrams for flows, compact tables for comparisons or numeric results, and concise bullets for explanations. Do not replace every section with tables or pack prose into wide cells.
- Explain each alternative fully before the comparison: required changes, reused/unchanged components, request/response contract when requested, dataflow, tradeoffs, and dependencies. Use real service names; distinguish existing background from proposed changes.
- Put evidence beside the supported claim or table row: source revision and file:line, retrieved URL, or exact query/filters/result. Avoid detached evidence IDs that require scrolling to a separate register.
- Read any user-supplied reference RFC and follow its approved organization/style without copying its owners, approvals, measurements, or requirements. Preserve the approved headings and required detail.

## Traffic evidence

Run the declared [traffic-evidence](traffic-evidence.md) stage after research and before validation. It captures/verifies Grafana MCP backend measurements, Query Writer MCP consumer exposure, graph/access checks, and proof records. If traffic/load/capacity is outside the approved scope, return `ready` with an explicit not-applicable result and the complete research draft unchanged; do not add queries or another approval pause. Reuse valid captured evidence rather than rerunning it by ritual. Numeric observations need executed aggregate results; forecasts stay explicitly conditional.

## Continuation and recovery

- Keep a resumable checkpoint in the conversation or an approved artifact: stage, canonical plan/version or digest, explicit approval evidence, workspace/base/head, full-source references, checks, completed/unconfirmed action IDs and exact remaining work. Template variables denote those artifacts; they do not require a particular orchestrator.
- Complete evidence may be inline or in stable, readable full-content references. Preserve original source ordering and identities; read missing chunks/pages before deciding. A summary or truncated preview is not source proof. Carry references rather than duplicating entire diffs at every handoff.
- Resume the same approved artifact/scope after compaction or continuation. Reconcile actual state first; consume an existing Plannotator result/process session before reopening. Feedback revises the same gate; approval advances execution without another nudge.
- Apply later user corrections throughout scope, checks and publication. An explicit instruction to make a small scoped fix directly takes precedence over a redundant skill gate. Revalidate base/head before edits and publication; refresh stale evidence. Re-present a plan when scope, verdicts, publication actions or base assumptions invalidate its approval. A user-authorized rebase/continuation remains authorized.
- Follow declared recovery routes automatically. Retry transient failures with bounded backoff and retained progress; repeated failure without new evidence is a factual blocker. Reconcile ambiguous writes before retrying. Never turn recovery into authority for unrelated edits or remote actions.

## Stages

| Stage | Prompt | Model guidance | Thinking guidance | Outcomes |
| --- | --- | --- | --- | --- |
| intake | [intake.md](intake.md) | fast economical | low | `ready` → plan; `blocked` → terminal report; `handoff` → intake |
| plan | [plan.md](plan.md) | strong reasoning | high | `ready` → plan review, then research on approval; `gaps` → intake; `blocked` → terminal report; `handoff` → plan |
| research | [research.md](research.md) | strong reasoning | high | `ready` → traffic-evidence; `refresh` → plan; `blocked` → terminal report; `handoff` → research |
| traffic-evidence | [traffic-evidence.md](traffic-evidence.md) | balanced | medium | `ready` → validate; `blocked` → terminal report; `handoff` → traffic-evidence |
| validate | [validate.md](validate.md) | strong reasoning | high | `ready` → write-report; `gaps` → research; `refresh` → plan; `blocked` → terminal report; `handoff` → validate |
| write-report | [write-report.md](write-report.md) | fast economical | low | `ready` → done; `gaps` → validate; `refresh` → plan; `blocked` → terminal report; `handoff` → write-report |

## Scope approval gate

Before `plan` can continue with `ready`, obtain explicit approval for an artifact with these exact headings. `# Report destination` must identify the selected local path, hosted targets/fields, or chat-only output:

- level 1: `Report destination`
- level 2: `Goal/Acceptance Criteria`
- level 2: `Non Goal`
- level 2: `Investigation Resources`
- level 2: `Questions`

Obtain explicit human approval of the complete artifact before continuing. Put unresolved investigation questions and required decisions in `Questions`; do not ask them separately. On denial or feedback, revise and re-present the artifact at this gate. After approval, ask no questions.

Plannotator is optional; explicit human approval is required. Save the complete artifact as a Markdown file. If a Plannotator tool or installed CLI is available, use it to present the complete artifact for approval. Otherwise, provide the Markdown file path and explicitly ask the user to review the file and approve in a chat response. Wait for explicit approval through the selected interface before continuing. Silence, dismissal, or a tool failure is not approval; revise and re-present the artifact on feedback.
