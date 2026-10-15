---
name: act-mkt-mr-comment
description: Resolve PR or merge-request review comments through evidence collection, planning, implementation, verification, and publication.
---

# MR Comment

## Workflow direction

Treat the text that invoked this skill as the authoritative review-comment request. Derive the hosted-review URL, repository, branch, and unresolved-discussion context from that request and the active workspace.

Execute the linked stages sequentially and automatically. Carry the complete invoking request and prior stage artifacts forward; do not replace source evidence with a summary. After each stage, immediately dispatch its declared outcome route without returning control to the user. `gaps` and `handoff` follow their declared recovery routes automatically.

The only user wait is the complete plan-review gate below. Put every user-answerable question, missing decision, required authorization, and publication choice in the plan artifact before presenting it. Revise and re-present at that same gate until explicitly approved. After approval, ask no questions and execute the approved routes and publication contract autonomously.

A `blocked` outcome is terminal only when safe continuation is impossible: report the factual blocker, do not ask a question or wait for user input, and never bypass required evidence, access, authority, or safety checks.

Use the model specified for each stage when available; otherwise, use an equivalent model available in the current environment with comparable capability for that stage. Preserve the specified thinking level, using the closest supported equivalent if the selected model uses different effort labels. Model selection does not approve a plan or authorize publication.

## Stages

| Stage | Prompt | Model | Thinking | Outcomes |
| --- | --- | --- | --- | --- |
| fetch | [fetch.md](fetch.md) | `gateway/gemini-3.8-flash` | low | `ready` → checkout-source; `blocked` → terminal report; `handoff` → fetch |
| checkout-source | [checkout-source.md](checkout-source.md) | `gateway/gemini-3.8-flash` | low | `ready` → plan; `gaps` → fetch; `blocked` → terminal report; `handoff` → checkout-source |
| plan | [plan.md](plan.md) | `gateway/gpt-6.1-sol` | high | `ready` → plan review, then implement on approval; `gaps` → fetch; `blocked` → terminal report; `handoff` → plan |
| implement | [implement.md](implement.md) | `gateway/kimi-k3` | high | `ready` → verify; `blocked` → terminal report; `handoff` → implement |
| verify | [verify.md](verify.md) | `gateway/grok-4.7` | high | `ready` → deliver; `gaps` → implement; `blocked` → terminal report; `handoff` → verify |
| deliver | [publish.md](publish.md) | `gateway/gemini-3.8-flash` | low | `ready` → done; `gaps` → implement; `blocked` → terminal report; `handoff` → deliver |

## Comment-plan approval gate

Before `plan` can continue with `ready`, obtain explicit approval for an artifact with these exact level-2 headings:

- `Comments`
- `Implementation plan`
- `Validation`
- `Execution appendix (machine-readable)`

Obtain explicit human approval of the complete artifact before continuing. Include every comment verdict, implementation choice, validation decision, and exact publication reply in this artifact; do not ask separately. On denial or feedback, revise and re-present the artifact at this gate. After approval, ask no questions.
