---
name: act-mkt-investigate
description: Use when investigating an idea, feature, technical or general question, writing an RFC or detailed investigation report, or refining that report with the user.
---

# Investigate

Run `scripts/...` commands from this skill root (beside `SKILL.md`) or use absolute paths. Markdown links are relative to their containing document.

Produce an evidence-backed report and refine it with the user until they are satisfied. The request may be an idea, feature proposal, technical question, general question, or an existing report to revise; a tracker issue is optional.

## Execute the whole workflow

Read each linked step prompt before executing it. Track the current step, completed outputs, remaining steps, and review decision in the continuation record. Follow the listed order and advance to the next step immediately when its prerequisites are met; a progress update, working outline, completed research, or saved draft is not a handoff or completion condition.

Continue independent work while resolving material questions. Missing optional sources become explicit limitations. Wait only for required user input, a running human review, an explicit pause/cancellation, or a factual blocker that prevents further authorized work. State the exact blocker and retained progress. Honor explicit user/AGENTS requirements for additional approval gates.

Before yielding or finishing, check every remaining step: execute any step that is ready, and launch the required review yourself when its artifact is ready. Do not end with an offer to continue, ask whether to run the next required step, or rely on an automatic Stop hook. A running Plannotator session must be awaited in this turn until it exits.

## Task directory

Every new investigation creates a ticket-ID-plus-description directory (description only without a ticket) under the captured invocation directory. Follow [task directory](generic/task-directory.md) during intake; persist the plan, local report and `.task-context.json` there. Revisions reuse the absolute root. A later `act-mkt-breakdown` request inherits that directory and adds its own plan/draft without replacing investigation artifacts. Explicit canonical report destinations remain authoritative.

## Workflow

| Step | Instructions | Next |
| --- | --- | --- |
| Understand | [intake.md](workflows/intake.md) | Plan; clarify only material missing context |
| Plan | [plan.md](workflows/plan.md) | Prepare the working research outline, then research |
| Research and draft | [research.md](workflows/research.md) | Validate |
| Validate | [validate.md](workflows/validate.md) | Write report, or return to research for evidence gaps |
| Present report | [write-report.md](workflows/write-report.md) | Launch Plannotator review in the same turn |
| Review and refine | [review-report.md](workflows/review-report.md) | Revise and present again; finish only when the user accepts the report |

Always prepare the working outline from [the plan template](generic/plan-template.md) after intake, then begin read-only research and drafting; there is no separate scope-plan approval gate unless explicit user/AGENTS instructions require one. Ask focused questions when missing information materially changes the report, while continuing independent research. Present the report itself for review, not a plan in place of the report.

## Report choice

Match the requested depth, format and destination; keep a short question or narrow document revision proportionate. Honor the user's template or reference document. Otherwise choose a suitable starting point:

- [RFC](generic/rfc.md): a proposal/decision covering feature flow, goals, implementation, rollout, monitoring, and risks.
- [Investigation result](generic/investigation-result.md): a detailed explanation answering technical or general questions, with findings, evidence, and limits.

Adapt the headings to the question and audience. Do not force engineering rollout/monitoring sections into an unrelated general explanation. Describe implementation at report level when useful; do not turn the report into an epic/story backlog or create tracker work items.

## Review loop

Use [the Plannotator review procedure](generic/plannotator-review.md) for the complete report and each revision. Consume the decision before advancing or finishing.

Use the latest user-edited report as canonical. Feedback changes that same report; research further when needed, preserve agreed content, and present the revised result with a short account of material changes. Stay in this loop without a fixed iteration limit. Silence, a tool launch, or presenting the report does not mean it is accepted. On explicit acceptance or satisfaction, finish and retain the accepted report reference/version for a possible later breakdown request.

Accepting the report does not authorize implementing it, creating tickets, or automatically starting another skill. A later backlog request can consume the report through `act-mkt-breakdown`; that skill is not required to complete this investigation.

## Sources, destinations, and permissions

- Use available sources suited to the question: supplied material, local code, internal knowledge, public primary sources, or relevant telemetry. A code repository and traffic measurements are not required for every investigation. Put evidence next to the claim; distinguish observations, inferences, proposals, assumptions, and unknowns. State relevant source coverage, revisions and access limits; reconcile superseded information against the latest supported evidence and user direction. An assistant assertion alone does not establish an executed result.
- Keep chat as the default delivery destination and honor an explicit local report path or existing document destination. Save the complete report as a local review artifact for Plannotator; this does not authorize a hosted write or replace the canonical destination. Read current content before revisions and preserve unrelated user edits and finalized request/response contracts.
- Drafting/reviewing does not authorize hosted writes. Before an external update, show the concrete content and destination and obtain approval for that write, unless the user already authorized those exact changes. Read back saved content before claiming delivery.
- Product code stays read-only. Use the active checkout without branch switching; for another repo use [local code access](generic/local-code-access.md) and the helpers in `scripts/`. Record newly created clones per [cleanup](generic/cleanup.md); “clean everything up” takes that cleanup-only route. Never enroll a reused existing checkout.
- Use [host CLI](generic/host-cli.md) for MR/PR metadata when relevant. Do not wait for CI. Select an available model/effort appropriate to the research, respecting the user's choice and runtime restrictions; no mandatory per-step delegation is needed.

## Continuation

Persist one current task record at `<workspace.root>/.task-context.json` per [task directory](generic/task-directory.md), including the absolute root and plan/report/review paths. Keep it current with: latest request and boundaries, accepted decisions, current report/template/destination, source references and revisions, user feedback already incorporated, open questions, completed/remaining work, acceptance state, and any confirmed/unconfirmed hosted writes. Incorporate relevant steps from another workflow without restarting completed research or changing the requested deliverable or authorization. Resume the same report after interruption rather than restarting or replacing it with an older draft. A missing optional source becomes a stated limitation; decision-critical inaccessible evidence is a factual blocker. Reconcile ambiguous writes before retrying.
