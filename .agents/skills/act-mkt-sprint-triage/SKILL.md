---
name: act-mkt-sprint-triage
description: Use when triaging support tickets requiring approval-gated knowledge-base reports, GitLab merge-request review, or optional Confluence guidance.
---

# Sprint Triage

## Workflow direction

Treat the text that invoked this skill as the authoritative triage request. Derive configured ticket, Slack, knowledge-base, and Confluence context from that request and available integrations.

Execute the linked stages sequentially. Carry the complete invoking request and prior stage artifacts forward; do not replace source evidence with a summary. Follow the declared outcome route after each stage.

Use the model and thinking level specified for each stage. Model selection does not approve a plan or authorize publication. Ask one focused question only when a required business fact, access grant, or authority cannot be discovered. Stop for explicit human approval at an approval gate.

## Stages

| Stage | Prompt | Model | Thinking | Outcomes |
| --- | --- | --- | --- | --- |
| collect | [collect.md](collect.md) | `gateway/gemini-3.8-flash` | low | `ready` → plan; `blocked` → pause; `handoff` → collect |
| plan | [plan.md](plan.md) | `gateway/gpt-6.1-sol` | high | `ready` → checkout; `gaps` → collect; `blocked` → pause; `handoff` → plan |
| checkout | [checkout.md](checkout.md) | `gateway/gemini-3.8-flash` | low | `ready` → implement; `blocked` → pause; `handoff` → checkout |
| implement | [implement.md](implement.md) | `gateway/kimi-k3` | high | `ready` → publish; `blocked` → pause; `handoff` → implement |
| publish | [publish.md](publish.md) | `gateway/gemini-3.8-flash` | low | `ready` → done; `gaps` → implement; `blocked` → pause; `handoff` → publish |

## Publication-plan approval gate

Before `plan` can continue with `ready`, obtain explicit approval for an artifact with these exact headings. The approved knowledge-base change is published through a GitLab merge request; a Confluence append is performed only when its approved publication fragment is non-empty:

- level 1: `Knowledge base repository`
- level 2: `Report`
- level 2: `Ledger`
- level 1: `Confluence top append`
- level 2: `Guides`
- level 2: `Publication fragment`
- level 1: `Execution contract`

The required report and execution-contract details are defined in [plan.md](plan.md). Obtain explicit human approval of the complete artifact before continuing.
