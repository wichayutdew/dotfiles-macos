---
name: act-mkt-investigate
description: Investigate a Jira issue or question through scope approval, evidence gathering, validation, and a written report.
---

# Investigate

## Workflow direction

Treat the text that invoked this skill as the authoritative investigation request. Derive Jira, repository, logs, and other integration context from that request and the active workspace.

## Report destination intake

- Before starting the automated stages, check whether the invoking request provides the exact report file path.
- If it does not, explicitly ask the user: “What exact file path should I use for the investigation report?” Do not infer, invent, or choose a default path. Wait for the answer before continuing with intake.
- Carry the supplied path unchanged into `# Report destination` in the plan artifact and through report writing. Do not mark the plan `ready` or write the report while the path is missing.

## Workspace policy

- Investigations and report generation are read-only with respect to product code and use the active repository checkout. Never create a Git worktree for an investigation, switch branches, or check out another revision solely for an investigation.
- Preserve existing checkout state and unrelated changes. Capture branch, `HEAD`, and `git status --short` before any approved local documentation/report write.
- Keep investigation notes and report artifacts in the approved destination. If product implementation is requested, keep it out of the investigation and route it through the separately approved implementation workflow; do not silently expand scope.

Execute the linked stages sequentially and automatically. Carry the complete invoking request and prior stage artifacts forward; do not replace source evidence with a summary. After each stage, immediately dispatch its declared outcome route without returning control to the user. `gaps` and `handoff` follow their declared recovery routes automatically.

The only user waits are the intake request for an exact report file path when it is missing, and the complete plan-review gate below. Put every other user-answerable question, missing decision, required authorization, and publication choice in the plan artifact before presenting it. Revise and re-present at that same gate until explicitly approved. After approval, ask no questions and execute the approved routes and publication contract autonomously.

A `blocked` outcome is terminal only when safe continuation is impossible: report the factual blocker, do not ask a question or wait for user input, and never bypass required evidence, access, authority, or safety checks.

Use the model specified for each stage when available; otherwise, use an equivalent model available in the current environment with comparable capability for that stage. Preserve the specified thinking level, using the closest supported equivalent if the selected model uses different effort labels. Model selection does not approve a plan or authorize publication.

## Report format

- Prefer diagrams or tables over prose whenever they communicate the report information clearly.
- When text is necessary, use only concise bullet points; do not write prose paragraphs.
- Preserve the approved report headings, evidence citations, and required detail while applying this format.

## Stages

| Stage | Prompt | Model | Thinking | Outcomes |
| --- | --- | --- | --- | --- |
| intake | [intake.md](intake.md) | `gateway/gemini-3.8-flash` | low | `ready` → plan; `blocked` → terminal report; `handoff` → intake |
| plan | [plan.md](plan.md) | `gateway/gpt-6.1-sol` | high | `ready` → plan review, then research on approval; `gaps` → intake; `blocked` → terminal report; `handoff` → plan |
| research | [research.md](research.md) | `gateway/gpt-6.1-sol` | high | `ready` → validate; `blocked` → terminal report; `handoff` → research |
| validate | [validate.md](validate.md) | `gateway/grok-4.7` | high | `ready` → write-report; `gaps` → research; `blocked` → terminal report; `handoff` → validate |
| write-report | [write-report.md](write-report.md) | `gateway/gemini-3.8-flash` | low | `ready` → done; `gaps` → validate; `blocked` → terminal report; `handoff` → write-report |

## Scope approval gate

Before `plan` can continue with `ready`, obtain explicit approval for an artifact with these exact headings. `# Report destination` must contain the exact report file path supplied by the user:

- level 1: `Report destination`
- level 2: `Goal/Acceptance Criteria`
- level 2: `Non Goal`
- level 2: `Investigation Resources`
- level 2: `Questions`

Obtain explicit human approval of the complete artifact before continuing. Put unresolved investigation questions and required decisions in `Questions`; do not ask them separately. On denial or feedback, revise and re-present the artifact at this gate. After approval, ask no questions.

Plannotator is optional; explicit human approval is required. Save the complete artifact as a Markdown file. If a Plannotator tool or installed CLI is available, use it to present the complete artifact for approval. Otherwise, provide the Markdown file path and explicitly ask the user to review the file and approve in a chat response. Wait for explicit approval through the selected interface before continuing. Silence, dismissal, or a tool failure is not approval; revise and re-present the artifact on feedback.
