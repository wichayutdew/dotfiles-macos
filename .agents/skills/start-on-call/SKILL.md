---
name: start-on-call
description: Execute on-call runbook procedures for production alerts - fetch alert details, read runbook, investigate logs, query databases, and complete triage.
license: MIT
compatibility: opencode
---


# Start On-Call Triage

Automated on-call workflow for production alerts. Reads alert from Slack, fetches Grafana panel details, executes runbook procedures, investigates logs, and provides root cause analysis.

**⚠️ ORCHESTRATION REQUIRED**: Coordinate multiple steps. Do NOT delegate the entire workflow to one agent.

**CRITICAL**:

 - Create initial todo list with Step titles, put [Step #] in the todo as well.
 - Wait for subagents to finish before starting fresh ones. Each subagent executes critical steps.
 - Step 2 and 3 should be executed in parallel.
 - For other steps, execute all actions under each step in a subagent.
 - After each step or tool call, present a summary to user.
 - Use time parameters mindfully.

## Step 1: Parse Slack Thread

Use subagent to perform the actions in this step.

### Extract channel ID and timestamp from $ARGUMENTS

**Slack URL Format:** `https://<your-workspace>.slack.com/archives/{CHANNEL_ID}/p{TIMESTAMP}`

Example: `https://example.slack.com/archives/C04SM1C4BNH/p1768045822766569`

- Channel ID: `C04SM1C4BNH`
- Timestamp: `1768045822766569` → `1768045822.766569` (insert decimal before last 6 digits)

### Fetch thread via Slack MCP

```
Tool: slack_slack_get_thread_replies
{
  "channelId": "<CHANNEL_ID>",
  "threadTs": "<THREAD_TS>"
}
```

### Parse information

- **Alert Name**: Panel title from alert message
- **Primary Panel URL**: First Grafana dashboard link — format: `https://<grafana-host>/d/{UID}/...?viewPanel={PANEL_ID}`
- **Additional Grafana Links**: Extract ALL Grafana URLs found anywhere in thread (engineers often share investigation links):
  - Explore queries: `https://<grafana-host>/goto/*`
  - Additional dashboards: `https://<grafana-host>/d/*`
  - Direct explore: `https://<grafana-host>/explore*`
- **Timeline**: When alert triggered, when resolved
- **Initial Assessment**: What the on-call engineer reported
- **Escalation Details**: Who was contacted, result

## Step 2: Get Grafana Panel Configuration

Extract UID and panelId from the primary panel URL parsed in Step 1.

Use Grafana MCP tools to fetch panel configuration:

```
Tool: grafana_get_dashboard_by_uid
{ "uid": "<DASHBOARD_UID>" }
```

Then extract the specific panel by panelId. Look for:
- Panel title and description
- Alert thresholds / configured limits
- Runbook URL (often in panel description or annotations)
- Alert owner, severity, on-call Slack channel
- Datasource type (Loki / Prometheus / WhiteFalcon)

```
Tool: grafana_get_dashboard_panel_queries
{ "uid": "<DASHBOARD_UID>" }
```

Use `grafana_get_annotations` to find alert annotations near the trigger time.

## Step 3: Analyze Past Events

Search the alerts Slack channel for the panel title to find past occurrences:

```
Tool: slack_slack_search_messages
{ "query": "<ALERT_NAME> in:<alerts-channel>" }
```

Summarize: how often this alert fires, common resolutions, last occurrence.

## Step 4: Create TODOs from Runbook found in Step 2

- Read the runbook URL found in Step 2.
- **CRITICAL**: Create Todo items using TodoWrite tool and execute them before reaching next steps.
- Each step in runbook should be a todo; each todo from this step should have `[RUNBOOK Action #n]` in the title.
- Each todo originating from step 4 should execute in a subagent to preserve context.
- If runbook mentions any SQL query, execute them using superset MCP.

## Step 5: Read Log / Explore Links found in Step 2

- Read the other Grafana/Log links found in Step 2. To investigate each link, use TodoWrite and create new todos.
- Each todo originating from step 5 should execute in a subagent to preserve context.

## Step 6: Generate On-Call Report

Using the template at `${SKILL_ROOT}/templates/on-call-report.md`, generate a comprehensive triage report and present to user.

**Populate the template with:**

From Step 1 (Slack Thread):
- Alert information (name, triggered time, resolved time, duration)
- Initial assessment (reporter, diagnosis, action taken)
- Slack thread URL and additional investigation links

From Step 2 (Grafana Panel):
- **Threshold Analysis** (violation statement, configured threshold, peak value, deviation)
- Alert owner, severity, Slack channel
- Runbook URL and on-call actions
- Dashboard and panel URLs

From Step 3 (Historical Analysis):
- Reference past occurrences and common resolution patterns

**Additional sections to complete:**
- Log Analysis Results (if runbook included log investigation)
- Database Query Results (if runbook included database queries)
- Root Cause Assessment (comparison of reported vs actual)
- Action Items Assessment (what was checked/completed)
- Recommendations (immediate, follow-up, prevention)

Ensure the Threshold Analysis section clearly states which metric crossed which threshold with exact values and deviation percentages.

## Step 7: Generate Slack Message

Generate a Slack message as if you are the on-call engineer replying to the original thread.
**CRITICAL**: Only generate the message — do NOT send it.
 - Message should be short.
 - Highlight the issue.
 - Highlight the next actions.
