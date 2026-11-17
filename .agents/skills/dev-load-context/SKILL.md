---
name: dev-load-context
description: Load existing local artifacts such as research plans, implementation progress, testing plans, and handovers for a Jira ticket into the current conversation context. Use when a user asks to load, resume, review, or summarize existing ticket context, including prompts like "what's the context for ACT-1234?".
---

# Load Context

Load all existing agent-generated artifacts for a Jira ticket and summarize them into the current conversation context.

## Input

`$ARGUMENTS` is an optional Jira ticket ID, for example `ACT-6964`. If it is not provided, extract the ticket ID from the current git branch name.

## Step 1: Resolve Ticket ID

If a ticket ID was passed in `$ARGUMENTS`, use it.

Otherwise extract it from the current branch:

```bash
git branch --show-current
```

Extract the ticket ID by matching the pattern `ACT-\d+` from the branch name, for example `ACT-6964-some-description` maps to `ACT-6964`.

If no ticket ID can be found, ask the user to provide one.

## Step 2: Locate Artifact Root

Artifacts are stored relative to the repo root's `.sdd/output/` directory. Determine the repo root:

```bash
git rev-parse --show-toplevel
```

The artifact root is `<repo-root>/.sdd/output/`.

## Step 3: Load Artifacts

For each of the following paths, check whether the file exists and read it if found. Skip silently if not found.

| Artifact | Path |
|----------|------|
| Research plan | `<artifact-root>/research/<ticket-id>.md` |
| Implementation progress | `<artifact-root>/implementation_progress/<ticket-id>.md` |
| Testing plan | `<artifact-root>/testing-plan/<ticket-id>.md` |

Also check for a handover file:

- `<artifact-root>/handover/<ticket-id>.md`
- `<artifact-root>/dev-handover.md`, only if the ticket ID appears in its contents

### Catch-All: Additional Ticket Files

After checking the known paths above, run a broader search for any additional files under `<artifact-root>` whose name contains the ticket ID, case-insensitive:

```bash
fd -t f -i ".*<ticket-id>.*" <artifact-root> 2>/dev/null
```

For each result not already loaded in the steps above, read and include it under a section called **Additional Artifacts**. Label each by its relative path from `<artifact-root>`.

## Step 4: Summarize To User

Present a structured summary of what was loaded. For each artifact found, extract and present:

### Research Plan

If found, include:

- Ticket and epic
- Task type
- Brief overview, 2 to 3 sentences
- Implementation phases with their names and status indicators from the progress file
- Key files to modify, from the plan
- Any flagged blockers or dependencies

### Implementation Progress

If found, include:

- Phase table with name and status, using completed, in-progress, or not-started
- Any notes or blockers recorded per phase

### Testing Plan

If found, include:

- Number of test scenarios
- Any scenarios marked as failing or skipped

### Handover

If found, include:

- Key decisions or context from the handover

## Step 5: State What's Missing

List which artifacts were not found, so the user knows what still needs to be created:

- No research plan, suggest running `/dev-research-ticket <ticket-id>`
- No implementation progress, suggest running `/dev-implement-ticket <ticket-id>`
- No testing plan, suggest running `/dev-testing-plan <ticket-id>`

## Step 6: Confirm Ready

End with a one-line status:

```text
Context loaded for <ticket-id>. X of 3 artifacts found. Ready to continue.
```

## Anti-Patterns To Avoid

- Do not re-run research or generate any new artifacts in this skill. Load only.
- Do not fail if some artifacts are missing. Partial context is still useful.
- Do not read files outside `.sdd/output/` for this ticket.
