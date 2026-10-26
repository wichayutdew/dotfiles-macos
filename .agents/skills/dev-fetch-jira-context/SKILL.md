---
name: dev-fetch-jira-context
description: Fetch Jira ticket context using Atlassian MCP tools. Use when an agent needs structured Jira details for research or planning, including ticket fields, description, acceptance criteria, parent or epic hierarchy, linked issues, associated merge requests, and Epic Confluence context.
---

# Jira Context Fetcher

You are a data-fetching skill. Your only job is to call MCP tools and format their responses. You have no prior knowledge about any Jira ticket, and you must not infer or invent ticket data.

## Input

$ARGUMENTS

`$ARGUMENTS` must contain the Jira ticket ID, for example `ACT-5975`.

## Mandatory First Action

Your first action must be a tool call. Do not output summaries, plans, acknowledgments, or ticket content before loading the Atlassian MCP tools.

```
ToolSearch(query: "+agoda-skills_at getJiraIssue")
ToolSearch(query: "+agoda-skills_at getJiraIssueRemoteIssueLinks")
```

If ToolSearch returns no results, return only:

```text
ERROR: Could not load Atlassian MCP tools.
```

Then stop.

## Mandatory Ticket Fetch

Call `mcp__plugin_agoda-skills_at__getJiraIssue` with the provided ticket ID. Include `customfield_10096` in the `fields` array because it contains Acceptance Criteria.

```text
fields: ["summary", "description", "issuetype", "status", "priority", "assignee", "reporter", "components", "labels", "parent", "issuelinks", "customfield_10096"]
```

If the call fails or returns an error, return only the error and stop.

## Procedure

1. Load tools with ToolSearch.
2. Fetch the primary ticket with `getJiraIssue`.
3. Fetch parent and epic hierarchy:
   - If the primary ticket response contains a `parent` field, call `getJiraIssue` for the parent.
   - If that parent has a parent, fetch it too.
   - Stop after 2 parent levels.
   - If an Epic is found, call `confluence_search_page` with `text` set to the Epic ID only, for example `ACT-5975`, and `space` set to `ACV`.
   - If a matching page is found and the title starts with the Epic ID, call `confluence_get_page` and include the page content.
   - If no Confluence page is found, write `No epic context found in Confluence.` in the output.
4. Fetch linked issues from the primary ticket `issuelinks` array using `getJiraIssue`, capped at 5 linked issues.
5. Fetch merge requests with `getJiraIssueRemoteIssueLinks` for the primary ticket.
6. Format the API responses into the output below.

## Output Format

```markdown
## JIRA Context: {TICKET-ID}

### Primary Ticket
- **Summary**: {from API response}
- **Type**: {from API response}
- **Status**: {from API response}
- **Priority**: {from API response}
- **Assignee**: {from API response}
- **Reporter**: {from API response}
- **Components**: {from API response}
- **Labels**: {from API response}

### Description
{parsed from API response ADF content}

### Acceptance Criteria
{combine content from `customfield_10096` and any "Acceptance Criteria" section found in the description field. Deduplicate if both contain the same content. Write "Not specified" only if neither source has any content.}

### Parent / Epic Hierarchy
- **Parent**: {key} - {summary} ({status})
- **Epic**: {key} - {summary} ({status})

### Linked Issues
| Key | Type | Summary | Status | Relationship |
|-----|------|---------|--------|--------------|
| {from API} | {from API} | {from API} | {from API} | {from API} |

### Associated Merge Requests
- {from API response}

### Epic Context
- **Epic ID**: {epic-id}

{Include the full Confluence page content here.}
{If no Confluence page was found, write: "No epic context found in Confluence."}
{If no Epic ID was found in the hierarchy, omit this entire section.}
```

## Rules

- Parse Atlassian Document Format content into readable plain text or markdown.
- If a field is empty in the API response, write `None`.
- If a non-primary fetch fails, write `Failed to fetch: {error}` inline and continue.
- Cap linked issues at 5.
- Cap parent hierarchy at 2 levels.
- Do not fetch Jira data directly from memory, cached notes, code comments, or assumptions.

## Anti-Patterns to Avoid

- Generating any text before the first tool call.
- Outputting ticket data without a preceding tool call that returned that data.
- Filling the template with plausible content when tools failed.
- Inventing parent, epic, linked issues, acceptance criteria, or merge requests.
- Claiming API calls were made when tool use history shows no calls.
