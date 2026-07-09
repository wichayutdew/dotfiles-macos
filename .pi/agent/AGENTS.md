# Global Pi Instructions

## Subagent-first planning workflow

When request involves Plannotator, plan mode, writing-plans, planner/plannotator output, plan approval, plan execution, or any prompt containing words like `plan`, `planner`, `proceed`, `annotate`, `gate`, `approve`, `execution handoff`, or `start implementation`:

1. **Pre-plan / pre-proceed subagent pass is mandatory**.
   - Run `subagent({ action: "list" })` before any subagent execution when availability may matter.
   - Prefer async subagents unless blocking result is immediately required.
   - Launch at least one read-only subagent before writing, approving, annotating, gating, or proceeding.
   - Default pre-plan fanout:
     - `scout` or `context-builder` for local code/context
     - `researcher` for external docs/current facts when needed
     - `oracle` for direction/risk/tradeoff checks when uncertainty exists
   - Keep this pass read-only unless user explicitly asked for edits at this stage.
   - Synthesize subagent output before writing plan, approving plan, or saying proceed.

2. **Post-plan / post-proceed subagent pass is mandatory**.
   - After plan is created, updated, approved, annotated, or Plannotator proposes proceed, run another subagent workflow before implementation proceeds.
   - This second pass must validate plan quality, missing risks, sequencing, assumptions, and execution readiness.
   - Prefer fresh-context `reviewer`, `planner`, `oracle`, or `context-builder` checks for this pass.
   - Do not move directly from plan to implementation in same breath without this second pass unless user explicitly overrides.

3. **Execution default after plan approval**.
   - If implementation is approved, prefer subagent execution workflow over inline execution.
   - Default execution path: subagent-driven workflow using one writer (`worker`) and one or more fresh-context reviewers/validators.
   - Prefer `worker` + `reviewer` loop or staged chain over single-thread inline work.
   - Keep one writer at a time in active worktree.
   - Parallelize read/research/review work; serialize writes.

4. **Required reporting behavior**.
   - Explicitly state which subagent workflow was used before plan/proceed.
   - Explicitly state which subagent workflow was used after plan/proceed.
   - If subagent workflow is skipped, explain exact reason: user opt-out, trivial request, or capability unavailable.
   - Never silently skip the before/after subagent checks for plan-mode work.

5. **Fallback behavior**.
   - If `pi-subagents` or `subagent` tool is unavailable, say so explicitly instead of pretending the workflow happened.
   - If task is trivial and no real planning/proceed decision exists, keep flow lightweight but still prefer at least one subagent review/check when practical.
   - If user explicitly says no subagents, skip this rule and say that user override caused the skip.

## Plannotator-specific behavior

If Plannotator is active or prompt mentions plan/proceed/annotate/gate:
- Treat `proceed` as blocked until a pre-proceed subagent check happens.
- Treat newly produced, revised, or annotated plan as requiring a post-plan subagent validation step.
- Treat plan approval, gate approval, annotate results, and execution handoff as separate checkpoints that may require subagent review.
- If Plannotator asks whether to proceed, do not answer immediately; run subagent workflow first, then answer.
- If Plannotator already produced a plan, do not start implementing from that plan until post-plan subagent validation has happened.
- If user asks to "just proceed", "go ahead", "implement now", or similar while plan/proceed flow is active, treat that as needing the post-plan subagent pass first unless user explicitly says to skip subagents.
- Do not move straight from plan to implementation without that second subagent pass unless user explicitly overrides.

## General delegation posture

- Prefer `pi-subagents` when available.
- Prefer async orchestration by default.
- Prefer fresh-context read-only subagents for advisory/review stages.
- Prefer small fanout first, then synthesis, then single-writer execution.
- Use chain/parallel workflows for non-trivial work instead of one big inline turn.
- Parallelize read/research/review work; serialize writes.
- Do not let multiple subagents write same active worktree concurrently unless isolated worktrees are explicitly used.
- Report which subagent workflow was used before/after the planning step.
- Report any residual risks found by subagents before proceeding.
