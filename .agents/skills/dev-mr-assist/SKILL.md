---
name: dev-mr-assist
description: Help MR owners with pipeline failures, merge conflicts, and reviewer feedback using research plan, implementation plan, and code changes.
---

# MR Assist

Help MR owners with pipeline failures, merge conflicts, answering reviewer questions, and addressing feedback.

## Input

$ARGUMENTS

## Step 1: Get MR and Extract JIRA ID

### 1.1 Parse MR input

Parse `$ARGUMENTS` before doing anything else.

**Extract flags** (strip from input before identifier lookup):
- `--pipeline-failure` — skip Step 2 gate, execute Step 3 only
- `--resolve-comments` — skip Step 2 gate, execute Step 5 only
- `--rebase` — skip Step 2 gate, execute Step 4 using rebase path
- `--babysit` — standalone request to continue one bounded foreground job after successful handlers; never recurse from an existing owner
- `--passive` / `--aggressive` — review-comment action mode, independent of target scope; passive is default. Reject conflicting mode flags.

Multiple flags may be combined (e.g., `--pipeline-failure --resolve-comments`).

**Existing babysit owner — applies before flag dispatch and to every handler:**
retain its supplied `babysitOwner` (verified context/expected head, original
startedAt/deadlineAt, iterations/maxIterations), restrictions and repair receipts.
Return tested scoped changes uncommitted to that same owner. Do not independently
commit/push, reset its budget, or recursively invoke babysit. This includes
`--pipeline-failure`, which skips Step 5. If ownership/budget is missing, stop
blocked instead of treating the call as standalone. History-changing conflict
resolution in Step 4 is unavailable within this local repair handoff.

**Extract MR identifier** (the non-flag token in `$ARGUMENTS`):
- If URL (contains `merge_requests/`): `echo "$ARGUMENTS" | grep -oE 'merge_requests/[0-9]+' | grep -oE '[0-9]+'`
- If plain number: use directly
- If branch name (contains `/` or matches `[a-z]+-[0-9]+-` pattern): look up via:
  ```
  mcp__gitlab__get_merge_request(project_id=<project>, source_branch=<branch-name>)
  ```
  Extract the `iid` field from the result. If no result, inform the user no open MR
  was found for that branch and stop.

If no identifier at all (input is empty or flags only): ask the user for the MR URL, IID,
or branch name before proceeding.

Store the resolved MR IID and the active flags for subsequent steps.

```
# Get MR details using resolved IID
mcp__gitlab__get_merge_request(project_id=<project>, merge_request_iid=<mr-iid>)
```

### 1.2 Extract JIRA ID from MR

From MR data, find JIRA ID (pattern `[A-Z]+-\d+`) in:
- MR title
- MR description
- Source branch name

## Step 2: What do you need help with?

If any flags were parsed in Step 1.1 (`--pipeline-failure`, `--resolve-comments`, `--rebase`),
skip this step entirely. Map flags to steps:
- `--pipeline-failure` → execute Step 3
- `--resolve-comments` → execute Step 5
- `--rebase` → execute Step 4 (rebase path)

Multiple flags run their corresponding steps in sequence.

If no flags were present, use `AskUserQuestion` with **multiSelect: true**:

Options:
- **Failed pipeline** - Investigate CI pipeline failures, read job logs, and help fix issues
- **Resolve conflicts** - Identify and help resolve merge conflicts with target branch
- **MR comments** - Answer reviewer questions and/or make code changes based on feedback

Only execute the steps below that correspond to the user's selections or active flags.

## Step 3: Failed Pipeline

> Only execute if user selected "Failed pipeline" or `--pipeline-failure` flag is active

### 3.1 Get pipeline status

```
# List recent pipelines for the MR's source branch
mcp__gitlab__list_pipelines(project_id=<project>, ref=<source-branch>)

# Get the latest pipeline details
mcp__gitlab__get_pipeline(project_id=<project>, pipeline_id=<pipeline-id>)
```

### 3.2 Identify failed jobs

```
mcp__gitlab__list_pipeline_jobs(project_id=<project>, pipeline_id=<pipeline-id>, scope="failed")
```

### 3.3 Read job logs

```
mcp__gitlab__get_pipeline_job_output(project_id=<project>, job_id=<job-id>)
```

### 3.4 Diagnose and fix

