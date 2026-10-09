---
name: act-mkt-work
description: "Execute a guarded software-work pipeline from a natural-language request: intake, approval-gated planning, workspace preparation, implementation, verification, and publication."
---

# Work

## Workflow direction

Treat the text that invoked this skill as the authoritative work request. Derive repository, Git, Jira, and hosted-review context from that request and the active workspace.

Execute the linked stages sequentially. Carry the complete invoking request and prior stage artifacts forward; do not replace source evidence with a summary. Follow the declared outcome route after each stage.

Use the model and thinking level specified for each stage. Model selection does not approve a plan or authorize publication. Ask one focused question only when a required business fact, access grant, or authority cannot be discovered. Stop for explicit human approval at an approval gate.

## Stages

| Stage | Prompt | Model | Thinking | Outcomes |
| --- | --- | --- | --- | --- |
| intake | [intake.md](intake.md) | `gateway/gemini-3.8-flash` | low | `ready` → plan; `blocked` → pause; `handoff` → intake |
| plan | [plan.md](plan.md) | `gateway/gpt-6.1-sol` | high | `ready` → prepare-workspace; `gaps` → intake; `blocked` → pause; `handoff` → plan |
| prepare-workspace | [prepare-workspace.md](prepare-workspace.md) | `gateway/gemini-3.8-flash` | low | `ready` → implement; `gaps` → plan; `blocked` → pause; `handoff` → prepare-workspace |
| implement | [implement.md](implement.md) | `gateway/kimi-k3` | high | `ready` → verify; `blocked` → pause; `handoff` → implement |
| verify | [verify.md](verify.md) | `gateway/grok-4.7` | high | `ready` → publish; `gaps` → implement; `blocked` → pause; `handoff` → verify |
| publish | [publish-remote.md](publish-remote.md) | `gateway/gemini-3.8-flash` | low | `ready` → done; `blocked` → pause; `handoff` → publish |

## Plan approval gate

Before `plan` can continue with `ready`, obtain explicit approval for an artifact with these exact level-2 headings:

- `Goal/Acceptance Criteria`
- `Non Goal`
- `Implementation Steps and Tests`
- `Validation`
- `Risks/Decisions Needed`
- `Publications Contract/Metadata`
- `Execution appendix (machine-readable)`

Obtain explicit human approval of the complete artifact before continuing.
