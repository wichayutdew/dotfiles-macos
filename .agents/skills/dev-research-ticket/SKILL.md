---
name: dev-research-ticket
description: Research a Jira ticket and understand required code context before implementation. Use when the user explicitly asks to research, investigate, plan, or understand a ticket and codebase impact. Do not use for branch setup, dependency installation, or starting implementation work.
---

# Research

User will invoke this command to initiate the AI flow to understand what needs to be done for this task.

## Input

$ARGUMENTS

## CRITICAL

- Step 4 is pattern matching only - identify which skill applies.
- Step 5 should happen in a Plan subagent that invokes matched skills via the Skill tool.

## Step 1: Parse input

- Jira ID is provided in $ARGUMENTS

## Step 2: Enrich Jira context

Delegate ALL JIRA fetching through a spawned subagent:
- Spawn a subagent with this spec: `Agent(skill="dev-fetch-jira-context", args=<jira-id>)`
- Pass the JIRA ticket ID from Step 1 as `<jira-id>`
- The main thread must not load or execute `dev-fetch-jira-context` directly
- The spawned subagent must load the skill and return only the structured Jira context markdown with: description, acceptance criteria, parent/epic hierarchy, linked issues, and associated MRs
- Do NOT fetch JIRA data separately - the context fetcher is the single source for all JIRA context

Once the context fetcher returns:
- Summarize the ticket to the user
- Extract the **Epic ID** from the parent/epic hierarchy (if present)
- Extract component field:
  - Component is most likely the repository name
  - In some cases, it can be an abbreviation (e.g., NPC = non-property-content)
- Note any linked issue context relevant for implementation (especially "blocked by" or "depends on")
- Note associated MR links that may contain related code changes or implementation patterns
- **Epic context**: Check the `Epic Context` section in the agent's output. If present, tell the user epic context is loaded for the Epic ID and use it throughout codebase exploration. If it says no context was found, tell the user. If no Epic ID on ticket, skip silently.

## Step 3: Confirm Scope Boundary

Immediately after Jira enrichment and before any code exploration:

- Tell the user what the ticket appears to ask for in 2-3 sentences.
- State the current scope you will use for research and planning.
- Ask the user whether this looks like the final scope, or whether they want to add or remove anything.
- Use `AskUserQuestion` to capture that boundary.
- Do NOT launch subagents, use LSP/Glob/Grep, read source files, or explore the codebase until the user confirms the boundary.
- If the user adds or removes scope, restate the final scope before moving on.
- If new requirements materially change the original Jira scope, tell the user what changed and ask whether the Jira should be updated now.
- If the user says yes, update the Jira directly before implementation proceeds.
- If the user says no, stop before implementation and call out that the current request is no longer aligned with the Jira scope.
- Carry the confirmed boundary forward into exploration, the implementation plan, and the final handoff.

## Step 4: Pre-determined steps for Jiras

| Jira Type | Detection Pattern | Skill to Use | Purpose |
|-----------|------------------|--------------|---------|
| A/B Experiment Integration | Title contains "Integrate ACT-XXXX" or "De-Integrate ACT-XXXX" | `dev-experiment-integration-planner` | Plan integration or de-integration and identify code changes |
| Experiment Setup | Description mentions experiment setup | `dev-add-experiment` | Use as initial step to set up experiment, then continue with story planning |

## Step 5: Codebase exploration

Main thread runs Graphify first. Then spawn as many POV subagents as needed — one per angle. Do not do one broad pass.

If step 4 matched a skill, every research subagent must invoke it via the Skill tool before exploring.

**Graphify (before any subagent).** Seed from confirmed scope + Step 2: repo (Jira component), AC keywords, associated MR diffs, epic context.
1. `search_repositories` — GitLab path or repo name, not a code question
2. `search_nodes` — symbol, file, or node-id from the seed or a prior result
3. `explain_node` / `traverse_graph` on that node id
Reuse `path_with_namespace`. Do not start with `query_graph`. Confirm with source. Name the POVs and hand each subagent its candidate files/symbols.

**POV subagents.** One per relevant angle. Cover every surface the confirmed scope needs: request/entrypoint, UI/journey, data/API/persistence, config/experiment/flags, async/jobs/events, tests.

**Reuse gate (every POV, required).** Before proposing new files or functions, each subagent must return:
- existing logic / component / utility / extension point to reuse, with `file:line`
- or `none found` plus what was searched

