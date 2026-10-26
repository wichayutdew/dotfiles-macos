---
name: dev-implement-ticket
description: Pick up an implementation plan and start working on it. Use when the user asks to implement, execute a plan, begin code changes, or start a Jira ticket by setting up the branch, installing dependencies, and preparing local implementation work.
---

# Implement

You start the implementation phase based on a implementation document.

## Input

$ARGUMENTS

## Load Skills

- `dev-create-merge-request`

## Steps to follow

### Step 0: Resolve execution mode

- Supported mode flags:
  - `--manual`: require user approval before each phase commit and before merge request creation.
  - `--auto`: commit each completed phase and create or update the merge request automatically after final checks pass.
- Default to `auto` when no mode flag is provided. Use `manual` when `--manual` is provided.
- If conflicting mode flags are provided, stop and confirm the mode with the user.

### Step 1: Read the implementation plan

- Check the path: `.sdd/output/research/[jira-id].md` file.
- If the file doesn't exist, ask user to research first using the `/dev-research-ticket` command.
- If `.sdd/output/implementation_progress/[jira-id].md` exists, read it to understand any prior implementation progress. This file is the resume source of truth: read the phase status table and any `### Phase N notes` blocks.
  - **Resume rule**: treat phases whose `Status` is `complete` as already done. Resume dispatch from the first phase whose `Status` is not `complete` (that includes `Not started`, `partial`, and `blocked`, but excludes `abandoned`, which follows its own ask-first rule below). Even when Phase 0 is marked `complete`, always re-run Phase 0's branch-checkout step (checkout the ticket branch per lines 50-52 of Phase 0) before dispatching any phase, this is idempotent and required for cross-session resume. Do NOT re-run Phase 0's dependency-install step, and do NOT re-dispatch or re-execute already-`complete` implementation phases.
  - If a phase is marked `blocked`, tell the user which phase is resuming and reference the recorded `### Phase N notes` blocker before dispatching it again.
  - If a phase is marked `abandoned`, stop and ask the user whether to retry that phase or stop, before proceeding. If the user chooses to retry, do not blindly re-dispatch the worker: first re-present the same 3-option `plan_drift` resolution (update plan / revert code / abandon again) so the original drift is resolved, since retrying without resolving it will just reproduce the same `plan_drift`.

### Step 2: Create ToDos

- Create tasks using `TaskCreate` for each phase of implementation. When resuming (progress file exists), mark tasks for `complete` phases as done and create active tasks only from the first incomplete phase onward per the Step 1 resume rule.
- Phase 0 is project setup. Perform it inline in the parent session using the procedure below. Ticket context lives in `.sdd/output/research/[jira-id].md` from Step 1.
- For each subsequent phase, send a compact parent-to-worker handoff that includes only: jira id, resolved execution mode, phase name/number, exact repo/worktree path, current implementation goal, the plan excerpt for that phase, the exact list of files the worker is expected to create or modify, required checks, and any existing implementation-state notes the worker must honor.

**CRITICAL**: Use Subagents to execute each Task.

#### Phase 0: Project setup

1. **Ticket arg**: require a ticket id in `$ARGUMENTS` (e.g. `ACT-1234` or `issue-46`). Stop and ask the user if missing.
2. **Clean tree**: run `git status --porcelain`. If non-empty, stop and tell the user to commit or stash.
3. **Base branch**: run `git symbolic-ref refs/remotes/origin/HEAD` and strip the `refs/remotes/origin/` prefix. If that fails, ask the user.
4. **Branch**: checkout the base branch, `git pull`, then:
   - If `git rev-parse --verify --quiet "refs/heads/<ticket-id>"` succeeds: `git checkout <ticket-id>` (existing local branch, skip install).
   - Else: `git checkout -b <ticket-id>` (new branch, run install in next step).
5. **Install deps (new branch only)**: detect lockfile via `Glob` and run the matching command. First match wins, top to bottom:

