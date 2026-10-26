---
name: dev-epic-sync
description: Sync shared Epic context from Confluence. Loads or bootstraps a context page for a Jira Epic ID (ACT-XXX), caches locally at ~/.sdd/context/, and supports version-aware refresh. Also answers questions about an Epic using its cached context. Use when starting work on an epic, refreshing context mid-sprint, priming a session before /dev-research-ticket or /dev-implement-ticket, or when anyone needs context about an epic.
---

# Epic Sync

Load shared team context for an Epic from Confluence into the local cache.
Multiple contexts can coexist. `/dev-research-ticket` auto-matches the right one from the Jira ticket's Epic ID returned by the spawned `dev-fetch-jira-context` subagent.

Also serves as a **query interface** — append a question after the Epic ID to get answers grounded in the Epic's context page without needing to read the full document yourself.

## Configuration

| Setting | Value |
|---|---|
| Confluence space | `ACV` (space ID: `165445635`) |
| Parent page | [EPIC Context - AI](https://agoda.atlassian.net/wiki/spaces/ACV/pages/2170552544) (page ID: `2170552544`) |
| Page title convention | `<epic-id> — <Feature Name>` (e.g., `ACT-5975 — Airport Transfer Filters`) |
| Local cache path | `~/.sdd/context/<epic-id>.md` |

## Instructions

### 1. Parse Key and Query

Read `$ARGUMENTS` and split into two parts:

- **Epic ID**: The first token matching `ACT-\d+`. Normalize to uppercase.
- **Query** (optional): Everything after the Epic ID, trimmed. If present, this triggers **Query Mode** (Step 5).

If no Epic ID is found, ask:

```
AskUserQuestion: "Enter the Epic ID (e.g., ACT-5975):"
```

**Routing:**
- If a query is present → ensure context is loaded (Steps 2–4 as needed), then go to **Step 5** (Answer Query).
- If no query → proceed with normal sync flow (Steps 2–4).

### 2. Search Confluence

Search for an existing context page:

```
confluence_search_page(text: "<epic-id>", space: "ACV")
```

- Search by Epic ID only — do NOT include the feature name. The Epic ID is the reliable identifier; feature names may have typos.
- If results are found, match on the Epic ID prefix in the title (e.g., title starts with `ACT-5975`).

- **Page found** → go to **Step 3** (Load Existing Context)
- **No page found** → go to **Step 4** (Bootstrap New Context)

### 3. Load Existing Context

Fetch the full page content:

```
confluence_get_page(page_id: "<matched-page-id>")
```

- Save the content to `~/.sdd/context/<epic-id>.md` with a version marker on the first line:
  ```
  <!-- confluence-version: N -->
  ```
  Where N is `version.number` from the Confluence response.

- Create the directory if needed:
  ```bash
  mkdir -p ~/.sdd/context
  ```

- Display a summary to the user:
  - Epic ID, page title, Confluence version
  - Key sections found (Architecture, Key Files, Domain Model, etc.)
  - Stories completed count (if present)
- Confirm:

```
Context loaded: <epic-id> → ~/.sdd/context/<epic-id>.md (Confluence version N)
/dev-research-ticket will automatically use this context for stories belonging to this Epic.
```

Done — stop here.

### 4. Bootstrap New Context

Only reached if no Confluence page exists for this Epic.

#### 4a. Enrich from Jira

Call `mcp__plugin_agoda-skills_at__getJiraIssue`:
- `issueIdOrKey`: the epic ID
- Extract: `summary` (title), `description` (for one-liner)

#### 4b. Ask for description

```
AskUserQuestion: "No context exists for <epic-id> yet. Provide a one-line description of this Epic:"
```

Use the Jira summary as the title if available. Use the user's answer as the one-liner description.

#### 4c. Build and publish the context page

Create a Confluence page under the parent:

```
confluence_create_page(
  space_id: "165445635",
  title: "<epic-id> — <jira-summary or user-provided title>",
  parent_id: "2170552544",
  content: <template below>,
  content_format: "markdown"
)
```

Template content:

```markdown
# <epic-id>: <title>
> <one-liner description>

> Last updated: <today YYYY-MM-DD>

## Architecture & Key Decisions

_Nothing recorded yet._

## Key Files & Entry Points

_Nothing recorded yet._

## Domain Model

_Nothing recorded yet._

## Stories Completed

| Story | Summary | MR |
|-------|---------|-----|

## Open Questions

_None yet._

## Out of Scope

_Nothing explicitly deferred yet._
```

#### 4d. Cache locally

Save the same content to `~/.sdd/context/<epic-id>.md` with the version marker:

```bash
mkdir -p ~/.sdd/context
```

Write `<!-- confluence-version: 1 -->` as the first line, followed by the template content.

#### 4e. Confirm

```
Created context for <epic-id> → published to Confluence and cached locally.
/dev-research-ticket will automatically use this context for stories belonging to this Epic.
```

### 5. Answer Query (Query Mode)

Only reached when `$ARGUMENTS` contains text after the Epic ID.

#### 5a. Ensure context is loaded

Check if `~/.sdd/context/<epic-id>.md` exists:

- **Exists** → Read the cached file.
- **Does not exist** → Run Steps 2–4 silently (sync or bootstrap), then read the resulting cached file.

If the sync/bootstrap happened, mention it briefly (e.g., "Context synced for ACT-5975.") before answering.

#### 5b. Answer the query

Read the full content of `~/.sdd/context/<epic-id>.md` and answer the user's query using **only** the information in that context file.

Rules:
- Ground answers in the context document. Quote or reference specific sections (Architecture, Key Files, Domain Model, Stories Completed, Open Questions, Out of Scope) when relevant.
- If the context document does not contain enough information to answer the query, say so explicitly — do not fabricate or speculate. Suggest the user update the context page with the missing information.
- Keep answers concise and direct. This is meant for quick context sharing — not a research session.
- Do NOT trigger a Confluence re-fetch just to answer a query. Use the cached version. If the user suspects stale data, they should run `/dev-epic-sync <epic-id>` without a query first to refresh.

#### 5c. Example usage

```
/dev-epic-sync ACT-5975 what architecture decisions have been made?
/dev-epic-sync ACT-5975 which stories are completed?
/dev-epic-sync ACT-5975 what's out of scope?
/dev-epic-sync ACT-5975 give me a summary for the standup
/dev-epic-sync ACT-5975 what are the open questions?
```

Done — stop here. Do NOT proceed to the sync confirmation output.

---

## Updating Context After a Session (Reference)

After a research or implementation session, update the Confluence page with new findings:

1. Read the local cache: `~/.sdd/context/<epic-id>.md`
2. Search Confluence for the page: `confluence_search_page(text: "<epic-id>", space: "ACV")`
3. Update the page:

```
confluence_update_page(
  page_id: "<page-id>",
  title: "<existing-title>",
  content: <updated content>,
  content_format: "markdown",
  version_comment: "update context from <ticket-id> session"
)
```

4. Update the local cache version marker to match the new version number.

This is intentionally a manual step — the engineer decides what findings are worth persisting.