New code is allowed only after that list. If an existing extension point can take the change, plan the edit there. Do not add a parallel path.

Each subagent returns `file:line` modification points plus unknowns. One exploration summary. Stay in boundary.

**Cleanup in touched files only:** mocks to replace, conflicting hardcoded values, related TODO/FIXME.

## Step 6: Interview User

- Gather ALL clarifying questions from research before asking any
- Only ask questions that cannot be answered from context
- Use `AskUserQuestion` tool (max 4 questions per call)
- If an answer changes the confirmed scope, restate the updated boundary before continuing.
- If an answer triggers need for more research, do that research in a subagent first, then batch any new questions together
- Wait for all answers before proceeding to Step 7

## Step 7: Verify Understanding

Before writing the plan, present a brief summary to user:
- Problem statement (2-3 sentences)
- Technical approach (1-2 sentences)
- Key files to modify (list)
- Confirmed scope boundary, including any explicitly approved extra scope
- Dependencies or blockers (if any)

Ask user to confirm understanding is correct before proceeding.

## Step 8: Create Plan

**CRITICAL**: Only write plan when all questions answered AND understanding verified.

Ask user where to write the plan using `AskUserQuestion`:
1. Repository root: `<repo-root>/.sdd/output/research/<jira-id>.md`
2. Current directory: `<cwd>/.sdd/output/research/<jira-id>.md`
3. User specified path

Requirements:
- Must be self-contained with all context for another Claude session to implement
- Include code examples where needed for clarity
- Avoid unnecessary prose - focus on actionable details

**Output format**:

```markdown
---
ticket: ACT-XXXX (omit if not present)
epic: ACT-YYYY (omit if not present)
repository: activities (omit if not present)
local-repo-path: ~/projects/activities (list of projects, omit if not present)
task-type: spike/implementation/integration
dependencies: ACT-ZZZZ, ACT-AAAA (tickets this blocks or is blocked by, omit if none)
author: Claude
---

# [Task name] Implementation Plan

## Overview

[Brief description of what we're implementing and why]

## Acceptance Criteria Mapping

| AC # | Criteria | Phase | Verification |
|------|----------|-------|--------------|
| AC1 | [Copy from Jira] | Phase 1 | [How to verify] |
| AC2 | [Copy from Jira] | Phase 2 | [How to verify] |

## Current State Analysis

[What exists now, what's missing, key constraints discovered]

### Key Discoveries
- [Important finding with file:line reference]
- [Pattern to follow]
- [Constraint to work within]

## Desired End State

[A specification of the desired end state after this plan is complete, and how to verify it]

## What We're NOT Doing

[Explicitly list out-of-scope items based on the confirmed boundary to prevent scope creep]

## Implementation Approach

[High-level strategy and reasoning]

---

> **Phase size rule**: each phase must touch at most 5 files (`Files to Create` + `Files to Modify` combined). If a logical unit of work exceeds 5 files, split it into sub-phases `Na`, `Nb`, ... sliced along file-group boundaries (e.g. source vs tests, feature-a vs feature-b) so each sub-phase is independently reviewable and produces exactly one commit.

## Phase 1: [Descriptive Name]

### Overview
[What this phase accomplishes and which ACs it addresses]

### Files to Create

| File | Purpose |
|------|---------|
| `path/to/new-file.ext` | [Why this file is needed] |

### Files to Modify

#### 1. `path/to/existing-file.ext`

**Purpose**: [What this file does currently]
**Changes**: [Summary of modifications]

**Before**:
```[language]
// Existing code that will be changed
```

**After**:
```[language]
// New code after modification
```

### Success Criteria

**Automated**:
- [ ] [Repo-specific build command]
- [ ] [Repo-specific test command]
- [ ] [Repo-specific lint command]

**Manual**:
- [ ] [Specific user action and expected result]
- [ ] [Edge case to verify]

**ACs Completed**: AC1, AC2

---

## Cleanup Checklist

Items in files touched by this implementation that should be cleaned:

- [ ] `path/to/file.ext:line` - [What needs cleanup and why it's related to this change]

> Only include items directly related to this task's requirements or in files being modified.

---

## Testing Strategy

### Unit Tests
- [ ] `path/to/test-file.test.ext` - [What it tests]
- [ ] [Key edge cases to cover]

### Integration Tests
- [ ] [End-to-end scenario]

### Manual Testing Steps
1. [Specific step with expected outcome]
2. [Another step with expected outcome]

## Performance Considerations

[Any performance implications or optimizations needed, or "None expected" if N/A]
```

