---
name: investigate
description: Investigate a Jira issue or question through scope approval, evidence gathering, validation, and a written report.
---

# Investigate

## Portable execution contract

Treat the text that invoked this skill as the authoritative investigation request. Derive Jira, repository, logs, and other integration context from that request and the active workspace. Do not require workflow template variables, a restart workspace, a session ID, or a state-file path.

When running in Pi inside Herdr (`HERDR_ENV=1`), run the bundled adapter from this skill directory after confirming `pi` and `herdr` are available:

```sh
python3 scripts/run-pi.py --stage <stage> --request "<natural-language request>" [--previous-handoff <path>]
```

Do not execute the stage prompts inline in that environment. For exactly one stage selected by the main agent, the adapter opens a fresh, unfocused Herd pane with an interactive Pi child. That child writes its temporary JSON handoff through the supplied completion tool, exits, and the adapter closes the child pane before returning the validated handoff to the main agent.

If Pi or Herd is unavailable, use a fresh subagent when the harness supports subagents. Give that subagent only the invoking request, the prior stage artifact, and the linked stage prompt; do not give it or rely on parent conversational context. The parent retains only the resulting artifact and declared outcome before starting the next fresh subagent. If no subagent capability exists, execute the stage in the main agent pane. Carry prior artifacts there, ask one focused question only when a required business fact, access grant, or authority cannot be discovered, and stop for explicit human approval at an approval gate. A compatible harness may use equivalent authenticated tools; otherwise report that dependency as blocked.

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

For one fresh interactive Pi process with the table's model and thinking preferences, run `python3 scripts/run-pi.py --stage <stage> --request "<natural-language request>" [--previous-handoff <path>]`. The adapter launches only that stage in a background horizontal Herd split, waits for the child to persist and signal its handoff, then closes that exact child pane without closing the caller pane. It prints the validated handoff path and contents; the invoking main agent alone reads that result and decides the next stage, retry, block, or approval gate. If Pi or Herd is unavailable, execute the documented stage in the active session instead.
