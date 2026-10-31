---
name: act-mkt-breakdown
description: Use when turning an investigation report or RFC into a draft epic and stories, refining the backlog with the user, and creating approved work items in Jira, Linear, or another tracker.
---

# Breakdown

Run `scripts/...` commands from this skill root (beside `SKILL.md`) or use absolute paths. Markdown links are relative to their containing document.

Turn an investigation report into a reviewable epic and stories. Refine the draft until the user explicitly approves creating the work items in the selected tracker. This skill is self-contained: a report from any source is valid input; no other skill installation is required.

## Concise output

Apply this format to plans, reports, reviews, replies and chat responses:

- Lead with the answer, verdict or decision in one short sentence.
- Prefer compact tables for comparisons, findings, tasks, risks and validation results; keep cells brief.
- Prefer a small Mermaid diagram for flows, dependencies or interactions when it makes the relationships clearer. If the destination cannot render Mermaid, use a concise numbered flow or bullets.
- Put necessary detail in short bullets, one point each. Use short prose only for nuance that needs it; keep simple answers to a sentence or a few bullets.
- Let each table or diagram replace the equivalent prose. Include only visuals that explain the content.
- Preserve technical facts, evidence links, material limitations, required handoffs and complete required artifact or machine-readable fields. Honor explicitly requested detail; link supporting evidence instead of repeating it. Use plain, concise language without requiring a separate brevity skill.

## Execute the whole workflow

Read each linked step prompt before executing it. Track the current step, completed outputs, remaining steps, and review decision in the continuation record. Follow the listed order and advance to the next step immediately when its prerequisites are met; a progress update, working outline, completed research, or saved draft is not a handoff or completion condition.

Continue independent work while resolving material questions. Missing optional sources become explicit limitations. Wait only for required user input, a running human review, an explicit pause/cancellation, or a factual blocker that prevents further authorized work. State the exact blocker and retained progress. Honor explicit user/AGENTS requirements for additional approval gates.

Before yielding or finishing, check every remaining step: execute any step that is ready, and launch the required review yourself when its artifact is ready. Do not end with an offer to continue, ask whether to run the next required step, or rely on an automatic Stop hook. A running Plannotator session must be awaited in this turn until it exits.

## Task directory

Recover the preceding investigation's absolute root and `.task-context.json` using [task directory](generic/task-directory.md), even when invoked elsewhere. Save `breakdown-plan.md` and `breakdown-draft.md` in that same directory, preserving investigation artifacts and context. Standalone reports remain supported with the fallback directory contract in that guide.

## Workflow steps

Follow these step prompts in order, preserving their approval and permission requirements.

1. [Read the report](workflows/read-report.md)
2. [Plan the breakdown](workflows/plan.md) using the [plan template](generic/plan-template.md)
3. [Draft the backlog](workflows/draft.md)
4. [Review and refine](workflows/review.md), launching [Plannotator](generic/plannotator-review.md) for the complete creation proposal
5. [Create approved items](workflows/create.md)

## Delivery and continuation

Only after the creation gate, follow [create.md](workflows/create.md). Create exactly the approved epic/stories or explicitly approved equivalent using the connected tracker; do not also publish reports, create branches, implement code, change existing issue status, or notify others.

Persist `<workspace.root>/.task-context.json`, preserving investigation state and adding the breakdown plan/draft paths and a record of the source report, latest draft, feedback resolved, pending questions, explicit creation approval, and created/confirmed/unconfirmed IDs. On continuation, reconcile actual tracker state before resuming. Report verified created links and any remaining failures; a partially created backlog is not complete.

No CI waiting or Git worktree is needed for report-to-backlog drafting; the shared artifact directory is required. Choose an available model/effort suitable for the task and respect user/runtime constraints; no mandatory per-step delegation is needed.
