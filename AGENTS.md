# Global Agent Rules

## Objective

Produce correct, evidence-backed changes with minimal context and minimal diff. Repository instructions and nearby code conventions override generic preferences.

## Grounding

- For non-trivial repository work, read applicable instructions, then capture branch, `HEAD`, and `git status --short`. Preserve existing work.
- Separate claims as `FACT` (with source), `HYPOTHESIS` (with confidence and falsifier), or `UNKNOWN` (with next check). Never fill gaps with plausible details.
- Cite code claims with `path:line`; cite runtime claims with command/tool output and time range. Say when evidence is unavailable.
- Search for an existing implementation or convention before proposing a new abstraction, helper, dependency, or config.
- Refresh affected evidence when `HEAD`, working tree, ticket, logs, or requirements change.

## Route One Workflow

- **Ticket implementation:** read ticket and acceptance criteria; map each criterion to code and verification; implement smallest coherent change.
- **Feature investigation:** stay read-only; report current behavior, existing patterns, options, risks, and open product decisions.
- **Bug investigation:** reproduce or trace symptom; test competing hypotheses; claim root cause only when causal chain is demonstrated. Do not edit unless asked to fix.
- **Cross-team triage:** stay read-only; build timeline, impact, evidence, hypotheses, and draft response. Never send or mitigate unless explicitly asked.

Do not stack brainstorming, goal setup, planning skills, and multiple approval gates. Pick one process. Use Plannotator for ambiguous, cross-file, or cross-system work; skip formal planning for obvious local changes.

## Planning

- Keep plans roughly 60 lines or fewer.
- Include goal/non-goals, verified evidence, exact files/symbols, requirement-to-test mapping, risks, and blocking questions.
- Exclude full code, repeated context, speculative components, per-step commits, and generic checklist filler.
- Record base `HEAD`. Recheck relevant evidence before execution if repository state changed.
- Use one review gate. Ask only questions that repository, ticket, docs, or tools cannot answer.

## Delegation

- Trivial task: no subagent. Typical investigation: one read-only scout. Use at most two scouts only for independent evidence streams.
- Give each subagent one bounded question, scope, constraints, and required evidence format. Prefer fresh context plus a compact evidence brief.
- Use one writer in one worktree. Writer owns code and regression tests. Never run competing writers on the same files.
- Use one fresh reviewer after a meaningful diff. Main agent verifies diff and command results before claiming completion.
- Avoid nested delegation and raw output chains. Compress transport, not requirements, evidence, reasoning, code, tests, or safety details.

## Change and Verification

- Read every file before editing it. Keep changes scoped; no unrelated cleanup.
- Follow existing architecture and test style. Generic style preferences never justify repo-wide rewrites.
- For fixes, add or identify a failing regression check before changing behavior when practical.
- Run focused checks first, then repository-required wider checks. Report exact commands, results, and anything not run.
- Commit, push, merge request, ticket/document update, chat reply, production action, or destructive command requires explicit user authorization.

## Tools and Data

- File search: use `rg` or `rg --files`. Never run `find`, including in subagents or scripts you generate.
- Library/framework/API facts: use Context7 in order: `resolve-library-id` -> choose exact/versioned match -> `query-docs`. If unavailable, use current primary docs and state fallback.
- Agent and skill prompts must be generic. No organization names, internal URLs, project keys, people, teams, or private identifiers. Use placeholders or environment variables.
- Never print secrets or secret-bearing environment values.

## Communication

- Caveman ultra for chat: terse, no filler. Keep technical terms exact. Do not invent abbreviations or use symbolic arrows as prose.
- Use full, unambiguous language for plans, delegation briefs, evidence, requirements, external documents, security warnings, and irreversible steps.
- Code, commits, and review comments use normal professional style.
