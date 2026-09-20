---
name: mr-review
description: Review a PR or merge request through evidence collection, finding validation, approval, and publication of comments.
---

# MR Review

## Portable execution contract

Treat the text that invoked this skill as the authoritative PR/MR review request. Derive the hosted-review URL, repository, branch, and discussion context from that request and the active workspace. Do not require workflow template variables, a restart workspace, a session ID, or a state-file path.

When running in Pi inside Herdr (`HERDR_ENV=1`), run the bundled adapter from this skill directory after confirming `pi` and `herdr` are available:

```sh
python3 scripts/run-pi.py "<natural-language request>"
```

Do not execute the stage prompts inline in that environment. The adapter launches every stage in a fresh, unfocused background Herdr pane, captures its artifact, and closes that child pane after the stage completes.

For non-Pi+Herdr contexts, use a fresh subagent whenever the harness supports subagents. Give that subagent only the invoking request, the prior stage artifact, and the linked stage prompt; do not give it or rely on parent conversational context. The parent retains only the resulting artifact and declared outcome before starting the next fresh subagent. If the harness has no subagent capability, load the stage prompt in the active session and carry prior artifacts there. Ask one focused question only when a required business fact, access grant, or authority cannot be discovered. At an approval gate, stop for explicit human approval before continuing. A compatible harness may use equivalent authenticated tools; otherwise report that dependency as blocked.

## Stages

| Stage | Prompt | Pi role / model | Outcomes |
| --- | --- | --- | --- |
| fetch | [fetch.md](fetch.md) | scout — `gateway/gemini-3.8-flash`, low | `ready` → review; `blocked` → pause; `handoff` → fetch |
| review | [findings.md](findings.md) | reviewer — `gateway/grok-4.6`, high | `ready` → plan; `gaps` → fetch; `blocked` → pause; `handoff` → review |
| plan | [plan.md](plan.md) | planner — `gateway/gpt-5.6-terra`, high | `ready` → publish; `gaps` → review; `blocked` → pause; `handoff` → plan |
| publish | [publish-approved.md](publish-approved.md) | scout — `gateway/gemini-3.8-flash`, low | `ready` → done; `blocked` → pause; `handoff` → publish |

## Review approval gate

Before `plan` can continue with `ready`, obtain explicit approval for an artifact with these exact level-2 headings:

- `Reviews`
- `Publication contract`

When Plannotator is available, submit the complete artifact to Plannotator and wait for its approval before continuing. Otherwise, stop in the conversation for explicit human approval rather than claiming an extension validates it.

## Pi adapter

For fresh Pi processes with the table's model and thinking preferences, run `python3 scripts/run-pi.py "<natural-language request>"`. When running inside Herdr, the adapter opens a background horizontal split for each stage, closes that exact pane after its artifact is captured, and never closes the caller pane. The adapter creates its own state and stops at this approval gate. If Pi or a requested model is unavailable, execute the documented stages in the active session instead.