| File | Project type | Install command |
|------|--------------|-----------------|
| `pnpm-lock.yaml` | pnpm | `pnpm install` |
| `yarn.lock` | Yarn | `yarn install` |
| `package-lock.json` | npm | `npm install` |
| `package.json` (no lockfile above) | npm | `npm install` |
| `build.sbt` | Scala/sbt | `sbt update` |
| `build.gradle` | Gradle | `./gradlew --refresh-dependencies dependencies` |
| `build.gradle.kts` | Gradle (Kotlin DSL) | `./gradlew --refresh-dependencies dependencies` |
| `uv.lock` | Python (uv) | `uv sync` |
| `requirements.txt` | Python | `pip install -r requirements.txt` |
| `pyproject.toml` (no lockfile above) | Python | `pip install -e .` |
| `go.mod` | Go | `go mod download` |

6. **Done**: mark Phase 0 complete in the progress file with the commit field left blank (setup-only, no commit).

### Step 3: How to Execute Each Phase

Apply the following rules to every implementation phase.

- You must spawn a subagent with this spec to execute each phase: `Agent(skill="dev-full-stack-engineer", args=<phase-handoff>)`.
- Pass the compact parent-to-worker handoff from Step 2 as `<phase-handoff>`, including the resolved execution mode.
- The main thread must not load or execute `dev-full-stack-engineer` directly.
- You must find relevant files and methods using the LSP tool first. If LSP is not available, fall back to `Glob` and `Grep`.
- Before dispatching a phase, capture `PRE_PHASE_SHA=$(git rev-parse HEAD)` and include it in the handoff.
- Tell the subagent to implement the phase, update relevant tests, run required phase checks, and leave changes uncommitted for the parent session to inspect and commit.
- After each phase, the parent session must inspect the changes, create a phase commit, and update the phase row in the progress file (status, pre-phase SHA, commit SHA). When the worker reports `done` and the phase is committed, set the phase row's `Status` to `complete`. If the subagent reported anything in `Immediate attention`, append a notes block below the table:
  ```
  ### Phase N notes
  <subagent immediate attention text>
  ```
- Before committing, compare the changed files against the phase scope. If the diff is out of scope, show the delta and ask the user whether to accept, revert, or adjust.
- Use a semantic commit message for each phase commit.
- In `auto` mode, commit after required checks pass and the diff is in scope.
- In `manual` mode, show the phase summary, changed files, check results, proposed commit message, and progress update, then ask before running `git add` or `git commit`.
- If manual approval is not granted, stop on the current phase. Do not advance or mark the phase complete.
- After committing, record the pre-phase SHA and commit SHA in the progress file, then confirm `git diff --name-only $PRE_PHASE_SHA HEAD` matches the phase scope.
- Do not move to the next phase if the tests or checks for the current phase fail.
- If tests or checks fail, tell the user and work with them to resolve the issue before continuing.
- Do not remove or weaken existing test cases just because they are failing.

#### Phase Completion Rules

- Do not move to the next phase unless the worker reports `done` and all required checks for the current phase pass.
- If the worker reports `partial`, set the phase row's `Status` to `partial` in the progress table, and keep the work in the current phase. Do not advance phase state until the remaining work and required checks are complete.

#### Hard Stop Conditions

Treat the following as critical stop conditions for the current phase:

- `blocked`
- `plan_drift`
- failing tests or checks

These conditions require user input regardless of the resolved `auto`/`manual` execution mode. Do not auto-resolve them.

##### `plan_drift`: structured replan

If the worker reports `plan_drift`, stop before the next phase and present the specific plan/code mismatch to the user. State the concrete mismatch (what the plan says vs. what the code shows), and offer these options:

