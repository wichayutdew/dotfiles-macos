---
name: mr-comment
description: Resolve PR or merge-request review comments through evidence collection, planning, implementation, verification, and publication.
---

# MR Comment

## Portable execution contract

Treat the text that invoked this skill as the authoritative review-comment request. Derive the hosted-review URL, repository, branch, and unresolved-discussion context from that request and the active workspace. Do not require workflow template variables, a restart workspace, a session ID, or a state-file path.

For each stage, use a fresh subagent whenever the harness supports subagents. Give that subagent only the invoking request, the prior stage artifact, and the linked stage prompt; do not give it or rely on parent conversational context. The parent retains only the resulting artifact and declared outcome before starting the next fresh subagent. If the harness has no subagent capability, load the stage prompt in the active session and carry prior artifacts there. Ask one focused question only when a required business fact, access grant, or authority cannot be discovered. At an approval gate, stop for explicit human approval before continuing. A compatible harness may use equivalent authenticated tools; otherwise report that dependency as blocked.

## Stages

| Stage | Prompt | Pi role / model | Outcomes |
| --- | --- | --- | --- |
| fetch | [fetch.md](fetch.md) | scout — `gateway/gemini-3.8-flash`, low | `ready` → checkout-source; `blocked` → pause; `handoff` → fetch |
| checkout-source | [checkout-source.md](checkout-source.md) | scout — `gateway/gemini-3.8-flash`, low | `ready` → plan; `gaps` → fetch; `blocked` → pause; `handoff` → checkout-source |
| plan | [plan.md](plan.md) | planner — `gateway/gpt-5.6-terra`, high | `ready` → implement; `gaps` → fetch; `blocked` → pause; `handoff` → plan |
| implement | [implement.md](implement.md) | worker — `gateway/kimi-k2.7-code`, high | `ready` → verify; `blocked` → pause; `handoff` → implement |
| verify | [verify.md](verify.md) | reviewer — `gateway/grok-4.6`, high | `ready` → deliver; `gaps` → implement; `blocked` → pause; `handoff` → verify |
| deliver | [publish.md](publish.md) | scout — `gateway/gemini-3.8-flash`, low | `ready` → done; `gaps` → implement; `blocked` → pause; `handoff` → deliver |

## Comment-plan approval gate

Before `plan` can continue with `ready`, obtain explicit approval for an artifact with these exact level-2 headings:

- `Comments`
- `Implementation plan`
- `Validation`
- `Execution appendix (machine-readable)`

When Plannotator is available, submit the complete artifact to Plannotator and wait for its approval before continuing. Otherwise, stop in the conversation for explicit human approval rather than claiming an extension validates it.

## Pi adapter

For fresh Pi processes with the table's model and thinking preferences, run `python3 scripts/run-pi.py "<natural-language request>"`. When running inside Herdr, the adapter opens a background horizontal split for each stage, closes that exact pane after its artifact is captured, and never closes the caller pane. The adapter creates its own state and stops at this approval gate. If Pi or a requested model is unavailable, execute the documented stages in the active session instead.
