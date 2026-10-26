---
name: triage-start-on-call
description: Execute on-call runbook procedures for Activities alerts - fetch alert details, read runbook, investigate logs, query databases, and complete triage.
---

# Start On-Call Triage

Automated on-call workflow for Activities production alerts. Reads alert from Slack, fetches Grafana panel details, executes runbook procedures, investigates logs, and provides root cause analysis.

**⚠️ ORCHESTRATION REQUIRED**: You will coordinate multiple specialized agents. Do NOT delegate the entire workflow to one agent

**CRITICAL**:

 - Create an initial todo list covering the major investigation stages.
 - Exact todo label text is not important. Clear, action-oriented titles matter more than literal `[Step #]` formatting.
 - Wait for subagents to finish before abruptly stopping them or starting fresh ones. Each subagent executes a critical, context-heavy investigation step.
 - Step 2 and 3 should be executed in parallel using separate subagents.
 - For steps other than Step 2 and 3, execute all actions under each step in a dedicated subagent.
 - The main thread should coordinate the workflow, summarize progress, and decide next actions; context-heavy investigation work belongs in subagents.
 - After each step or Tool call, present some summary to user.
 - Use time parameters mindfully.

## Step 1: Parse Slack Thread

Use subagent to perform the actions mentioned in this step.

### Extract channel ID and timestamp from $ARGUMENTS

**Slack URL Format:** `https://agoda.slack.com/archives/{CHANNEL_ID}/p{TIMESTAMP}`

Example: `https://agoda.slack.com/archives/C04SM1C4BNH/p1768045822766569`

- Channel ID: `C04SM1C4BNH`
- Timestamp: `1768045822766569` → `1768045822.766569` (insert decimal before last 6 digits)

### Call Slack mcp to fetch thread information

```
MCP: slack
Tool: slack_get_thread_replies
{
  "channelId": "C04SM1C4BNH",
  "threadTs": "1768309844.972789"
}
```

### Parse information

- **Alert Name**: Panel title from alert message
- **Primary Panel URL**: First Grafana dashboard link (format: `https://grafana.agodadev.io/d/{UID}/...?viewPanel={PANEL_ID}`)
- **Additional Grafana Links**: Extract ALL Grafana URLs found anywhere in thread messages (engineers often share investigation links):
  - Links matching `https://grafana.agodadev.io/goto/*` (Explore queries)
  - Links matching `https://grafana.agodadev.io/d/*` (Additional dashboards)
  - Links matching `https://grafana.agodadev.io/explore*` (Direct explore URLs)
- **Timeline**: When alert triggered, when resolved
- **Initial Assessment**: What the on-call engineer reported
- **Escalation Details**: Who was contacted, result.

## Step 2: Get Grafana Panel Configuration

Spawn a subagent with this spec to extract panel configuration and analyze the alert:

`Agent(skill="triage-analyze-grafana-alert", args=<grafana-alert-handoff>)`

Pass a compact `<grafana-alert-handoff>` containing:
- **Primary Panel URL** from Step 1
- **Alert trigger time** from Slack thread

The main thread must not load or execute `triage-analyze-grafana-alert` directly. The spawned subagent will extract panel configuration including thresholds, runbook links, datasource details, alert owner, and impact summary.

## Step 3: Analyze Past events

Spawn a subagent with this spec to fetch historical occurrences of this alert and summarize how it was handled in the past:

`Agent(skill="triage-analyze-slack-alert-history", args=<slack-history-handoff>)`

Pass a compact `<slack-history-handoff>` containing channel ID, panel title, alert name, and the original Slack link. The main thread must not load or execute `triage-analyze-slack-alert-history` directly.

## Step 4: Create TODOs from Runbook found from Step 2

- Read the runbook from Step 2.
- **CRITICAL**: Create Todo items using TodoWrite tool and execute them before reaching next steps.
- Convert each concrete runbook action into its own todo item.
- Todo titles should clearly describe the runbook action. Exact `[RUNBOOK Action #n]` label text is not required.
- Each todo originating from step 4 should execute in a dedicated sub agent to preserve context.
- If Runbook mentions any SQL query, execute them using superset mcp.

## Step 5: Read Log Kestrel Links found from Step 2

- Read the other Grafana/Log Kestrel links found from Step 2. To investigate each link, use TodoWrite tool and create new todos.
- Each todo originating from step 5 should execute in sub agent to preserve context.

## Step 6: Generate On-Call Report

Using the template at `${SKILL_ROOT}/templates/on-call-report.md`, generate a comprehensive triage report and present to user.

**Populate the template with:**

From Step 1 (Slack Thread):
- Alert information (name, triggered time, resolved time, duration)
- Initial assessment (reporter, diagnosis, action taken)
- Slack thread URL and additional investigation links

From Step 2 (Grafana Alert Analyzer):
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

Generate slack message as if you are the on-call and who is going to reply the slack link shared
**CRITICAL**: Your job is to only generate message and not actually send it.
 - Message should be short.
 - It should highlight the issue.
 - It should highlight the next actions.
