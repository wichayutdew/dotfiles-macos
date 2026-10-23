# Stage: implement

Use the invoking request and complete source evidence, inline or through the evidence references defined in SKILL.md.

---

Implement the approved plan in the bound worktree.

Request: `the invoking request`
Approved plan: `the approved plan artifact from this run`
Feedback: `approval feedback from this run`
Ledger: `{{last.summary}}`

Edit only in `repositories[0].cwd` (the primary worktree). `role: reference` repos under `workspace.root` are read-only; search them with `rg`. Run approved local worker commands; the field names describe the artifact, not a required runtime. Apply the task’s approved testing approach: TDD where a failing behavioral test has an assessable benefit, and relevant validation for mechanical documentation/configuration edits. Do not force blanket TDD or import a generic serial implementation workflow; honor explicit user/repository requirements. Do not add tests to justify extra code. Leave pre-existing dirty files alone. Do not push, open reviews, or mutate tracker records. Reuse established clients/helpers/query paths and keep additions minimal. Honor local-only/no-commit requests; disposable live-smoke helpers and credentials must never be staged. Remove disposable artifacts after use and verify status without disturbing existing edits.

## Schedule and integrate approved tasks

At entry or continuation, reconcile the actual worktree, approved task table, original request, previous handoff and running workers. Record task states (pending, running, completed, failed), dependencies, owned paths, worker identities, checks and exact remaining work. A handoff or worker claim is context, not proof of a commit, test result or completion. Resume existing workers before dispatching replacements; do not duplicate live or completed work.

The parent dispatches ready independent tasks concurrently, normally 2–3 implementers within available capacity. Ready means all dependencies are completed and verified, interface prerequisites are stable, and owned paths and required resources do not conflict with running work. Start a newly ready task when a slot opens; do not wait for an unrelated task’s review before scheduling it. When tools/capacity are unavailable or no tasks are independent, execute inline or sequentially and record the reason.

Give each worker the original request, bounded task, approved plan and approval evidence, workspace/repository bindings, exclusive writable paths, stable interface references, testing approach and expected evidence. Workers edit only their assigned files in `repositories[0].cwd`, preserve other workers’ edits, run nonconflicting checks, and return changed paths, actual check results, concerns and unfinished work. Workers do not spawn replacements, stage, commit, reset, stash, switch branches or perform other Git/index mutations while peers run. They request ownership changes through the parent rather than editing another task’s files.

The parent owns shared files and Git/index mutations. Serialize tasks that change the same files or interface; complete and verify a shared contract before its consumers start. If ownership or interface assumptions change, pause affected dispatches, reconcile running workers and repartition or serialize within approved scope; use `refresh` when approval assumptions no longer hold. Preserve unrelated task progress and all pre-existing edits.

Coordinate tests that share build outputs, services, databases, generated files or other mutable resources: serialize those checks or use isolation already authorized by the plan. Parallel edits do not make conflicting check runs safe. Review completed task diffs/evidence against their ownership and acceptance criteria while other independent tasks continue. Route failures back to the responsible task; retain valid evidence from unaffected tasks.

Continue scheduling and reconciling until every approved task is complete. A feature’s completion does not require a stage handoff. Before returning `ready`, wait for and reconcile all running workers, inspect the combined diff, perform required integration/shared-contract checks on the combined tree, and record which worker checks remain valid. Commit only when the approved contract authorizes it and no peer can race the operation. Then advance to independent verification.

`ready`: every approved implementation task is complete, all running workers are reconciled, and meaningful task/combined-check evidence is recorded, with authorized commits or explicit uncommitted status; use exactly `No active-step work remains.` in `remaining`.
`handoff`: implementation genuinely remains unfinished because checks/workers are still running or the runtime needs continuation. Record live worker/session identities, owned paths, task states and exact remaining work so the parent resumes without duplicate dispatch. Do not return it solely because one feature is complete.
`refresh`: required scope, commands or assumptions changed; revise the plan through its gate.
`blocked`: a required prerequisite or safe authorized path is unavailable; report the factual blocker without exceeding scope.


## Required ready response
Put task states, reconciled workers, authorized commit SHA/subject or uncommitted status, changed paths, meaningful task and combined verification commands/results, and exact remaining approved work in `Completed`.

# Completed
<complete implementation ledger>

# Remaining
<exact remaining work, or None.>
