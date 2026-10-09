---
name: act-mkt-mr-comment
description: Resolve PR or merge-request review comments through evidence collection, planning, implementation, verification, and publication.
---

# MR Comment

## Workflow direction

Treat the text that invoked this skill as the authoritative review-comment request. Derive the hosted-review URL, repository, branch, and unresolved-discussion context from that request and the active workspace.

Execute the linked stages sequentially. Carry the complete invoking request and prior stage artifacts forward; do not replace source evidence with a summary. Follow the declared outcome route after each stage.

Use the model and thinking level specified for each stage. Model selection does not approve a plan or authorize publication. Ask one focused question only when a required business fact, access grant, or authority cannot be discovered. Stop for explicit human approval at an approval gate.

## Stages

| Stage | Prompt | Model | Thinking | Outcomes |
| --- | --- | --- | --- | --- |
| fetch | [fetch.md](fetch.md) | `gateway/gemini-3.8-flash` | low | `ready` → checkout-source; `blocked` → pause; `handoff` → fetch |
| checkout-source | [checkout-source.md](checkout-source.md) | `gateway/gemini-3.8-flash` | low | `ready` → plan; `gaps` → fetch; `blocked` → pause; `handoff` → checkout-source |
| plan | [plan.md](plan.md) | `gateway/gpt-6.1-sol` | high | `ready` → implement; `gaps` → fetch; `blocked` → pause; `handoff` → plan |
| implement | [implement.md](implement.md) | `gateway/kimi-k3` | high | `ready` → verify; `blocked` → pause; `handoff` → implement |
| verify | [verify.md](verify.md) | `gateway/grok-4.7` | high | `ready` → deliver; `gaps` → implement; `blocked` → pause; `handoff` → verify |
| deliver | [publish.md](publish.md) | `gateway/gemini-3.8-flash` | low | `ready` → done; `gaps` → implement; `blocked` → pause; `handoff` → deliver |

## Comment-plan approval gate

Before `plan` can continue with `ready`, obtain explicit approval for an artifact with these exact level-2 headings:

- `Comments`
- `Implementation plan`
- `Validation`
- `Execution appendix (machine-readable)`

Obtain explicit human approval of the complete artifact before continuing.
