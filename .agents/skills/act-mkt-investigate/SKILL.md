---
name: act-mkt-investigate
description: Investigate a Jira issue or question through scope approval, evidence gathering, validation, and a written report.
---

# Investigate

## Workflow direction

Treat the text that invoked this skill as the authoritative investigation request. Derive Jira, repository, logs, and other integration context from that request and the active workspace.

Execute the linked stages sequentially and automatically. Carry the complete invoking request and prior stage artifacts forward; do not replace source evidence with a summary. After each stage, immediately dispatch its declared outcome route without returning control to the user. `gaps` and `handoff` follow their declared recovery routes automatically.

The only user wait is the complete plan-review gate below. Put every user-answerable question, missing decision, required authorization, and publication choice in the plan artifact before presenting it. Revise and re-present at that same gate until explicitly approved. After approval, ask no questions and execute the approved routes and publication contract autonomously.

A `blocked` outcome is terminal only when safe continuation is impossible: report the factual blocker, do not ask a question or wait for user input, and never bypass required evidence, access, authority, or safety checks.

Use the model and thinking level specified for each stage. Model selection does not approve a plan or authorize publication.

## Stages

| Stage | Prompt | Model | Thinking | Outcomes |
| --- | --- | --- | --- | --- |
| intake | [intake.md](intake.md) | `gateway/gemini-3.8-flash` | low | `ready` → plan; `blocked` → terminal report; `handoff` → intake |
| plan | [plan.md](plan.md) | `gateway/gpt-6.1-sol` | high | `ready` → plan review, then research on approval; `gaps` → intake; `blocked` → terminal report; `handoff` → plan |
| research | [research.md](research.md) | `gateway/gpt-6.1-sol` | high | `ready` → validate; `blocked` → terminal report; `handoff` → research |
| validate | [validate.md](validate.md) | `gateway/grok-4.7` | high | `ready` → write-report; `gaps` → research; `blocked` → terminal report; `handoff` → validate |
| write-report | [write-report.md](write-report.md) | `gateway/gemini-3.8-flash` | low | `ready` → done; `gaps` → validate; `blocked` → terminal report; `handoff` → write-report |

## Scope approval gate

Before `plan` can continue with `ready`, obtain explicit approval for an artifact with these exact headings:

- level 1: `Report destination`
- level 2: `Goal/Acceptance Criteria`
- level 2: `Non Goal`
- level 2: `Investigation Resources`
- level 2: `Questions`

Obtain explicit human approval of the complete artifact before continuing. Put unresolved investigation questions and required decisions in `Questions`; do not ask them separately. On denial or feedback, revise and re-present the artifact at this gate. After approval, ask no questions.
