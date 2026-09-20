---
name: work
description: "Execute a guarded software-work pipeline from a natural-language request: intake, approval-gated planning, workspace preparation, implementation, verification, and publication."
---

# Work

## Portable execution contract

Treat the text that invoked this skill as the authoritative work request. Derive repository, Git, Jira, and hosted-review context from that request and the active workspace. Do not require workflow template variables, a restart workspace, a session ID, or a state-file path.

For each stage, use a fresh subagent whenever the harness supports subagents. Give that subagent only the invoking request, the prior stage artifact, and the linked stage prompt; do not give it or rely on parent conversational context. The parent retains only the resulting artifact and declared outcome before starting the next fresh subagent. If the harness has no subagent capability, load the stage prompt in the active session and carry prior artifacts there. Ask one focused question only when a required business fact, access grant, or authority cannot be discovered. At an approval gate, stop for explicit human approval before continuing. A compatible harness may use equivalent authenticated tools; otherwise report that dependency as blocked.

## Stages

| Stage | Prompt | Pi role / model | Outcomes |
| --- | --- | --- | --- |
| intake | [intake.md](intake.md) | scout — `gateway/gemini-3.8-flash`, low | `ready` → plan; `blocked` → pause; `handoff` → intake |
| plan | [plan.md](plan.md) | planner — `gateway/gpt-5.6-terra`, high | `ready` → prepare-workspace; `gaps` → intake; `blocked` → pause; `handoff` → plan |
| prepare-workspace | [prepare-workspace.md](prepare-workspace.md) | scout — `gateway/gemini-3.8-flash`, low | `ready` → implement; `gaps` → plan; `blocked` → pause; `handoff` → prepare-workspace |
| implement | [implement.md](implement.md) | worker — `gateway/kimi-k2.7-code`, high | `ready` → verify; `blocked` → pause; `handoff` → implement |
| verify | [verify.md](verify.md) | reviewer — `gateway/grok-4.6`, high | `ready` → publish; `gaps` → implement; `blocked` → pause; `handoff` → verify |
| publish | [publish-remote.md](publish-remote.md) | scout — `gateway/gemini-3.8-flash`, low | `ready` → done; `blocked` → pause; `handoff` → publish |

## Plan approval gate

Before `plan` can continue with `ready`, obtain explicit approval for an artifact with these exact level-2 headings:

- `Goal/Acceptance Criteria`
- `Non Goal`
- `Implementation Steps and Tests`
- `Validation`
- `Risks/Decisions Needed`
- `Publications Contract/Metadata`
- `Execution appendix (machine-readable)`

When Plannotator is available, submit the complete artifact to Plannotator and wait for its approval before continuing. Otherwise, stop in the conversation for explicit human approval rather than claiming an extension validates it.

## Pi adapter

For fresh Pi processes with the table's model and thinking preferences, run `python3 scripts/run-pi.py "<natural-language request>"`. When running inside Herdr, the adapter opens a background horizontal split for each stage, closes that exact pane after its artifact is captured, and never closes the caller pane. The adapter creates its own state and stops at this approval gate. If Pi or a requested model is unavailable, execute the documented stages in the active session instead.
