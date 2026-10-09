---
name: act-mkt-mr-review
description: Review a PR or merge request through evidence collection, finding validation, approval, and publication of comments.
---

# MR Review

## Workflow direction

Treat the text that invoked this skill as the authoritative PR/MR review request. Derive the hosted-review URL, repository, branch, and discussion context from that request and the active workspace.

Execute the linked stages sequentially. Carry the complete invoking request and prior stage artifacts forward; do not replace source evidence with a summary. Follow the declared outcome route after each stage.

Use the model and thinking level specified for each stage. Model selection does not approve a plan or authorize publication. Ask one focused question only when a required business fact, access grant, or authority cannot be discovered. Stop for explicit human approval at an approval gate.

## Stages

| Stage | Prompt | Model | Thinking | Outcomes |
| --- | --- | --- | --- | --- |
| fetch | [fetch.md](fetch.md) | `gateway/gemini-3.8-flash` | low | `ready` → review; `blocked` → pause; `handoff` → fetch |
| review | [findings.md](findings.md) | `gateway/grok-4.7` | high | `ready` → plan; `gaps` → fetch; `blocked` → pause; `handoff` → review |
| plan | [plan.md](plan.md) | `gateway/gpt-6.1-sol` | high | `ready` → publish; `gaps` → review; `blocked` → pause; `handoff` → plan |
| publish | [publish-approved.md](publish-approved.md) | `gateway/gemini-3.8-flash` | low | `ready` → done; `blocked` → pause; `handoff` → publish |

## Review approval gate

Before `plan` can continue with `ready`, obtain explicit approval for an artifact with these exact level-2 headings:

- `Reviews`
- `Publication contract`

Obtain explicit human approval of the complete artifact before continuing.
