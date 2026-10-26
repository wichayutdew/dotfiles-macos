---
name: triage-grafana-logs
description: Investigate production issues by querying Grafana Loki logs. Use for error analysis, log pattern investigation, and production debugging.
---

# Grafana Logs Investigation

## WARNING: Always Use Subagent

**ALL log investigation using this MCP must be done under a subagent** (Task tool with subagent_type=general-purpose). This MCP is extremely token-heavy and will consume context rapidly. The subagent isolates the token usage from the main conversation.

## Instructions

### 1. Launch Investigation Subagent

Before any MCP calls, spawn a subagent:

```
Use Task tool with:
- subagent_type: general-purpose
- prompt: "Investigate [issue description] in [applicationName] logs using Grafana Loki MCP"
```

### 2. Check Tool Schema (MANDATORY)

Inside the subagent, ALWAYS check the schema before calling any MCP tool:

```bash
mcp-cli info grafana/query_loki_logs
```

This reveals available parameters:
- `datasourceUid` (required): The Loki datasource UID
- `logql` (required): LogQL query string
- `limit` (optional): Max number of log lines (default: 100)
- `startRfc3339` (optional): Start time in RFC3339 format
- `endRfc3339` (optional): End time in RFC3339 format

### 3. List Available Loki Datasources

Find the Loki datasource UID:

```bash
mcp-cli call grafana/list_datasources '{"type": "loki"}'
```

Common datasource UIDs:
- `gP4MlSq7k` - Primary Loki datasource
- Look for datasources with type "loki" or "LK"

### 4. Query Logs with LogQL

**Key Query Patterns:**

Most applications use `applicationName` as the primary label for filtering:

```bash
# Basic application logs
{applicationName="activity-search"}

# Filter by whitelabel
{applicationName="activity-search", whitelabelId="6401"}

# Search for patterns (case-insensitive)
{applicationName="activity-search"} |~ "(?i)error|exception|failed"

# Multiple pattern matches
{applicationName="activity-search"} |~ "(?i)loyalty.*400|loyalty.*bad.*request|loyalty.*failed"

# Exclude patterns
{applicationName="activity-search"} |!~ "(?i)healthcheck"
```

**Example MCP Call:**

```bash
mcp-cli call grafana/query_loki_logs '{
  "datasourceUid": "gP4MlSq7k",
  "logql": "{applicationName=\"activity-search\", whitelabelId=\"6401\"} |~ \"(?i)loyalty.*400|loyalty.*bad.*request|loyalty.*failed\"",
  "limit": 30,
  "startRfc3339": "2026-01-11T00:00:00Z"
}'
```

### 5. Time Range Specification

Use RFC3339 format for timestamps:

```
2026-01-11T00:00:00Z        # Start of day
2026-01-11T14:30:00Z        # Specific time
2026-01-11T23:59:59Z        # End of day
```

To get recent logs (last hour):
```bash
# Calculate 1 hour ago programmatically if needed
startRfc3339: "$(date -u -v-1H +%Y-%m-%dT%H:%M:%SZ)"
```

## Workflow Summary

1. **Launch subagent** with Task tool (MANDATORY for all investigations)
2. Inside subagent: **Check schema** with `mcp-cli info grafana/query_loki_logs`
3. Inside subagent: **List datasources** to find Loki UID
4. Inside subagent: **Query logs** with appropriate LogQL filters
5. Inside subagent: **Analyze results** and identify patterns
6. Return findings to main conversation

## Common Use Cases

### Error Investigation
```bash
mcp-cli call grafana/query_loki_logs '{
  "datasourceUid": "gP4MlSq7k",
  "logql": "{applicationName=\"myapp\"} |~ \"(?i)error|exception\"",
  "limit": 50,
  "startRfc3339": "2026-01-11T00:00:00Z"
}'
```

### Specific Service Debugging
```bash
mcp-cli call grafana/query_loki_logs '{
  "datasourceUid": "gP4MlSq7k",
  "logql": "{applicationName=\"activity-search\"} |~ \"SearchService.*failed\"",
  "limit": 100
}'
```

### API Error Tracking
```bash
mcp-cli call grafana/query_loki_logs '{
  "datasourceUid": "gP4MlSq7k",
  "logql": "{applicationName=\"api-gateway\"} |~ \"status.*[45][0-9]{2}\"",
  "limit": 30,
  "startRfc3339": "2026-01-11T12:00:00Z",
  "endRfc3339": "2026-01-11T13:00:00Z"
}'
```

## Examples

**User Request:**
> "Investigate loyalty service 400 errors in activity-search for whitelabel 6401"

**Agent Response:**
1. Launch general-purpose subagent with task: "Investigate loyalty 400 errors in activity-search logs"
2. In subagent:
   - Check schema: `mcp-cli info grafana/query_loki_logs`
   - List datasources: `mcp-cli call grafana/list_datasources '{"type": "loki"}'`
   - Query logs with loyalty error pattern
   - Analyze and summarize findings
3. Return summary to user in main conversation

## Tips

- **Start broad, then narrow**: Begin with `{applicationName="app"}`, then add filters
- **Case-insensitive regex**: Use `(?i)` prefix for pattern matching
- **Combine patterns**: Use `|` for OR: `error|exception|failed`
- **Time windows**: Specify `startRfc3339` and `endRfc3339` for specific time ranges
- **Limit results**: Start with low `limit` (30-50) to avoid token explosion
- **Iterate**: Refine LogQL queries based on initial results

## Important Notes

- The Grafana MCP server is available at: `https://mcp-grafana-prod.privatecloud.sg.agoda.is/mcp`
- Header required: `X-Grafana-Org-Id: 1`
- Most applications use `applicationName` label for filtering
- Most logs use Loki datasource (type: "loki" or "LK")
- **NEVER run investigation in main conversation** - always use subagent to contain token usage
