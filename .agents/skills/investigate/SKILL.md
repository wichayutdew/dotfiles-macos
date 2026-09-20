---
name: investigate
description: Investigate a Jira issue or question through scope approval, evidence gathering, validation, and a written report.
---

# Investigate

## Portable execution contract

Treat the text that invoked this skill as the authoritative investigation request. Derive Jira, repository, logs, and other integration context from that request and the active workspace. Do not require workflow template variables, a restart workspace, a session ID, or a state-file path.

For each stage, use a fresh subagent whenever the harness supports subagents. Give that subagent only the invoking request, the prior stage artifact, and the linked stage prompt; do not give it or rely on parent conversational context. The parent retains only the resulting artifact and declared outcome before starting the next fresh subagent. If the harness has no subagent capability, load the stage prompt in the active session and carry prior artifacts there. Ask one focused question only when a required business fact, access grant, or authority cannot be discovered. At an approval gate, stop for explicit human approval before continuing. A compatible harness may use equivalent authenticated tools; otherwise report that dependency as blocked.

## Stages

| Stage | Prompt | Pi role / model | Outcomes |
| --- | --- | --- | --- |
| intake | [intake.md](intake.md) | scout — `gateway/gemini-3.8-flash`, low | `ready` → plan; `blocked` → pause; `handoff` → intake |
| plan | [plan.md](plan.md) | planner — `gateway/gpt-5.6-terra`, high | `ready` → research; `gaps` → intake; `blocked` → pause; `handoff` → plan |
| research | [research.md](research.md) | planner — `gateway/gpt-5.6-terra`, high | `ready` → validate; `blocked` → pause; `handoff` → research |
| validate | [validate.md](validate.md) | reviewer — `gateway/grok-4.6`, high | `ready` → write-report; `gaps` → research; `blocked` → pause; `handoff` → validate |
| write-report | [write-report.md](write-report.md) | scout — `gateway/gemini-3.8-flash`, low | `ready` → done; `gaps` → validate; `blocked` → pause; `handoff` → write-report |

## Scope approval gate

Before `plan` can continue with `ready`, obtain explicit approval for an artifact with these exact headings:

- level 1: `Report destination`
- level 2: `Goal/Acceptance Criteria`
- level 2: `Non Goal`
- level 2: `Investigation Resources`
- level 2: `Questions`

When Plannotator is available, submit the complete artifact to Plannotator and wait for its approval before continuing. Otherwise, stop in the conversation for explicit human approval rather than claiming an extension validates it.

## Pi adapter

For fresh Pi processes with the table's model and thinking preferences, run `python3 scripts/run-pi.py "<natural-language request>"`. When running inside Herdr, the adapter opens a background horizontal split for each stage, closes that exact pane after its artifact is captured, and never closes the caller pane. The adapter creates its own state and stops at this approval gate. If Pi or a requested model is unavailable, execute the documented stages in the active session instead.
