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
- `--babysit` — after completing all requested steps, hand control back to `dev-mr-babysit`

Multiple flags may be combined (e.g., `--pipeline-failure --resolve-comments`).

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
5. **Apply fix** if user agrees:
   ```bash
   PRE_PHASE_SHA=$(git rev-parse HEAD)
   git add <files>
   git commit -m "fix(<scope>): <description>"
   git push
   ```
6. **Write back** — run the [Write-back procedure](#write-back-procedure) below using `PRE_PHASE_SHA` and the loaded artifacts, with `mr_assist_fix: <description>` as the note.

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

## Step 5: MR Comments

> Only execute if user selected "MR comments" or `--resolve-comments` flag is active

### 5.1 Load artifacts

#### Research plan

Read `.sdd/output/research/<jira-id>.md`:
- Overview
- Current State Analysis
- Desired End State
- What We're NOT Doing
- Implementation Approach
- Success Criteria

#### Implementation plan

Read `.sdd/output/implementation_progress/<jira-id>.md`:
- Phases completed
- Decisions made
- Any blockers noted

#### Code changes

```
mcp__gitlab__get_merge_request_diffs(project_id=<project>, merge_request_iid=<mr-iid>)
```

#### MR comments and discussions

```
mcp__gitlab__get_mr_discussions(project_id=<project>, merge_request_iid=<mr-iid>, only_unresolved_comments=false)
```

### 5.2 Answer reviewer questions

When user shares a reviewer question:

1. **Search artifacts first** - research plan and implementation plan
2. **Check code changes** - trace through the diff
3. **Formulate response** with `file_path:line_number` references
4. **Quote relevant sections** from research/implementation plans

### 5.3 Make changes (when requested)

If user asks to address feedback:

1. **Confirm scope** with `AskUserQuestion`
2. **Capture pre-fix state**: `PRE_PHASE_SHA=$(git rev-parse HEAD)`
3. **Make edits** using `Edit` tool
4. **Commit**:
   ```bash
   git add <files>
   git commit -m "fix(<scope>): <description>"
   ```
5. **Push**:
   ```bash
   git push
   ```
6. **Write back** — run the [Write-back procedure](#write-back-procedure) below using `PRE_PHASE_SHA` and the artifacts loaded in Step 5.1, with `mr_assist_fix: <description>` and `comment_ref: <the specific reviewer comment addressed>` as the note.

### Write-back procedure

Shared by Step 3.4 and Step 5.3. Skip silently for any artifact file that does not exist for this ticket.

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

### 5.4 Reply to MR (optional)

Before posting, show the user the draft reply and confirm:

1. **Draft the reply** in the conversation -- show the exact text that will be posted.
2. **Ask for confirmation** using `AskUserQuestion`:
   - Option A: "Post this reply" -- proceed to post the note
   - Option B: "Edit the reply" -- revise and re-confirm
   - Option C: "Skip" -- do not post

Only after the user selects "Post this reply":

```
mcp__gitlab__create_merge_request_note(project_id=<project>, merge_request_iid=<mr-iid>, body="<response>")
```

## Step 6: Handover to mr-babysit (conditional)

If `--babysit` flag was active, invoke the `dev-mr-babysit` skill with `<mr-iid>` as the argument to resume the babysit loop.

Do this unconditionally — whether the steps above succeeded or failed. mr-babysit will re-gather MR state and decide the next action.
