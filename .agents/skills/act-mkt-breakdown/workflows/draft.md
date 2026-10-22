# 2. Draft the backlog

Use [the epic/story template](../generic/epic-and-stories.md), adapting the user's preferred format. Propose one epic for the coherent outcome, with independently understandable stories in dependency order. If the report spans unrelated outcomes, surface that split for user review rather than creating extra epics automatically.

Each story must include:

- A clear title and description explaining the problem/outcome, scope, and relevant report context.
- Brief implementation steps with enough direction to execute, without pretending unverified design details are agreed.
- Observable acceptance criteria that define completion, including relevant failure/edge behavior and verification.
- Dependencies or sequencing when needed, referring to stable draft labels such as `S1` and `S2` until real tracker IDs exist.

Cover implementation, rollout, monitoring, and risk mitigation when the report requires them; do not manufacture a standard set of chores for every feature. Keep story boundaries practical and avoid duplicates or stories that merely restate another story's acceptance criteria. Do not invent estimates, assignees, dates, priority, or commitments the user has not chosen.
