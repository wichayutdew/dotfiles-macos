---
description: One-line caveman-style code review comments
---
Load the `caveman-review` skill (~/.agents/skills/caveman-review/SKILL.md) and review the current code changes. One line per finding. Format: `path:line: <emoji> <severity>: <problem>. <fix>.` Severity: 🔴 bug, 🟡 risk, 🔵 nit, ❓ question. Skip praise. Skip obvious. If code looks good, say `No issues.` and stop.
