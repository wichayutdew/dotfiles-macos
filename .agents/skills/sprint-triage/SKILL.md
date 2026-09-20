---
name: sprint-triage
description: Use when triaging support tickets requiring approval-gated knowledge-base reports, GitLab merge-request review, or optional Confluence guidance.
---

# Sprint Triage

## Portable execution contract

Treat the text that invoked this skill as the authoritative triage request. Derive configured ticket, Slack, knowledge-base, and Confluence context from that request and available integrations. Do not require workflow template variables, a restart workspace, a session ID, or a state-file path.

When running in Pi inside Herdr (`HERDR_ENV=1`), run the bundled adapter from this skill directory after confirming `pi` and `herdr` are available:

```sh
python3 scripts/run-pi.py "<natural-language request>"
```

Do not execute the stage prompts inline in that environment. The adapter launches every stage in a fresh, unfocused background Herdr pane, captures its artifact, and closes that child pane after the stage completes.

For non-Pi+Herdr contexts, use a fresh subagent whenever the harness supports subagents. Give that subagent only the invoking request, the prior stage artifact, and the linked stage prompt; do not give it or rely on parent conversational context. The parent retains only the resulting artifact and declared outcome before starting the next fresh subagent. If the harness has no subagent capability, load the stage prompt in the active session and carry prior artifacts there. Ask one focused question only when a required business fact, access grant, or authority cannot be discovered. At an approval gate, stop for explicit human approval before continuing. A compatible harness may use equivalent authenticated tools; otherwise report that dependency as blocked.

## Stages

| Stage | Prompt | Pi role / model | Outcomes |
| --- | --- | --- | --- |
| collect | [collect.md](collect.md) | scout — `gateway/gemini-3.8-flash`, low | `ready` → plan; `blocked` → pause; `handoff` → collect |
| plan | [plan.md](plan.md) | planner — `gateway/gpt-5.6-terra`, high | `ready` → checkout; `gaps` → collect; `blocked` → pause; `handoff` → plan |
| checkout | [checkout.md](checkout.md) | scout — `gateway/gemini-3.8-flash`, low | `ready` → implement; `blocked` → pause; `handoff` → checkout |
| implement | [implement.md](implement.md) | worker — `gateway/kimi-k2.7-code`, high | `ready` → publish; `blocked` → pause; `handoff` → implement |
| publish | [publish.md](publish.md) | scout — `gateway/gemini-3.8-flash`, low | `ready` → done; `gaps` → implement; `blocked` → pause; `handoff` → publish |

## Publication-plan approval gate

Before `plan` can continue with `ready`, obtain explicit approval for an artifact with these exact headings. The approved knowledge-base change is published through a GitLab merge request; a Confluence append is performed only when its approved publication fragment is non-empty:

- level 1: `Knowledge base repository`
- level 2: `Report`
- level 2: `Ledger`
- level 1: `Confluence top append`
- level 2: `Guides`
- level 2: `Publication fragment`
- level 1: `Execution contract`

The required report and execution-contract details are defined in [plan.md](plan.md). When Plannotator is available, submit the complete artifact to Plannotator and wait for its approval before continuing. Otherwise, stop in the conversation for explicit human approval rather than claiming an extension validates it.

## Pi adapter

For fresh Pi processes with the table's model and thinking preferences, run `python3 scripts/run-pi.py "<natural-language request>"`. When running inside Herdr, the adapter opens a background horizontal split for each stage, closes that exact pane after its artifact is captured, and never closes the caller pane. The adapter creates its own state and stops at this approval gate. If Pi or a requested model is unavailable, execute the documented stages in the active session instead.
