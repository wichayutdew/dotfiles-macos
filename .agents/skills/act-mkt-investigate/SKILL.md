---
name: act-mkt-investigate
description: Use when investigating an idea, feature, technical or general question, writing an RFC or detailed investigation report, or refining that report with the user.
---

# Investigate

Run `scripts/...` commands from this skill root (beside `SKILL.md`) or use absolute paths. Markdown links are relative to their containing document.

Produce an evidence-backed report and refine it with the user until they are satisfied. The request may be an idea, feature proposal, technical question, general question, or an existing report to revise; a tracker issue is optional.

## Workflow

| Step | Instructions | Next |
| --- | --- | --- |
| Understand | [intake.md](workflows/intake.md) | Plan; clarify only material missing context |
| Plan | [plan.md](workflows/plan.md) | Prepare the working research outline, then research |
| Research and draft | [research.md](workflows/research.md) | Validate |
| Validate | [validate.md](workflows/validate.md) | Write report, or return to research for evidence gaps |
| Present report | [write-report.md](workflows/write-report.md) | User review |
| Review and refine | [review-report.md](workflows/review-report.md) | Revise and present again; finish only when the user accepts the report |

Always prepare the working outline from [the plan template](generic/plan-template.md) after intake, then begin read-only research and drafting; there is no separate scope-plan approval gate. Ask focused questions when missing information materially changes the report, while continuing independent research. Present the report itself for review, not a plan in place of the report.

## Report choice

Honor the user's template or reference document. Otherwise choose a suitable starting point:

- [RFC](generic/rfc.md): a proposal/decision covering feature flow, goals, implementation, rollout, monitoring, and risks.
- [Investigation result](generic/investigation-result.md): a detailed explanation answering technical or general questions, with findings, evidence, and limits.

Adapt the headings to the question and audience. Do not force engineering rollout/monitoring sections into an unrelated general explanation. Describe implementation at report level when useful; do not turn the report into an epic/story backlog or create tracker work items.

## Review loop

Use the latest user-edited report as canonical. Feedback changes that same report; research further when needed, preserve agreed content, and present the revised result with a short account of material changes. Stay in this loop without a fixed iteration limit. Silence, a tool launch, or presenting the report does not mean it is accepted. On explicit acceptance or satisfaction, finish and retain the accepted report reference/version for a possible later breakdown request.

Accepting the report does not authorize implementing it, creating tickets, or automatically starting another skill. A later backlog request can consume the report through `act-mkt-breakdown`; that skill is not required to complete this investigation.

## Sources, destinations, and permissions

- Use available sources suited to the question: supplied material, local code, internal knowledge, public primary sources, or relevant telemetry. A code repository and traffic measurements are not required for every investigation. Put evidence next to the claim; distinguish observations, proposals, assumptions, and unknowns.
- Present in chat by default. Honor an explicit local report path or existing document destination; do not require a file merely to obtain review. Read current content before revisions and preserve unrelated user edits and finalized request/response contracts.
- Drafting/reviewing does not authorize hosted writes. Before an external update, show the concrete content and destination and obtain approval for that write, unless the user already authorized those exact changes. Read back saved content before claiming delivery.
- Product code stays read-only. Use the active checkout without branch switching; for another repo use [local code access](generic/local-code-access.md) and the helpers in `scripts/`. Record newly created clones per [cleanup](generic/cleanup.md); “clean everything up” takes that cleanup-only route. Never enroll a reused existing checkout.
- Use [host CLI](generic/host-cli.md) for MR/PR metadata when relevant. Do not wait for CI. Select an available model/effort appropriate to the research, respecting the user's choice and runtime restrictions; no mandatory per-step delegation is needed.

## Continuation

Retain the request, current report/template/destination, source references and revisions, user feedback already incorporated, open questions, acceptance state, and any confirmed/unconfirmed hosted writes. Resume the same report after interruption rather than restarting or replacing it with an older draft. A missing optional source becomes a stated limitation; decision-critical inaccessible evidence is a factual blocker. Reconcile ambiguous writes before retrying.
