---
name: dev-handover
description: Write a handover document capturing the current conversation context so work can be resumed in a new session.
---

# Handover

Write a handover document that captures the full context of the current conversation so another Claude session can pick up exactly where this one left off. This skill works purely from conversation context - it does not read external artifacts.

## Instructions

### 1. Gather Context from Conversation

Review the full conversation history and collect:

#### What was the goal?
- The original task or request
- Any ticket IDs, MR URLs, or Slack threads mentioned in the conversation

#### What has been done?
- Decisions made and why (including rejected alternatives)
- Files created, modified, or deleted - with brief rationale for each
- Commands run that had significant outcomes (e.g., dependency installs, migrations)
- MRs created or updated (include URLs)

#### What is in progress?
- Current step being worked on
- Anything partially done that needs finishing
- Failing tests or builds that need fixing

#### What is next?
- Concrete next steps in priority order
- Blockers or dependencies that must be resolved first
- Questions that were raised but not yet answered

#### What are we NOT doing?
This section is critical to prevent scope creep in the next session.
- Explicitly list items that were discussed but deliberately deferred
- Out-of-scope items that came up during conversation
- Refactors or improvements that are tempting but not part of this task
- Adjacent features that were mentioned but are separate tickets

### 2. Capture Git State

```bash
git branch --show-current
git log --oneline -5
git status --short
git diff --stat
```

Include this in the handover so the next session knows the exact state of the working tree.

### 3. Ask Where to Save

Use `AskUserQuestion` to confirm the save location:
- Default: `.sdd/output/dev-handover.md`
- User can specify a custom path

### 4. Write the Handover

**Output format**:

```markdown
---
branch: <current-branch>
date: <today>
---

# Handover

## Goal

[What this task is about - 2-3 sentences max]

## What Has Been Done

- [Action taken - with file paths or MR URLs where relevant]
- [Decision made - and why]

## What Is In Progress

- [Current state of work - be specific about where things stand]

## What Is Next

1. [Next step - concrete and actionable]
2. [Following step]

## What We Are NOT Doing

**MANDATORY** - This section must always be present and non-empty. If nothing was explicitly deferred, note that scope was fully contained.

- [Deferred item - why it's out of scope]
- [Adjacent concern - separate ticket or future work]
- [Tempting refactor or improvement that is not part of this task]

## Git State

- **Branch**: `<branch-name>`
- **Recent commits**:
  - `<hash> <message>`
- **Working tree**: clean / has uncommitted changes (list them)
```

### 5. Confirm and Save

- Present the handover document
- Ask if anything is missing or needs correction
- Save to the agreed path
- After saving, display this message:

```
Handover saved to <path>.

You can now run /clear to start a fresh session.
To resume, paste this in the new session:

  Read <path> and continue from "What Is Next"
```

## Examples

**User**: "/dev-handover"

1. Review conversation: user was building a new skill, created 3 files, opened an MR, discussed but deferred adding CI integration
2. Capture git state → on branch `feat/new-skill`, 4 commits, clean tree
3. Ask where to save → user picks default `.sdd/output/dev-handover.md`
4. Write handover noting MR URL, deferred CI work in "NOT doing" section
5. Save and show resumption instructions
