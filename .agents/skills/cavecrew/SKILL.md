---
name: cavecrew
description: Choose and brief a small caveman-style subagent workflow for code search, implementation, debugging, or review. Use when the user requests delegation, subagents, cavecrew, parallel scouts, or compressed agent handoffs.
---

# Compact Delegation

Delegate to isolate evidence or obtain an independent review, not by default.

## Roles

- **Scout:** locate code, trace behavior, inspect history, or collect one evidence stream. Pi: `scout`. OpenCode: `explore`, `scout`, or `investigator`.
- **Writer:** own one scoped implementation and its tests. Prefer main thread. Pi may use one `worker`; OpenCode uses primary `build`.
- **Reviewer:** inspect actual diff, requirements, and verification with fresh context. Pi: `reviewer`. OpenCode: `code-reviewer`.

Do not reference agent names that runtime does not list.

## Budget

- Trivial task: zero subagents.
- Typical non-trivial task: one scout, then main writer.
- Broad investigation: at most two parallel scouts for independent questions.
- Meaningful implementation: one writer and one final reviewer.
- Never use multiple writers on same worktree. Avoid nested agents and automatic pre-plan/post-plan passes.

## Brief Contract

Give each agent:

1. One question or outcome.
2. Exact scope and read/write boundary.
3. Known requirements and evidence, without full conversation dump.
4. Required sources or checks.
5. Stop condition and output format.

Prefer fresh context with a compact evidence brief. Main thread must verify returned claims before acting.

## Return Contract

```text
FACT <claim> — <path:line, command, or tool result>
HYPOTHESIS <claim> — confidence; support; contradiction; falsifier
UNKNOWN <missing fact> — blocking?; next check
CHECKED <files, commands, sources>
```

Compress wording only. Never compress requirements, evidence, reasoning, code, tests, safety details, or external documents.