1. **Update the plan to match the code** — edit `.claude/output/research/[jira-id].md` in place so the affected phase's expectations match the actual code, then re-dispatch the current phase against the updated plan.
2. **Revert the code to match the plan** — discard the drifting changes for the current phase (`git restore`/`git checkout --` the affected files, or reset uncommitted work) and re-dispatch the current phase against the original plan.
3. **Abandon the phase** — mark the current phase `abandoned` in the progress table, halt the run, and surface to the user. Do not proceed to later phases automatically, later phases may depend on this one. The run can be resumed later per the Step 1 resume rule.

After the user chooses, record the drift and the chosen resolution in a `### Phase N notes` block below the progress table (same convention as Step 3):

```
### Phase N notes
plan_drift: <one-line description of the mismatch>
resolution: <update-plan | revert-code | abandon> — <what was changed>
```

For options 1 and 2, re-dispatch the current phase; do not restart `/dev-research-ticket`. For option 3, stop after recording.

##### `blocked`: surface and document resume path

If the worker reports `blocked` (often a genuine external blocker, e.g. missing credentials or an unresolved design decision), stop before the next phase and surface the blocking issue to the user. Then:

1. Set the current phase `Status` to `blocked` in the progress table.
2. Record the blocker in a `### Phase N notes` block below the table:
   ```
   ### Phase N notes
   blocked: <what is blocking and what the user must resolve>
   ```
3. Tell the user the resume path: once the blocker is cleared, re-invoke `/dev-implement-ticket [jira-id]` for the same ticket. On re-invoke, Step 1's resume rule reads `implementation_progress/[jira-id].md`, skips `complete` phases, and resumes from this `blocked` phase, no full restart and no re-running `/dev-research-ticket`.

### Step 4: Review the Branch

- Spawn a subagent with this spec to review the branch after implementation phases are complete: `Agent(skill="dev-code-review", args=<review-target>)`.
- Treat `critical` and `high` findings as required fixes before moving forward.
- Route required fixes back through a spawned `dev-full-stack-engineer` subagent and keep them within the approved implementation scope.
- If review findings require plan changes or broader scope, stop and resolve that with the user before continuing.

### Step 5: Run Automated Tests

- Run all relevant automated checks for the branch before creating the merge request.
- This must include the required phase checks plus repo-appropriate automated validation such as `eslint`, unit tests, integration tests, type checks, or build checks when applicable.
- If any automated test or check fails, stop and work with the user to resolve it before moving forward.

### Step 6: Create Merge Request

**Prerequisites:** All phases complete, tests passing, changes committed.

- Invoke `dev-create-merge-request` to create or update the merge request. The merge request must include the `act-sdd` label.
- In `auto` mode, invoke `dev-create-merge-request` immediately.
- In `manual` mode, show the branch, target, final checks, commits, and planned `act-sdd` label, then wait for user approval before invoking `dev-create-merge-request`.
- If manual approval is not granted, stop. The user can run `/dev-create-merge-request` later.
- Return the MR URL when done.


**CRITICAL**: If you find conflicting information between implementation plan and actual code, alert user and stop the implementation phase unless user provides permission. Work with user to clear this conflict before moving forward.

## Anti-Patterns to Avoid

- Moving to next phase when current phase tests are failing
- Removing existing test cases to make tests pass
- Generating MR description manually instead of using project's MR template
- Modifying MR template content outside `<!-- ai-only-start/end -->` markers
- Continuing implementation when plan conflicts with actual code without user confirmation
- Running all phases in a single context instead of using subagents
- Committing from a phase subagent instead of leaving phase changes for the parent session's mode-aware commit gate
- Creating or updating a merge request in `manual` mode before the user approves that action
- Surfacing a `plan_drift` as an unstructured stop message instead of presenting concrete resolution options to the user
- Restarting from Phase 0 or re-running `/dev-research-ticket` when resuming a `blocked` ticket instead of resuming from the first incomplete phase per the Step 1 resume rule
- Skipping to later phases after abandoning a phase, or failing to record a `plan_drift`/`blocked` event in a `### Phase N notes` block
