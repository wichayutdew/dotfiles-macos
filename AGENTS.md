# Global Agent Rules

Make the smallest coherent change, follow local conventions, and support claims with evidence.

## Working rules

- Use `rg` or `rg --files` for searches. Never use `grep` or `find`.
- Before repo edits, capture the branch, `HEAD`, and `git status --short`. Preserve unrelated changes.
- Establish the goal, acceptance criteria, and verification method. Ask only for information unavailable from existing evidence.
- Cite relevant files or tool results. Distinguish confirmed facts from hypotheses and unknowns.
- For versioned library documentation, use Context7: resolve the library, then query its docs.
- Verify URLs before sharing them; use plain text URLs.
- Keep secrets out of output. Push, merge, or change external services only with authority for that action.
- Use one writer per file. Add tests when they provide meaningful coverage, not merely to satisfy TDD.

## Planning and approval

- Save plans under `~/repositories/personal/plans/plannotator/`.
- For implementation, reuse a suitable linked worktree or create one under `~/repositories/worktrees/`.
- Obtain Plannotator approval before editing product code.
- After approval, complete all in-scope work and verification without asking for routine approval again.
- Stop only for missing required information, credentials, authority, an out-of-scope decision, or a failure that available evidence cannot resolve.

<!-- plannotator:blocking-plan-review:start -->
### Blocking plan review

Run the saved plan through an explicit gate before ending the turn:

```bash
~/.local/bin/plannotator annotate "<plan-path>" --gate --json --require-approval
```

- Expand `~/` before quoting the plan path.
- Wait until the process exits. If the tool returns a session ID, keep waiting on that session. Do not end the turn, abandon the process, or open duplicate reviews while a decision is pending.
- `approved` + exit `0`: incorporate notes and proceed with approved work.
- `annotated` + exit `1`: revise the plan and submit it again before implementation.
- `dismissed`, invalid/missing JSON, or failure: do not implement; report the outcome.
- Do not use `--hook` or rely on an end-of-turn hook for this transition.
- If using a structured gate tool with an `artifact` field, pass the complete Markdown text; the CLI above takes a file path.
<!-- plannotator:blocking-plan-review:end -->

## PRs and merge requests

- Prefer GitHub/GitLab MCP. Use `gh`/`glab` when the MCP cannot perform the action, and state why.
- New descriptions: use only verified repository or host template fields. If no template is available, create without supplying a description, read back the host-generated description, and edit only the workflow-owned marker region.
- Existing PRs/MRs: preserve the title and text outside workflow-owned markers. Append a marker region if needed.

## Skills and delegation

- When explicitly asked to use a skill, read its `SKILL.md` and follow its sequence, gates, and deliverables. A passing mention is not an invocation.
- Use subagents when independent work benefits from delegation and the active rules permit it.
- During declarative workflow steps, do not launch subagents. Read only skills listed in the step YAML unless the user explicitly invokes another skill.

## Execution and communication

- Take the next concrete action when unblocked. Avoid progress messages that only promise future work.
- Before compaction, preserve the goal, acceptance criteria, verification method, repo state, and next action.
- Keep chat concise and reports easy to scan. Use headings and bullets where useful.
- Put machine-readable handoffs under `## Machine-readable handoff` in a valid fenced JSON block.
- In workflows, use `blocked` only for genuine blockers and `retry` only for transient failures needing no user input. Do not disguise questions as `retry`, `handoff`, or next-step outcomes.
