---
name: act-mkt-work
description: "Execute a guarded software-work pipeline from a natural-language request: intake, approval-gated planning, workspace preparation, implementation, verification, and publication."
---

# Work

## Workflow direction

Treat the text that invoked this skill as the authoritative work request. Derive repository, Git, Jira, and hosted-review context from that request and the active workspace.

Execute the linked stages sequentially and automatically. Carry the complete invoking request and prior stage artifacts forward; do not replace source evidence with a summary. After each stage, immediately dispatch its declared outcome route without returning control to the user. `gaps` and `handoff` follow their declared recovery routes automatically.

The only user wait is the complete plan-review gate below. Put every user-answerable question, missing decision, required authorization, and publication choice in the plan artifact before presenting it. Revise and re-present at that same gate until explicitly approved. After approval, ask no questions and execute the approved routes and publication contract autonomously.

A `blocked` outcome is terminal only when safe continuation is impossible: report the factual blocker, do not ask a question or wait for user input, and never bypass required evidence, access, authority, or safety checks.

Use the model and thinking level specified for each stage. Model selection does not approve a plan or authorize publication.

## Stages

| Stage | Prompt | Model | Thinking | Outcomes |
| --- | --- | --- | --- | --- |
| intake | [intake.md](intake.md) | `gateway/gemini-3.8-flash` | low | `ready` → plan; `blocked` → terminal report; `handoff` → intake |
| plan | [plan.md](plan.md) | `gateway/gpt-6.1-sol` | high | `ready` → plan review, then prepare-workspace on approval; `gaps` → intake; `blocked` → terminal report; `handoff` → plan |
| prepare-workspace | [prepare-workspace.md](prepare-workspace.md) | `gateway/gemini-3.8-flash` | low | `ready` → implement; `gaps` → plan; `blocked` → terminal report; `handoff` → prepare-workspace |
| implement | [implement.md](implement.md) | `gateway/kimi-k3` | high | `ready` → verify; `blocked` → terminal report; `handoff` → implement |
| verify | [verify.md](verify.md) | `gateway/grok-4.7` | high | `ready` → publish; `gaps` → implement; `blocked` → terminal report; `handoff` → verify |
| publish | [publish-remote.md](publish-remote.md) | `gateway/gemini-3.8-flash` | low | `ready` → done; `blocked` → terminal report; `handoff` → publish |

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
