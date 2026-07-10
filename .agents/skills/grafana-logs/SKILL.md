---
name: grafana-logs
description: Query Grafana Loki logs for production debugging using narrow, evidence-driven LogQL searches. Use for errors, request traces, runtime patterns, and hypothesis testing.
---

# Grafana Loki Investigation

Run inside the current bounded investigator. Do not spawn another agent solely because this skill loaded.

## Query Discipline

1. Confirm environment, application label, exact time range/time zone, and investigation question.
2. Discover Loki datasource and labels; never hardcode datasource IDs or assume label names.
3. Start with a narrow time window and result limit of 20-30.
4. Search an exact request ID, error string, endpoint, or known label before broad regex.
5. Refine based on observed fields. Expand time or limit only when needed.
6. Preserve timestamps and correlation IDs, but redact secrets and minimize private identifiers.

Generic patterns:

```logql
{<app-label>="<service>"} |= "<exact-text>"
{<app-label>="<service>"} |~ "(?i)<error-pattern>"
{<app-label>="<service>", <env-label>="<environment>"} != "<noise>"
```

Use RFC3339 timestamps with explicit offsets. Never substitute current time from memory.

## Evidence Output

- Query, datasource, environment, time range, and result limit.
- Observed pattern with representative timestamps and counts.
- Negative evidence: expected events not found and searched scope.
- Hypothesis supported or falsified; confidence and next check.
- Query limitations, truncation, missing logs, or clock uncertainty.

Logs show correlation, not automatically causation. Cross-check code path, deployment history, metrics, or request flow before declaring root cause.