## Step 9: Generate Handoff Artifacts (Parallel Subagents)

After the research plan is saved, launch two subagents in parallel:

### Testing Plan Subagent

The testing-plan subagent must:
- Invoke the `dev-testing-plan` skill using the Skill tool
- Pass the JIRA ID so the skill can locate the research artifact created in Step 8
- Pass the research artifact path created in Step 8 if the save location was user-selected, so the subagent uses the exact saved plan
- Save the testing plan to `<same-root-as-step-8>/.sdd/output/testing-plan/<jira-id>.md`

### Implementation Progress Subagent

The implementation-progress subagent must:
- Read the saved research plan from Step 8
- Write `<same-root-as-step-8>/.sdd/output/implementation_progress/<jira-id>.md`
- Seed the file so `/dev-implement-ticket` can start immediately in a fresh session
- Include the saved artifact paths plus a phase-by-phase status table initialized from the research plan, using this exact schema:

| Phase | Description | Status | Pre-phase SHA | Commit |
|-------|-------------|--------|---------------|--------|

Seed one row per phase with `Status: Not started`, `Pre-phase SHA: —`, `Commit: —`. Valid `Status` values written by `/dev-implement-ticket` are: `Not started` (seed), `partial`, `complete`, `blocked`, and `abandoned`. The `Pre-phase SHA` and `Commit` columns are filled by `/dev-implement-ticket` at dispatch and completion time. If a subagent reports anything noteworthy during a phase, `/dev-implement-ticket` appends a notes block below the table:

```
### Phase N notes
<subagent immediate attention text>
```
- Capture any confirmed scope notes, decisions, review gates, or blockers the implementer must honor

These two subagents run in parallel to isolate context and prepare the handoff artifacts. Do NOT merge them into one subagent. Do NOT summarize or paraphrase the `dev-testing-plan` skill - the testing-plan subagent must call it directly via `Skill`.

## Step 10: Fresh-Session Handoff

After the research plan, testing plan, and implementation progress artifact all exist:

- Present a short summary of the confirmed scope and recommended implementation direction.
- Tell the user the exact saved paths for:
  - the research plan artifact
  - the testing plan artifact
  - the implementation progress artifact
- Tell the user research is complete and implementation should start in a fresh session with the prepared handoff artifacts.
- Instruct the user to run `/clear` and then `/dev-implement-ticket $ARGUMENTS`.
- Also tell them they can start a new session and run `/dev-implement-ticket $ARGUMENTS`.
- If the research artifact or implementation progress artifact was not saved at the standard `.sdd/output/...` path expected by `/dev-implement-ticket`, tell the user to move or regenerate it there before running `/dev-implement-ticket $ARGUMENTS`.
- End the workflow after this handoff unless the user explicitly asks to continue in the current session.

## Anti-Patterns to Avoid

- Writing plan before all questions are answered
- Starting code exploration before the user confirms the scope boundary
- Continuing with materially new requirements without handling the Jira scope change first
- Skipping the "Verify Understanding" step
- Not launching Plan subagent for Step 5.
- Using one broad exploration pass instead of focused POVs tied to the ticket shape and confirmed scope.
- Not invoking skills that are mentioned in Step 4 in Step 5 subagent, for eg, for integration story, `dev-experiment-integration-planner` didn't get invoked.
- Skipping either Step 9 subagent - both the testing plan and implementation progress artifacts must be generated after the research plan is saved.
- Inlining the testing plan logic instead of invoking the `dev-testing-plan` skill via the Skill tool in the subagent.
- Omitting the final fresh-session handoff with both artifact paths and the `/dev-implement-ticket $ARGUMENTS` instruction.
- Omitting the warning when the research artifact was saved outside the standard `.sdd/output/research/<jira-id>.md` path.
- Loading or executing `dev-fetch-jira-context` in the main thread instead of spawning a subagent with `Agent(skill="dev-fetch-jira-context", args=<jira-id>)`.
- Fetching JIRA data directly instead of using the spawned `dev-fetch-jira-context` subagent - all JIRA context must come from the skill, not from manual MCP tool calls.
- Mentioning "no epic context found" to the user when the ticket has no Epic (bugs, integrations, whitelabels) — this is expected, not an error. Skip silently.
