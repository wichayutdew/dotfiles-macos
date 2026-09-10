# Global Agent Rules

Produce minimal-diff, evidence-backed changes that follow local repository conventions.

## Search

Always use `rg` or `rg --files` via Bash.

Never use `grep`. Never use `find`. Never use the `grep` or `find` tools.
Do not fall back to `grep`/`find` because a skill, subagent default, or example says so.

## Grounding

- Capture branch, `HEAD`, and `git status --short` before mutating a repo. Preserve unrelated checkouts.
- Claims: `FACT` with `path:line` or tool output; `HYPOTHESIS` with a falsifier; `UNKNOWN` with the next check.
- For versioned libraries, use Context7 (`resolve-library-id` then `query-docs`).
- Never invent a URL. Validate syntax and that it resolves to the intended resource, or omit it.

## Hosted reviews

- Prefer GitHub/GitLab MCP over `gh`/`glab`. Use CLI only when the matching MCP cannot do the job, and record why.
- New PR/MR bodies must follow the repository or host description template. Fill only template fields. Never invent a free-form description.
- If no repository or host template is verified, create the PR/MR without changing its description. Read back the created description; treat it as the template, then update only the workflow-owned marker region.
- Existing PR/MR: title is immutable. Change only the workflow-owned marker region, or append one if markers are absent. Never replace the whole body.

## Planning and gates

- Always draft plans under `~/.plannotator/plans/`
- Submit the complete Markdown text as the gate `artifact`. Never submit a path.
- Do not edit product code before Plannotator approval. Once a complete plan is approved, execute every in-scope task through verification without requesting further routine approval.

## Implementation

- One writer. Smallest coherent change.
- TDD only when the test has an assessable benefit. Never add a test solely to satisfy TDD.
- Never push, merge, or mutate external services without the current step's authority. Never print secrets.

## Execution discipline

- Before implementation, establish the goal, observable acceptance criteria, and verification method. Ask only for information that cannot be determined from available evidence.
- When an approved plan provides the needed decisions and authority, continue autonomously through all in-scope implementation and verification work. Stop only for a genuine blocker: unavailable required information, an out-of-scope decision, missing authority for an external mutation, missing credentials, or a failure that cannot be resolved from available evidence.
- When unblocked, take the next concrete tool or edit action. Do not emit progress-only promises such as "I will" or "next I will" between actionable steps.
- When context pressure risks reliable execution, preserve the goal, acceptance criteria, verification method, current repository state, and next concrete action through compaction or `/clean-execute <plan.md>`.

## Subagents

- In normal chat, launch subagents when they materially improve independent research, review, or implementation work, subject to the active tool and repository rules.

## Workflow children

- When executing a declarative workflow step, do not launch subagents.
- Use `blocked` only for a genuine blocker: required information or a decision absent from the approved plan, missing authority for an external mutation, missing credentials, or a failure that cannot be resolved from available evidence. Do not use `blocked` for routine implementation, verification, or in-scope decisions after plan approval. Never use `retry`, `handoff`, or a next-step outcome to ask the user a question.
- Use `retry` only for a transient failure that can be retried without new user input.
- Do not open a skill file unless the step YAML lists that skill.
- Format all human-facing output—including summaries, plans, reports, comments, and replies—for scanning: short headings, then one distinct fact, action, or metadata value per bullet or paragraph. Never pack unrelated values into one line or emit a dense prose wall.
- When a schema needs several related fields, use a bullet list with one `field`: `value` per row. Put machine-readable data under `## Machine-readable handoff` in a fenced `json` block. It must be valid JSON with no prose inside it.
- Chat: terse. Plans, contracts, and review replies: clear professional prose.
