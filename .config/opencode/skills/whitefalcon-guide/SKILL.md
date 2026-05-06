---
name: whitefalcon-guide
description: Query WhiteFalcon metrics API to discover metrics, tags, and retrieve time-series data for investigation and analysis to facilitate with on call and triage issues.
license: MIT
compatibility: opencode
---


# WhiteFalcon API Guide

Query time-series metrics from WhiteFalcon for troubleshooting, analysis, and monitoring.

**Base URL:** `<your-whitefalcon-base-url>` — check with your platform team or Consul config.

## Instructions

Use `curl` to query WhiteFalcon API directly. All endpoints require:

- `Content-Type: application/json`
- `x-ssot-name: <your-ssot-name>` — check with your platform team
- ISO 8601 UTC timestamps (e.g., `2026-01-13T10:00:00+00:00`)

### 1. Discover Metrics

Find metrics matching a pattern.

**Endpoint:** `POST /v2/rest/discovery/metrics`

**Parameters:**
- `query`: Pattern with `*` wildcard (e.g., `*latency*`, `*cpu*`)
- `from`, `to`: ISO 8601 UTC timestamps
- `limit`: Max results (default: 100)

### 2. Discover Tags

Find available tags (dimensions) for a metric.

**Endpoint:** `POST /v2/rest/discovery/tags`

**Parameters:**
- `query`: Pattern (use `*` for all tags)
- `from`, `to`: ISO 8601 UTC timestamps
- `metric`: Metric name
- `limit`: Max results

### 3. Discover Tag Values

Find available values for a specific tag.

**Endpoint:** `POST /v2/rest/discovery/tagvalues`

**Parameters:**
- `query`: Pattern (use `*` for all values)
- `from`, `to`: ISO 8601 UTC timestamps
- `metric`: Metric name
- `tag`: Tag name to query values for
- `limit`: Max results

### 4. Query Metric Data

Retrieve time-series data for a metric.

**Endpoint:** `POST /v2/rest/measurements/get`

**Parameters:**
- `metric`: Metric name
- `granularity`: Time bucket size in seconds (e.g., 60, 300)
- `start`, `end`: ISO 8601 UTC timestamps
- `tags`: Filter by tag key-value pairs (e.g., `{"dc": ["HK"]}`)
- `groupby`: List of tags to group results (e.g., `["dc", "method"]`)
- `percentile`: (Optional) List of percentiles (e.g., `["0.99", "0.95"]`) **Only works if metric has percentile definitions configured**
- `exclude_tags`: (Optional) Tags to exclude

**Response structure:**
```json
{
  "datasets": [
    {
      "group": {"method": "POST"},
      "datapoints": [
        {
          "time": "2026-01-13T10:00:00Z",
          "sum": 1250.5,
          "count": 100
        }
      ]
    }
  ]
}
```

**Calculate average:** `average = sum / count`

## Percentile Handling

**CRITICAL:** Most metrics do NOT have percentile definitions configured.

- If you add `"percentile": ["0.99"]` and get error: `"Percentile definition is missing for metric..."`, **remove the percentile parameter entirely**
- Query without percentile to get raw `sum` and `count` data
- Calculate averages: `average = sum / count`
- Grafana's `percentile()` function calculates percentiles client-side from raw data, which is why Grafana queries work even when API percentile calls fail

**Example query without percentile:**

```bash
WF_BASE="<your-whitefalcon-base-url>"
WF_SSOT="<your-ssot-name>"

curl -X POST "$WF_BASE/v2/rest/measurements/get" \
  -H "Content-Type: application/json" \
  -H "x-ssot-name: $WF_SSOT" \
  -d '{
    "metric": "my-service.external.dependency.latency",
    "granularity": 60,
    "start": "2026-01-13T10:00:00+00:00",
    "end": "2026-01-13T11:00:00+00:00",
    "tags": {"dc": ["HK"]},
    "groupby": ["method"],
    "exclude_tags": {}
  }'
```

## Dynamic Timestamps

**Example using date command for last hour:**

```bash
WF_BASE="<your-whitefalcon-base-url>"
WF_SSOT="<your-ssot-name>"
START=$(date -u -v-1H +"%Y-%m-%dT%H:%M:%S+00:00")
END=$(date -u +"%Y-%m-%dT%H:%M:%S+00:00")

curl -X POST "$WF_BASE/v2/rest/measurements/get" \
  -H "Content-Type: application/json" \
  -H "x-ssot-name: $WF_SSOT" \
  -d "{
    \"metric\": \"api.latency\",
    \"granularity\": 60,
    \"start\": \"$START\",
    \"end\": \"$END\",
    \"tags\": {},
    \"groupby\": []
  }"
```

## Examples

Set these variables first:
```bash
WF_BASE="<your-whitefalcon-base-url>"
WF_SSOT="<your-ssot-name>"
```

**User:** "Find metrics related to workflow agents"

```bash
curl -X POST "$WF_BASE/v2/rest/discovery/metrics" \
  -H "Content-Type: application/json" \
  -H "x-ssot-name: $WF_SSOT" \
  -d '{"query": "*workflow*agents*", "from": "2026-01-13T10:00:00+00:00", "to": "2026-01-13T11:00:00+00:00", "limit": 50}'
```

**User:** "What datacenters are reporting for api.booking.latency?"

```bash
curl -X POST "$WF_BASE/v2/rest/discovery/tagvalues" \
  -H "Content-Type: application/json" \
  -H "x-ssot-name: $WF_SSOT" \
  -d '{"query": "*", "from": "2026-01-13T10:00:00+00:00", "to": "2026-01-13T11:00:00+00:00", "metric": "api.booking.latency", "tag": "dc", "limit": 100}'
```

**User:** "Show me latency breakdown by datacenter for the last hour"

```bash
START=$(date -u -v-1H +"%Y-%m-%dT%H:%M:%S+00:00")
END=$(date -u +"%Y-%m-%dT%H:%M:%S+00:00")

curl -X POST "$WF_BASE/v2/rest/measurements/get" \
  -H "Content-Type: application/json" \
  -H "x-ssot-name: $WF_SSOT" \
  -d "{\"metric\": \"api.booking.latency\", \"granularity\": 300, \"start\": \"$START\", \"end\": \"$END\", \"tags\": {}, \"groupby\": [\"dc\"]}" \
  | jq '.datasets[] | {dc: .group.dc, avg: ([.datapoints[].sum]|add)/([.datapoints[].count]|add)}'
```

## Tips

- Start with discovery endpoints to explore available metrics/tags
- Use `*` wildcard liberally in search patterns
- Query without groupby first to see overall health
- Add groupby tags to drill down into specific dimensions
- Start with larger granularity (300s) for overview, then narrow to 60s for details
- If percentile fails, remove the parameter and calculate averages from sum/count
- Use `jq` to process JSON responses for cleaner output
