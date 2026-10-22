---
name: act-mkt-breakdown
description: Use when turning an investigation report or RFC into a draft epic and stories, refining the backlog with the user, and creating approved work items in Jira, Linear, or another tracker.
---

# Breakdown

Run `scripts/...` commands from this skill root (beside `SKILL.md`) or use absolute paths. Markdown links are relative to their containing document.

Turn an investigation report into a reviewable epic and stories. Refine the draft until the user explicitly approves creating the work items in the selected tracker. This skill is self-contained: a report from any source is valid input; no other skill installation is required.

## Workflow steps

Follow these step prompts in order, preserving their approval and permission requirements.

1. [Read the report](workflows/read-report.md)
2. [Plan the breakdown](workflows/plan.md) using the [plan template](generic/plan-template.md)
3. [Draft the backlog](workflows/draft.md)
4. [Review and refine](workflows/review.md)
5. [Create approved items](workflows/create.md)

## Delivery and continuation

Only after the creation gate, follow [create.md](workflows/create.md). Create exactly the approved epic/stories or explicitly approved equivalent using the connected tracker; do not also publish reports, create branches, implement code, change existing issue status, or notify others.

Keep a simple record of the source report, latest draft, feedback resolved, pending questions, explicit creation approval, and created/confirmed/unconfirmed IDs. On continuation, reconcile actual tracker state before resuming. Report verified created links and any remaining failures; a partially created backlog is not complete.

No CI waiting or repository workspace is needed for report-to-backlog drafting. Choose an available model/effort suitable for the task and respect user/runtime constraints; no mandatory per-step delegation is needed.
