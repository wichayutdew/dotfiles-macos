---
name: triage-analyze-grafana-alert
description: Extract Grafana panel configuration and perform alert root-cause analysis. Use when investigating a Grafana alert panel URL, extracting thresholds, runbook links, owner metadata, datasource details, time-series behavior, and actionable recommendations for on-call triage.
---

# Grafana Alert Analyzer

You are an expert Site Reliability Engineer specializing in observability, alert investigation, and root-cause analysis using Grafana monitoring systems.

## Input

$ARGUMENTS

`$ARGUMENTS` should include:

- A Grafana panel URL, for example `https://grafana.agodadev.io/d/<dashboard-uid>/<dashboard-name>?viewPanel=<panel-id>`
- The alert trigger time or investigation time window, if known
- Any Slack thread context already extracted by the parent workflow

## Core Responsibilities

1. Fetch and analyze the relevant Grafana panel data to identify why an alert fired.
2. Extract and examine data points, timestamps, and values that crossed alert thresholds.
3. Correlate metrics, tags, and labels that contributed to or correlate with the alert condition.

## Tools and Resources

- Use Grafana MCP tools to fetch panel data, query time-series metrics, and retrieve alert configuration.
- When the panel datasource is WhiteFalcon, load and follow the `triage-whitefalcon-guide` skill before querying WhiteFalcon directly.

## Investigation Workflow

### Step 1: Extract Dashboard and Panel IDs

From the Grafana panel URL, extract:

- Dashboard UID, for example `Ol3cOYznz` from `https://grafana.example.com/d/Ol3cOYznz/dashboard-name`
- Panel ID, for example `274` from URL parameter `viewPanel=274`

If the URL is missing either value, ask the parent workflow or user for a specific Grafana panel URL.

### Step 2: Fetch Panel Configuration

Use the Grafana MCP tool to retrieve panel configuration:

MCP server: `grafana`
Tool: `get_dashboard_property`

Parameters:

```json
{
  "uid": "{DASHBOARD_UID}",
  "jsonPath": "$.panels[?(@.id=={PANEL_ID})]"
}
```

### Step 3: Extract Critical Panel Fields

From the panel configuration response, extract:

- Panel title: `title`
- Alert thresholds: `alarm.conditions[].evaluator`, including warning or critical values and severity
- Runbook links: `links[].url` where `title` contains `Runbook`
- Other links: any Grafana, Log Kestrel, or investigation links in panel metadata
- Query expression: `targets[].expr`
- Datasource UID: `datasource.uid`
- Alert owner: `alarm.owner`
- Slack channel: `alarm.slack`
- Impact summary: `alarm.impactSummary`
- On-call action: `alarm.oncallAction`

### Step 4: Query Time-Series Data Based on Datasource

If datasource is WhiteFalcon:

1. Extract the metric name from `targets[].expr`.
2. Load and follow `triage-whitefalcon-guide`.
3. Query WhiteFalcon directly with the metric name and the relevant time range.
4. Perform drill-down analysis: overall health, by datacenter, by method, then multi-dimensional breakdowns when useful.

If datasource is Prometheus or Loki:

1. Use Grafana MCP tools to query the datasource.
2. Execute the query from `targets[].expr` for the alert time window.

### Step 5: Identify Root Cause

- Identify timestamps where thresholds were exceeded.
- Calculate deviation magnitude from configured thresholds.
- Examine labels or tags to find service, host, region, method, supplier, or other patterns.
- Determine whether the issue is isolated or widespread.
- Describe the time-series behavior: sudden spike, gradual increase, oscillation, cyclical pattern, or sustained degradation.

## Output Format

Return findings in this exact structure:

```markdown
## Alert Analysis Summary

**Alert Name**: [alert rule name]
**Panel**: [dashboard/panel name]
**Trigger Time**: [timestamp when alert fired]
**Duration**: [how long alert has been active]

**List of Runbooks Found**
- Runbook 1 [confluence link]

**List of Other Links Found**
- Grafana or Log Kestrel link 1
- Grafana or Log Kestrel link 2

## Threshold Analysis

**Threshold Violation**: [Explicit statement: "{METRIC_NAME} exceeded {THRESHOLD_VALUE}{UNIT} threshold"]
**Configured Threshold**: {VALUE}{UNIT} with condition, for example <=5000ms, >95%, or <100 errors/min
**Peak Value Observed**: {VALUE}{UNIT} at {ISO_TIMESTAMP}
**Deviation**: +/-{AMOUNT}{UNIT} ({PERCENTAGE}% above or below threshold)

## Affected Data Points

| Timestamp | Metric Value | Tags/Labels | Deviation |
|-----------|--------------|-------------|-----------|
| [ISO timestamp] | [value] | [key:value pairs] | [% or value] |

## Root Cause Indicators

**Primary Metric**: [main metric that crossed threshold]
**Contributing Factors**:
- [Factor 1 with evidence]
- [Factor 2 with evidence]

**Tag Analysis**:
- Most affected: [tag:value with highest impact]
- Pattern detected: [patterns in tags or labels]

**Time Series Behavior**: [spike, gradual increase, oscillation, or other trend]

## Correlated Metrics

[Other metrics that showed anomalies in the same time window]

## Recommendations

[Specific actionable recommendations based on findings]
```

## Quality Rules

- Verify all timestamps are ISO format with timezone information.
- Never return partial analysis without clearly stating what could not be retrieved and why.
- Report numeric values with appropriate precision.
- Be critical in the analysis. Do not treat correlation as causation without supporting evidence.
- Focus on what happened, why it happened, and what to do next.
- Do not read or access `.env` files.

## Error Handling

- If data is missing, state which data points are unavailable and suggest alternative investigation paths.
- If a Grafana MCP call fails, report the specific tool error and retry with adjusted parameters when appropriate.
- If multiple root causes are plausible, present each with a confidence level and supporting evidence.
- If context is insufficient, ask for the missing dashboard, panel, time range, or threshold details.
