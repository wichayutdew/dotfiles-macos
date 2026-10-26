# On-Call Triage Report: [Alert Name]

## Alert Information
- **Alert**: [Panel Title]
- **Dashboard**: [Dashboard URL]
- **Triggered**: [Time] UTC
- **Resolved**: [Time] UTC
- **Duration**: [Duration in minutes]
- **Severity**: [Warning/Critical based on threshold]
- **Owner**: [Team]
- **Slack Channel**: [Channel]

## Initial Assessment (from Slack)
- **Reported by**: [Engineer Name]
- **Initial diagnosis**: [What they reported]
- **Action taken**: [What they did]
- **Resolution**: [Self-normalized / Fixed / Escalated]

## Threshold Analysis

**Threshold Violation**: [Explicit statement: "{METRIC_NAME} exceeded {THRESHOLD_VALUE}{UNIT} threshold"]
**Configured Threshold**: {VALUE}{UNIT} with condition (e.g., ≤5000ms, >95%, <100 errors/min)
**Peak Value Observed**: {VALUE}{UNIT} at {ISO_TIMESTAMP}
**Deviation**: +/-{AMOUNT}{UNIT} ({PERCENTAGE}% above/below threshold)

**Example:**
- Threshold Violation: getCancel latency exceeded 5000ms threshold
- Configured Threshold: ≤5000ms (critical severity)
- Peak Value Observed: 7500ms at 2026-01-14T10:23:45Z
- Deviation: +2500ms (+50% above threshold)

## Runbook Executed
- **Runbook URL**: [Confluence Link]
- **Impact Summary**: [From runbook]
- **On-Call Actions**: [List from runbook]

## Log Analysis Results

### Exception Breakdown (from Loki)
| Count | Percentage | Exception Type |
|-------|------------|----------------|
| X     | XX%        | ExceptionType1 |
| Y     | YY%        | ExceptionType2 |

### Timeline
```
HH:MM UTC | X errors (breakdown)
HH:MM UTC | Y errors (breakdown) ← PEAK
HH:MM UTC | Z errors (breakdown)
```

### Components Affected
1. **Primary Component** (XX%)
   - Description of issue
   - Stack trace location

2. **Secondary Component** (YY%)
   - Description of issue

### Database Query Results (from Superset)
*If applicable - include data from runbook SQL queries*

**Query Results:**
- [Key metrics from database queries]
- [Aggregated data points relevant to the incident]
- [Patterns or anomalies found in structured data]

**Correlation with Logs:**
- Database metrics vs Log metrics: [Match/Discrepancy analysis]
- Additional insights from structured data

## Root Cause Assessment

### Comparison: Reported vs Actual
- **Reported**: [What on-call said]
- **Actual**: [What logs show]
- **Match**: ✅ Accurate / ⚠️ Partially Accurate / ❌ Misdiagnosed

### Primary Root Cause
[Clear technical explanation]

**Evidence:**
- Log patterns showing X
- Stack traces indicating Y
- Error rate of Z per minute

**Likely Trigger:**
- Deployment at [time]
- Key rotation issue
- External service degradation
- etc.

### Secondary Issues
[If applicable]

## Action Items Assessment

✅ **Logs Checked**: Log Kestrel analyzed for [time range]
✅ **Asset Failures**: [YES - XX% CDN errors / NO]
✅ **External Team Notification**: [NEEDED - Team X / NOT NEEDED]
✅ **Escalation**: [REQUIRED / NOT REQUIRED - Self-normalized]

## Recommendations

### Immediate Actions
- [x] Completed: [What was done]
- [ ] Pending: [What still needs doing]

### Follow-Up Actions
- [ ] Fix Data Protection key ring persistence (file:line reference)
- [ ] Investigate CDN issues with infrastructure team
- [ ] Add monitoring for [specific metric]
- [ ] Update runbook with accurate diagnostic patterns

### Prevention
- Add alerts for Data Protection key ring failures
- Implement better error categorization in logging
- Document common misdiagnosis patterns

## References
- **Slack Thread**: [Original URL]
- **Grafana Dashboard**: [Primary panel URL]
- **Additional Investigation Links**: [List any goto/explore URLs or additional dashboards from thread]
- **Runbook**: [Confluence URL]
- **Panel Configuration**: [Dashboard UID / Panel ID]
- **Log Query**: [LogQL query used]
- **Database Queries**: [Superset SQL queries executed, if applicable]
