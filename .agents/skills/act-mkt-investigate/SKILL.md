---
name: act-mkt-investigate
description: Use when investigating an idea, feature, technical or general question, writing an RFC or detailed investigation report, or refining that report with the user.
---

# Investigate

Run `scripts/...` commands from this skill root (beside `SKILL.md`) or use absolute paths. Markdown links are relative to their containing document.

Refine the investigation scope with the user before substantive research, then produce an evidence-backed report and refine it until they are satisfied. The request may be an idea, feature proposal, technical question, general question, or an existing report to revise; a tracker issue is optional.

## Concise output

Apply this format to plans, reports, reviews, replies and chat responses:

- Lead with the answer, verdict or decision in one short sentence.
- Make scope and report review actionable: show the question being answered, key findings and a small useful diagram, then the focused feedback needed. Keep supporting evidence and machine-readable state in the complete saved artifact; link them instead of flooding the review conversation.
- Prefer compact tables for comparisons, findings, tasks, risks and validation results; keep cells brief.
- Prefer a small Mermaid diagram for flows, dependencies or interactions when it makes the relationships clearer. If the destination cannot render Mermaid, use a concise numbered flow or bullets.
- Put necessary detail in short bullets, one point each. Use short prose only for nuance that needs it; keep simple answers to a sentence or a few bullets.
- Let each table or diagram replace the equivalent prose. Include only visuals that explain the content.
- Preserve technical facts, evidence links, material limitations, required handoffs and complete required artifact or machine-readable fields. Honor explicitly requested detail; link supporting evidence instead of repeating it. Use plain, concise language without requiring a separate brevity skill.

## Execute the whole workflow

Read each linked step prompt before executing it. Track the current step, completed outputs, remaining steps, and review decision in the continuation record. Follow the listed order and advance to the next step immediately when its prerequisites are met; a progress update, working outline, completed research, or saved draft is not a handoff or completion condition.

During intake, resolve material scope questions before substantive research or report drafting; continue only source discovery needed to clarify that scope. After scope is established, continue independent research while resolving later evidence questions. Missing optional sources become explicit limitations. Pause dependent work for required user input, review, an explicit pause/cancellation, or a factual blocker that prevents further authorized work. State the exact blocker and retained progress. Honor explicit user/AGENTS requirements for additional approval gates.

Before finishing, execute any independent ready step allowed by the current scope. When the report is ready, present it for discussion in the active conversation using [report review](generic/report-review.md), record pending feedback, and end the turn.

## Task directory

Every new investigation creates a ticket-ID-plus-description directory (description only without a ticket) under the captured invocation directory. Follow [task directory](generic/task-directory.md) during intake; persist the plan, local report and `.task-context.json` there. Revisions reuse the absolute root. A later `act-mkt-breakdown` request inherits that directory and adds its own plan/draft without replacing investigation artifacts. Explicit canonical report destinations remain authoritative.

## Task artifact location

Immediately after creating a new, empty task root, run `python3 /absolute/skill/scripts/cleanup-workspaces.py register-root <absolute-root>` before creating task artifacts or repositories. This creates the owned task ledger and registers the root even when no Git repository is needed. A continuation reuses its recorded root and must not register it as new. On an explicit cleanup request, use the cleanup helper to remove the complete owned task root, including all artifacts.

For a new task, establish one absolute task root before writing any files. Keep all task-specific plans, manifests, references, evidence, reports, scratch files, review actions and cleanup records inside `<root>` (the existing investigation plan, report and context remain at the root), and repository checkouts under `<root>`. Set `ACT_MKT_CLEANUP_LEDGER=<root>/.artifacts/cleanup-ledger.json` and `ACT_MKT_REGISTER_LEDGER=1` in every worker that creates resources. Record the root and ledger in the task checkpoint and reuse them on continuation. Never place task files beside the task root. A user-specified canonical destination or an instruction requiring an external review copy remains authoritative; record it and keep a local copy in the root. Do not move existing tasks or override their recorded paths.

## Workflow

