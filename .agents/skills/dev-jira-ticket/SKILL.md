---
name: dev-jira-ticket
description: Create or update Jira tickets, stories, and tasks in the ACT project. Trigger when the user asks to create a ticket, write a story, refine a Jira issue, update ticket content, or prepare a ticket for development (e.g. "create a ticket for X", "refine ACT-1234", "write up a story for Y", "update the description of ACT-5678").
---

# Jira Ticket (ACT Project)

Create and update Jira stories and tasks for the ACT project.

## Critical: Description Format

**Always use Markdown.** The Atlassian MCP tool auto-converts Markdown → ADF internally.

Do NOT use:
- Jira wiki markup (`h3.`, `{{code}}`, `*bold*`) - renders as raw text, not formatted
- ADF JSON objects as the description value - causes "Failed to convert markdown to adf" error

## MCP Tool Reference

| Action | Tool | Required fields |
|--------|------|-----------------|
| Read ticket | `mcp__plugin_agoda-skills_at__getJiraIssue` | `cloudId`, `issueIdOrKey` |
| Create ticket | `mcp__plugin_agoda-skills_at__createJiraIssue` | `cloudId`, `fields.project.key`, `fields.summary`, `fields.description`, `fields.issuetype.name` |
| Update ticket | `mcp__plugin_agoda-skills_at__editJiraIssue` | `cloudId`, `issueIdOrKey`, `fields.description` |

Always use `cloudId: "agoda.atlassian.net"` and `fields.project.key: "ACT"` for new tickets.

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

**Components:**
| Tag | Use for |
|-----|---------|
| `[UI]` | Frontend (React/TypeScript) |
| `[BFF]` | Backend-for-Frontend (.NET) |
| `[INFRA]` | CI/CD, scripts, deployment |
| `[UI][BFF]` | Both frontend and backend |

**Examples:**
- `[FIX][UI] Category suggestion items show wrong icon in text search`
- `[FEAT][UI] Navigate to scoped search on category suggestion click`
- `[FEAT][BFF] Return category and subcategory documents from NPC suggestions`
- `[INVESTIGATE][UI] Why category filter resets on back navigation`
- `[REFACTOR][UI] Centralise URL building for text search in getTextSearchLocation`

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

Call `mcp__plugin_agoda-skills_at__getJiraIssue` to read current content before making changes.
Request these fields explicitly: `["summary", "description", "issuetype", "parent", "components", "status"]`.

### 2. Ground the ticket in the codebase

Use Glob/Grep/Read to find affected files. Reference exact file paths in "What Needs to Happen" - this makes the ticket immediately actionable without the developer needing to hunt.

### 3. Write the description

Fill the template sections. Replace the `[bracketed guidance]` with actual content - do NOT include the brackets or guidance text in the final description.

- **Context**: Predecessor ticket + user/business motivation. 2-3 sentences max.
- **What Needs to Happen**: Numbered concrete changes with exact file paths and function/component names.
- **Acceptance Criteria**: Given/When/Then format. At least one happy path + one edge case.
- **Technical Notes**: CMS IDs, feature flags, affected services, dependencies with status.
- **Out of Scope**: Explicitly name what this ticket does NOT cover to prevent scope creep.
- **Links**: Related tickets, designs, discussions.

### 4. Lint before push

Before calling `createJiraIssue` or `editJiraIssue`, write the draft fields to a temp file
`/tmp/jira-lint-<ticket>.json` and run:

```bash
python3 ${SKILL_ROOT}/scripts/lint_jira_ticket.py /tmp/jira-lint-<ticket>.json
```

If exit code is non-zero, surface the errors to DJ and **stop** - do not push until all errors are resolved.

### 5. Push to Jira

Pass the description as a plain Markdown string to `editJiraIssue` or `createJiraIssue`.

## Anti-Patterns

- **Wiki markup**: `h3.`, `{{code}}`, `*bold*` store as raw text - always use Markdown
- **ADF JSON**: Never pass a JSON object as the description field
- **Vague ACs**: "The feature works correctly" is not testable - name the URL, param, or component state
- **Missing file paths**: "Update the search component" is incomplete - name the exact file
- **Skipping Out of Scope**: Without it, tickets grow during review - always define the boundary
- **Following the global dev-jira-ticket skill**: It targets a different project (Prowler) and uses wiki markup - ignore it for ACT tickets
- **Hardcoding project key**: Always confirm the project key from context; default is `ACT` but don't assume for tickets outside Activities
- **Using ### for top-level sections**: Top-level description sections must use `##` (h2) - using `###` (h3) is a heading structure violation caught by the lint step
- **Pushing without linting**: Always run `lint_jira_ticket.py` before calling `createJiraIssue` or `editJiraIssue` - skipping this step risks pushing tickets with missing parent, components, or malformed headings

## Examples

**Refine an existing ticket**: "Refine ACT-6422"
1. Call `getJiraIssue` for ACT-6422
2. Explore relevant source files to find exact file paths
3. Rewrite description using the template with title `[FIX][UI] ...` or `[FEAT][UI] ...`
4. Call `editJiraIssue` with the Markdown string

**Create a new ticket**: "Create a ticket for fixing the search icon bug"
1. Explore the codebase to identify the affected component
2. Draft summary as `[FIX][UI] Category suggestion items show wrong icon in text search`
3. Draft description using the template
4. Call `createJiraIssue` with `project.key: "ACT"` and `issuetype.name: "Story"` or `"Task"`