1. **Analyze logs** - identify the root cause (compilation error, test failure, lint issue, timeout, etc.)
2. **Check code changes** - correlate failures with the MR diff
3. **Suggest fix** - propose specific code changes or configuration updates
4. **Load artifacts** for write-back: invoke the `dev-load-context` skill with `<jira-id>` to load the research plan and implementation progress artifacts, if present.
5. **Apply and test** only a proven in-scope repair within the caller's existing
   authorization/restrictions. Capture PRE_PHASE_SHA before editing. Inspect all
   changed paths and run focused checks; unavailable proof or failed tests block.
6. **Existing babysit owner:** leave changes **uncommitted** and unpublished.
   Return the repair's changedPaths, passed=true and test evidence, with the
   unchanged babysitOwner and expected head. The one outer loop performs its
   guarded source-project/source-branch commit/push and inspects the new head's
   CI. Do not use the standalone publication path or invoke babysit again.
   The loop has advanced the resolver state's sourceGeneration before this
   failed-CI handoff. Finish/test the repair before the owner's current-source
   comment validation, preserving that supplied ledger. Even at the same remote
   SHA, prior claim/fix/test evidence cannot certify the repaired local source.
   Return to validation before publication; never repair after it and reuse its proof.
7. **Standalone:** without explicit publication authorization, return the local
   tested repair. Authorized publication must verify scoped paths/tests, live
   ownership/head/permissions, fast-forward ancestry and an exact expected remote
   head guard; persist intents and confirmed commit/push receipts. Do not use a
   bare git push or infer the destination from cwd. After observed publication,
   run the [Write-back procedure](#write-back-procedure) with PRE_PHASE_SHA and
   the loaded artifacts, noting `mr_assist_fix: <description>`. For an existing
   owner, return that write-back metadata for the owner to record after its commit.

Use the bundled scripts/finish-pipeline-repair.mjs `finishPipelineRepair` after
native repair/proof, importing it by this skill's own absolute directory:

    finishPipelineRepair({
      repair: { changedPaths, passed, evidence }, babysitOwner,
      publicationAuthorized: false, publish: nativeGuardedStandalonePublisher
    })

The helper always returns local changes/budget for a supplied existing owner,
even if publicationAuthorized=true. Do not omit that owner to reach standalone
publication. A missing/invalid owner in an owner invocation blocks before this
call. Only a standalone explicitly authorized call may omit babysitOwner and
set publicationAuthorized=true; publish must implement the guards above and
return native confirmed evidence. The helper supplies no Git/GitLab adapter.

## Step 4: Resolve Conflicts

> Only execute if user selected "Resolve conflicts" or `--rebase` flag is active

### 4.1 Check for conflicts

Check MR JSON for `has_conflicts: true` and `merge_status` field.

**Worktree safety check — run before any merge or rebase operation:**

```bash
git status --porcelain
```

If output is non-empty (uncommitted changes or untracked files), stop and tell the user:

> Working tree is not clean. Stash or commit your changes before conflict resolution:
> ```bash
> git stash        # to stash and continue later
> git stash pop    # to restore after resolving
> ```
> Re-run mr-assist once the working tree is clean.

Only continue if `git status --porcelain` returns empty output.

```bash
# Fetch latest remote state
git fetch origin
```

### 4.2 List conflicting files

**If `--rebase` flag is active**, use rebase instead of merge probe:

```bash
git rebase origin/<target-branch>
```

To abort if the rebase goes wrong:
```bash
git rebase --abort   # restores branch to pre-rebase state
```

After resolving each conflict file: `git add <file>` then `git rebase --continue`.

**If no `--rebase` flag**, use merge probe:

```bash
# Attempt merge to surface conflicts (without committing)
git merge origin/<target-branch> --no-commit --no-ff
```

To abort the merge probe if needed:
```bash
git merge --abort   # restores branch to pre-probe state
```

If conflicts exist, list them:

```bash
git diff --name-only --diff-filter=U
```

### 4.3 Resolve conflicts

For each conflicting file:
1. **Read the file** to see conflict markers
2. **Understand both sides** - check the MR's intent vs incoming changes
3. **Use research/implementation artifacts** if available to understand intent
4. **Confirm resolution** with user via `AskUserQuestion` before applying
5. **Apply resolution** using `Edit` tool

### 4.4 Complete conflict resolution

**If rebase path (`--rebase` flag):**
```bash
git rebase --continue   # after all conflict files are staged
git push --force-with-lease
```

**If merge-probe path:**
```bash
git add <resolved-files>
git commit -m "fix: resolve merge conflicts with <target-branch>"
git push
```

## Step 5: Review comments

Execute when selected or --resolve-comments is active. Target scope and action
mode are separate: MR-only selects all open threads; a specific discussion/note
selects one thread. Default action mode is passive. --aggressive explicitly
selects proven safe fixes, focused tests and replies within the approved scope.

### 5.1 Load artifacts and scope

Load the existing research/implementation artifacts and code context. Bind exact
MR head, source branch/project, actor, reservation owner and caller restrictions.
Do not turn a read-only or no-post handoff into mutation permission.

### 5.2 Delegate to the resolver

Invoke dev-resolve-review-thread with the MR, selected scope, passive/aggressive
mode and unchanged restrictions. It validates every selected reviewer comment,
including followups, and accounts for verdict/draft/disposition per note.

Passive produces all drafts and STOP: no code patches even in scratch and no
posts without approval. Explicit aggressive selection authorizes proven in-scope
fixes/tests and replies without fresh per-comment confirmation. Unverified proof,
unsafe suggestions, changed head/ownership or unavailable permissions block.
Neither mode toggles discussion resolution, approves, merges or deploys.

### 5.3 Return fixes and receipts to the owner

When invoked by an existing babysit job, return local scoped changes, tests,
per-comment receipts and any blocker to that same foreground owner. Do not
commit/push independently, reset its counters/deadline, or pass --babysit.
The owner performs its dirty-only commit/push/exact-head CI loop.

For a standalone authorized publication, capture PRE_PHASE_SHA before changes,
inspect scoped dirty paths and passing checks, then commit/push only when that
publication is authorized. A clean result requires no commit or push. Use the
write-back procedure for observed commits; record the specific comment references.

### Write-back procedure

Shared by authorized standalone publication from Step 3.4/5.3, or by the existing
owner after its observed commit. Skip silently for any artifact file that does
not exist for this ticket.

`PRE_PHASE_SHA` below refers to the value captured earlier in Step 3.4/5.3 (`PRE_PHASE_SHA=$(git rev-parse HEAD)`); since it was set in a separate command invocation, substitute the actual SHA value captured then rather than assuming the shell variable is still set.

1. **Compute committed file set**: `git diff --name-only $PRE_PHASE_SHA HEAD`.
2. **Match to a phase**: compare the file set against each phase's declared file paths in `.claude/output/research/<jira-id>.md` — the `### Files to Create` table (a `| File | Purpose |` table) and the `### Files to Modify` section (a series of `#### N. \`path/to/file\`` subsections, each with Purpose/Changes/Before/After).
   - All committed files fall under exactly one phase's declared paths → that is the target phase (`Phase N`).
   - Any committed file is absent from every phase's declared paths, or the files span more than one phase → treat as scope drift; do not silently attribute to a single phase.
3. **Normal case** — append below the phase table in `.claude/output/implementation_progress/<jira-id>.md`, and in `.claude/output/research/<jira-id>.md`, after the phase's full `### Success Criteria` block (including its Automated/Manual checklists and `**ACs Completed**` line), and before the phase-closing `---` separator:
   ```
   ### Phase N notes
   mr_assist_fix: <description>
   comment_ref: <reviewer comment reference, only for Step 5.3>
   ```
4. **Scope drift case** — append to both artifacts under the best-guess or most-recently-active phase (ask the user via `AskUserQuestion` if ambiguous which phase to attach it to):
   ```
   ### Phase N notes
   scope_drift: <files touched that are outside this phase's declared scope>
   mr_assist_fix: <description>
   ```
   Tell the user explicitly that the fix expanded scope beyond the phase's documented plan — do not file it as a normal `mr_assist_fix` note.
5. **If either artifact file doesn't exist** for the ticket, skip write-back for that artifact and tell the user — do not fail the fix.

## Step 6: Return to the current owner

If an existing babysit job invoked this skill, return its result directly with
the original state, expected SHA, counters and deadline. Never recursively invoke
dev-mr-babysit, including after failures.

For a standalone --babysit request, start or resume one foreground babysit job
only after the requested work and checks complete successfully and no blocker
remains. Carry source identity, receipts and all caller restrictions. The babysit
workflow selects aggressive explicitly; read-only/draft-only restrictions still
block mutations. Failed or partial handlers report the blocker and stop rather
than unconditionally starting another loop.