| Step | Instructions | Next |
| --- | --- | --- |
| Understand | [intake.md](workflows/intake.md) | Refine scope in chat; resolve material scope questions before Plan |
| Plan | [plan.md](workflows/plan.md) | Prepare the working research outline, then research |
| Research and draft | [research.md](workflows/research.md) | Validate |
| Validate | [validate.md](workflows/validate.md) | Write report, or return to research for evidence gaps |
| Present report | [write-report.md](workflows/write-report.md) | Present the report for discussion in the active conversation |
| Review and refine | [review-report.md](workflows/review-report.md) | Revise and present again; finish only when the user accepts the report |

First restate the question, audience, in/out of scope and expected report in the active conversation. Reuse scope already supplied by the user; ask focused questions only about material gaps. Once those gaps are resolved, prepare the working outline from [the plan template](generic/plan-template.md), then begin read-only research and drafting. There is no formal scope-plan approval gate unless explicit user/AGENTS instructions require one. Present the report itself for review, not a plan in place of the report.

## Report choice

Match the requested depth, format and destination; keep a short question or narrow document revision proportionate. Honor the user's template or reference document. Otherwise choose a suitable starting point:

- [RFC](generic/rfc.md): a proposal/decision covering feature flow, goals, implementation, rollout, monitoring, and risks.
- [Investigation result](generic/investigation-result.md): a detailed explanation answering technical or general questions, with findings, evidence, and limits.

Adapt the headings to the question and audience. Do not force engineering rollout/monitoring sections into an unrelated general explanation. Describe implementation at report level when useful; do not turn the report into an epic/story backlog or create tracker work items.

## Review loop

Use [report review](generic/report-review.md) for the complete Markdown report and each revision. Lead with the answer and findings, a useful diagram or comparison, and the material evidence/limits; link the complete saved report. Discuss feedback in the active conversation and record acceptance only when the user expresses satisfaction.

Use the latest user-edited report as canonical. Feedback changes that same report; research further when needed, preserve agreed content, and present the revised result with a short account of material changes. Stay in this loop without a fixed iteration limit. Silence, a delivery acknowledgment, or presenting the report does not mean it is accepted. On explicit acceptance or satisfaction, finish and retain the accepted report reference/version for a possible later breakdown request.

Accepting the report does not authorize implementing it, creating tickets, or automatically starting another skill. A later backlog request can consume the report through `act-mkt-breakdown`; that skill is not required to complete this investigation.

## Sources, destinations, and permissions

- Use available sources suited to the question: supplied material, local code, internal knowledge, public primary sources, or relevant telemetry. A code repository and traffic measurements are not required for every investigation. Put evidence next to the claim; distinguish observations, inferences, proposals, assumptions, and unknowns. State relevant source coverage, revisions and access limits; reconcile superseded information against the latest supported evidence and user direction. An assistant assertion alone does not establish an executed result.
- Keep chat as the default delivery destination and honor an explicit local report path or existing document destination. Save the complete Markdown report as a local review artifact; this does not authorize a hosted write or replace the canonical destination. Read current content before revisions and preserve unrelated user edits and finalized request/response contracts.
- Drafting/reviewing does not authorize hosted writes. Before an external update, show the concrete content and destination and obtain approval for that write, unless the user already authorized those exact changes. Read back saved content before claiming delivery.
- Product code stays read-only. Use the active checkout without branch switching; for another repo use [local code access](generic/local-code-access.md) and the helpers in `scripts/`. Record newly created clones per [cleanup](generic/cleanup.md); “clean everything up” takes that cleanup-only route. Never enroll a reused existing checkout.
- Use [host CLI](generic/host-cli.md) for MR/PR metadata when relevant. Do not wait for CI. Select an available model/effort appropriate to the research, respecting the user's choice and runtime restrictions; no mandatory per-step delegation is needed.

## Continuation

Persist one current task record at `<workspace.root>/.task-context.json` per [task directory](generic/task-directory.md), including the absolute root and plan/report/review paths. Keep it current with: latest request and boundaries, scope discussed and material questions resolved, accepted decisions, current report/template/destination, source references and revisions, user feedback already incorporated, open questions, completed/remaining work, acceptance state, and any confirmed/unconfirmed hosted writes. Incorporate relevant steps from another workflow without restarting completed research or changing the requested deliverable or authorization. Resume the same report after interruption rather than restarting or replacing it with an older draft. A missing optional source becomes a stated limitation; decision-critical inaccessible evidence is a factual blocker. Reconcile ambiguous writes before retrying.
