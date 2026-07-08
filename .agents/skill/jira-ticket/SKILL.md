---
name: jira-ticket
description: Create or update Jira tickets, stories, and tasks. Trigger when the user asks to create a ticket, write a story, refine a Jira issue, update ticket content, or prepare a ticket for development (e.g. "create a ticket for X", "refine PROJ-1234", "write up a story for Y", "update the description of PROJ-5678").
license: MIT
compatibility: opencode
---


# Jira Ticket

Create and update Jira stories and tasks.

## Critical: Description Format

**Always use Markdown.** The Atlassian MCP tool auto-converts Markdown → ADF internally.

Do NOT use:
- Jira wiki markup (`h3.`, `{{code}}`, `*bold*`) - renders as raw text, not formatted
- ADF JSON objects as the description value - causes "Failed to convert markdown to adf" error

## MCP Tool Reference

| Action | Tool | Required fields |
|--------|------|-----------------|
| Read ticket | `atlassian_getJiraIssue` | `cloudId`, `issueIdOrKey` |
| Create ticket | `atlassian_createJiraIssue` | `cloudId`, `projectKey`, `issueTypeName`, `summary`, `description` |
| Update ticket | `atlassian_editJiraIssue` | `cloudId`, `issueIdOrKey`, `fields.description` |

To get `cloudId`: call `atlassian_getAccessibleAtlassianResources`. Confirm project key from context — do not assume.

## Title Format

`[TYPE][COMPONENT] Brief description`

**Types:**
| Tag | Use for |
|-----|---------|
| `[FEAT]` | New functionality |
| `[FIX]` | Bug fix |
| `[REFACTOR]` | Code restructure without behaviour change |
| `[CHORE]` | Maintenance, dependencies, CI/CD |
| `[DOCS]` | Documentation only |
| `[INVESTIGATE]` | Spike or investigation with no predetermined output |

**Components:** adapt to your project's layer names (e.g. `[UI]`, `[API]`, `[INFRA]`, `[DB]`).

**Examples:**
- `[FIX][UI] Category suggestion items show wrong icon in text search`
- `[FEAT][UI] Navigate to scoped search on category suggestion click`
- `[FEAT][API] Return category and subcategory documents from suggestions`
- `[INVESTIGATE][UI] Why category filter resets on back navigation`
- `[REFACTOR][UI] Centralise URL building for text search`

## Standard Description Template

```markdown
## Context

[Why does this work need to happen? 2-3 sentences. A new team member should understand the motivation.]

## What Needs to Happen

[Concrete list of changes. For bugs: broken/expected/repro. For features: user experience. For investigations: question to answer.]

-

## Acceptance Criteria

[Each criterion must be independently testable. Given/When/Then format. At least one happy path + one edge case.]

- [ ]
- [ ]
- [ ] (edge case)

## Technical Notes (optional)

[Implementation hints, affected services, dependencies, migration notes.]

## Out of Scope

[What this ticket explicitly does NOT cover. Prevents scope creep.]

## Links

[Supplementary only. The ticket must be understandable without these.]

- Design:
- Related tickets:
- Discussion:
```

## Instructions

### 1. Read the ticket (if updating)

Call `atlassian_getJiraIssue` to read current content before making changes.
Request these fields explicitly: `["summary", "description", "issuetype", "parent", "components", "status"]`.

### 2. Ground the ticket in the codebase

Use Glob/Grep/Read to find affected files. Reference exact file paths in "What Needs to Happen" — this makes the ticket immediately actionable without the developer needing to hunt.

### 3. Write the description

Fill the template sections. Replace the `[bracketed guidance]` with actual content — do NOT include the brackets or guidance text in the final description.

- **Context**: Predecessor ticket + user/business motivation. 2-3 sentences max.
- **What Needs to Happen**: Numbered concrete changes with exact file paths and function/component names.
- **Acceptance Criteria**: Given/When/Then format. At least one happy path + one edge case.
- **Technical Notes**: Feature flags, affected services, dependencies with status.
- **Out of Scope**: Explicitly name what this ticket does NOT cover to prevent scope creep.
- **Links**: Related tickets, designs, discussions.

### 4. Review before pushing

Before calling `atlassian_createJiraIssue` or `atlassian_editJiraIssue`, verify:
- All required fields present (summary, description, project key, issue type)
- Top-level sections use `##` (h2) — not `###` (h3)
- Acceptance criteria are testable (not vague like "the feature works")

Surface any issues to the user and stop — do not push until resolved.

### 5. Push to Jira

Pass the description as a plain Markdown string to `atlassian_editJiraIssue` or `atlassian_createJiraIssue`.

## Anti-Patterns

- **Wiki markup**: `h3.`, `{{code}}`, `*bold*` store as raw text — always use Markdown
- **ADF JSON**: Never pass a JSON object as the description field
- **Vague ACs**: "The feature works correctly" is not testable — name the URL, param, or component state
- **Missing file paths**: "Update the search component" is incomplete — name the exact file
- **Skipping Out of Scope**: Without it, tickets grow during review — always define the boundary
- **Using ### for top-level sections**: Top-level description sections must use `##` (h2)
- **Pushing without review**: Always verify required fields and heading structure before calling create/edit

## Examples

**Refine an existing ticket**: "Refine PROJ-6422"
1. Call `atlassian_getJiraIssue` for PROJ-6422
2. Explore relevant source files to find exact file paths
3. Rewrite description using the template
4. Call `atlassian_editJiraIssue` with the Markdown string

**Create a new ticket**: "Create a ticket for fixing the search icon bug"
1. Explore the codebase to identify the affected component
2. Draft summary as `[FIX][UI] Category suggestion items show wrong icon in text search`
3. Draft description using the template
4. Call `atlassian_createJiraIssue` with the correct project key and issue type
