---
name: grafana-logs
description: Investigate production issues by querying Grafana Loki logs. Use for error analysis, log pattern investigation, and production debugging.
license: MIT
compatibility: opencode
---


# Grafana Logs Investigation

## WARNING: Always Use Subagent

**ALL log investigation must be done under a subagent** (Task tool). The Grafana MCP is extremely token-heavy and will consume context rapidly. The subagent isolates token usage from the main conversation.

## Instructions

### 1. Launch Investigation Subagent

Before any MCP calls, spawn a subagent:

```
Use Task tool with:
- subagent_type: general
- prompt: "Investigate [issue description] in [applicationName] logs using Grafana Loki MCP"
```

### 2. Discover Loki Datasource UID

Inside the subagent, list Loki datasources to find the UID — do not hardcode:

```
Tool: grafana_list_datasources
{ "type": "loki" }
```

Pick the datasource UID with type `loki` or `LK` from the results.

### 3. Query Logs with LogQL

**Key Query Patterns:**

Most applications use `applicationName` as the primary label for filtering:

```
# Basic application logs
{applicationName="my-service"}

# Filter by label
{applicationName="my-service", env="prod"}

# Search for patterns (case-insensitive)
{applicationName="my-service"} |~ "(?i)error|exception|failed"

# Multiple pattern matches
{applicationName="my-service"} |~ "(?i)payment.*400|payment.*failed"

# Exclude patterns
{applicationName="my-service"} |!~ "(?i)healthcheck"
```

**MCP Call:**

```
Tool: grafana_query_loki_logs
{
  "datasourceUid": "<UID-from-step-2>",
  "logql": "{applicationName=\"my-service\"} |~ \"(?i)error|exception\"",
  "limit": 30,
  "startRfc3339": "2026-01-11T00:00:00Z",
  "endRfc3339": "2026-01-11T01:00:00Z"
}
```

### 4. Time Range Specification

Use RFC3339 format:

```
2026-01-11T00:00:00Z        # Start of hour
2026-01-11T14:30:00Z        # Specific time
2026-01-11T23:59:59Z        # End of day
```

## Workflow Summary

1. **Launch subagent** with Task tool (MANDATORY)
2. Inside subagent: **List datasources** via `grafana_list_datasources` to find Loki UID
3. Inside subagent: **Query logs** via `grafana_query_loki_logs` with appropriate LogQL filters
4. Inside subagent: **Analyze results** and identify patterns
5. Return findings to main conversation

## Common Use Cases

### Error Investigation
```
Tool: grafana_query_loki_logs
{
  "datasourceUid": "<loki-uid>",
  "logql": "{applicationName=\"myapp\"} |~ \"(?i)error|exception\"",
  "limit": 50,
  "startRfc3339": "2026-01-11T00:00:00Z"
}
```

### Specific Service Debugging
```
Tool: grafana_query_loki_logs
{
  "datasourceUid": "<loki-uid>",
  "logql": "{applicationName=\"my-service\"} |~ \"SearchService.*failed\"",
  "limit": 100
}
```

### API Error Tracking
```
Tool: grafana_query_loki_logs
{
  "datasourceUid": "<loki-uid>",
  "logql": "{applicationName=\"api-gateway\"} |~ \"status.*[45][0-9]{2}\"",
  "limit": 30,
  "startRfc3339": "2026-01-11T12:00:00Z",
  "endRfc3339": "2026-01-11T13:00:00Z"
}
```

## Tips

- **Start broad, then narrow**: Begin with `{applicationName="app"}`, then add filters
- **Case-insensitive regex**: Use `(?i)` prefix for pattern matching
- **Combine patterns**: Use `|` for OR: `error|exception|failed`
- **Time windows**: Specify `startRfc3339` and `endRfc3339` for specific time ranges
- **Limit results**: Start with low `limit` (30–50) to avoid token explosion
- **Iterate**: Refine LogQL queries based on initial results
- **NEVER run investigation in main conversation** — always use subagent to contain token usage
