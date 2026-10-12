---
name: act-mkt-sprint-triage
description: Use when triaging support tickets requiring approval-gated knowledge-base reports, GitLab merge-request review, or optional Confluence guidance.
---

# Sprint Triage

## Workflow direction

Treat the text that invoked this skill as the authoritative triage request. Derive configured ticket, Slack, knowledge-base, and Confluence context from that request and available integrations.

Execute the linked stages sequentially and automatically. Carry the complete invoking request and prior stage artifacts forward; do not replace source evidence with a summary. After each stage, immediately dispatch its declared outcome route without returning control to the user. `gaps` and `handoff` follow their declared recovery routes automatically.

The only user wait is the complete plan-review gate below. Put every user-answerable question, missing decision, required authorization, configuration value, and publication choice in the plan artifact before presenting it. Revise and re-present at that same gate until explicitly approved. After approval, ask no questions and execute the approved routes and publication contract autonomously.

A `blocked` outcome is terminal only when safe continuation is impossible: report the factual blocker, do not ask a question or wait for user input, and never bypass required evidence, access, authority, or safety checks.

Use the model and thinking level specified for each stage. Model selection does not approve a plan or authorize publication.

## Stages

| Stage | Prompt | Model | Thinking | Outcomes |
| --- | --- | --- | --- | --- |
| collect | [collect.md](collect.md) | `gateway/gemini-3.8-flash` | low | `ready` → plan; `blocked` → terminal report; `handoff` → collect |
| plan | [plan.md](plan.md) | `gateway/gpt-6.1-sol` | high | `ready` → plan review, then checkout on approval; `gaps` → collect; `blocked` → terminal report; `handoff` → plan |
| checkout | [checkout.md](checkout.md) | `gateway/gemini-3.8-flash` | low | `ready` → implement; `blocked` → terminal report; `handoff` → checkout |
| implement | [implement.md](implement.md) | `gateway/kimi-k3` | high | `ready` → publish; `blocked` → terminal report; `handoff` → implement |
| publish | [publish.md](publish.md) | `gateway/gemini-3.8-flash` | low | `ready` → done; `gaps` → implement; `blocked` → terminal report; `handoff` → publish |

## Publication-plan approval gate

Before `plan` can continue with `ready`, obtain explicit approval for an artifact with these exact headings. The approved knowledge-base change is published through a GitLab merge request; a Confluence append is performed only when its approved publication fragment is non-empty:

- level 1: `Knowledge base repository`
- level 2: `Report`
- level 2: `Ledger`
- level 1: `Confluence top append`
- level 2: `Guides`
- level 2: `Publication fragment`
- level 1: `Execution contract`

The required report and execution-contract details are defined in [plan.md](plan.md). Obtain explicit human approval of the complete artifact before continuing. Include all unresolved decisions, required configuration values, and publication choices in this artifact; do not ask separately. On denial or feedback, revise and re-present the artifact at this gate. After approval, ask no questions.
