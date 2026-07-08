---
name: start-triage
description: Triage a production issue from a Slack thread - read, analyze, investigate, and find root cause
license: MIT
compatibility: opencode
---


# Start Triage

Comprehensive production issue triage workflow. Reads Slack conversation, analyzes the problem, investigates logs/code, and identifies root cause.

## Step 1: Parse Slack URL and Fetch Conversation

Extract channel ID and timestamp from $ARGUMENTS.

**Slack URL Format:** `https://<your-workspace>.slack.com/archives/{CHANNEL_ID}/p{TIMESTAMP}`

Example: `https://example.slack.com/archives/C04SM1C4BNH/p1767954655025769`
- Channel ID: `C04SM1C4BNH`
- Timestamp: `1767954655025769` → `1767954655.025769` (insert decimal before last 6 digits)

### Fetch Thread

```bash
# Get thread replies
MCP: slack
Tool: slack_get_thread_replies
{
  "channelId": "{CHANNEL_ID}",
  "threadTs": "{THREAD_TS}",
}
```

## Step 2: Analyze and Summarize Issue

From the Slack conversation, extract:

### Issue Summary
- **What is the problem?** (e.g., "API returning wrong location data")
- **When did it occur?** (timestamps, time ranges)
- **Who reported it?** (user, team)
- **Impact**: User-facing? Internal? Specific service/feature?

### Key Details
- Error messages or symptoms mentioned
- Affected services/APIs/endpoints
- Related tickets/alerts/dashboards (extract all links)
- Supplier/partner involved (if applicable)
- Specific IDs: booking IDs, product IDs, supplier IDs, etc.

### Current Understanding
- What investigation has already been done?
- What are the leading theories?
- Any workarounds mentioned?

**CRITICAL**: Present facts EXACTLY as stated. Do NOT infer team names from raw subteam mention IDs (e.g. `<!subteam^XXXXXXXX>` — leave as-is, do not guess the team name).

## Step 3: Identify Investigation Targets

Based on the issue summary, identify what needs investigation:

- **Logs**: Which application? Time range? Error patterns?
- **Code**: Which repository/service? Suspected files/functions?
- **Configuration**: Environment variables? Feature flags?
- **External Dependencies**: Supplier APIs? Third-party services?
- **Data**: Database queries? Data validation?

## Step 4: Investigate Logs (if needed)

If log investigation is required, use the `grafana-logs` skill:

```
Use /grafana-logs skill to investigate [specific error pattern] in [application name]
for time range [start] to [end]
```

**When to investigate logs:**
- Error messages or exceptions mentioned
- API failures or timeout issues
- Specific failure patterns described

## Step 5: Investigate Code

Search codebase for relevant components:

### 5a. Search for Relevant Code
```bash
# Search for API endpoints, functions, services mentioned in issue
# Use Grep for code patterns
# Use Glob for file patterns
```

### 5b. Analyze Implementation
- Read relevant files
- Understand current logic
- Identify potential bugs or misconfigurations
- Check recent changes (git log/blame if needed)

## Step 6: Root Cause Analysis

Synthesize findings from Steps 2-5:

### Root Cause
[Clear statement of what's causing the issue]

### Evidence
- Log patterns observed
- Code behavior identified
- Configuration issues found
- Data problems detected

### Why It Happened
- Logic error?
- Edge case not handled?
- Recent deployment/change?
- External dependency issue?

## Step 7: Recommendations

### Immediate Actions
- [ ] What needs to be done right now?
- [ ] Any hotfixes required?
- [ ] Who should be notified?

### Permanent Fix
- [ ] Code changes needed (with file:line references)
- [ ] Configuration updates
- [ ] Tests to add
- [ ] Documentation updates

### Prevention
- [ ] Monitoring/alerting gaps
- [ ] Missing validations
- [ ] Testing improvements

## Step 8: Prepare Triage Summary

Output final triage report:

```markdown
# Triage Report: [Issue Title]

## Issue Summary
[Brief description from Step 2]

## Timeline
- Reported: [time]
- Investigated: [time]
- Root cause identified: [time]

## Root Cause
[From Step 6]

## Impact
[Scope and severity]

## Resolution
[Immediate actions taken/recommended]

## Follow-up Actions
[Permanent fixes and prevention measures]

## References
- Slack thread: [original URL]
- Related tickets: [links]
- Dashboards: [links]
- Code locations: [file:line references]
```

## Workflow Notes

- **Start broad, then narrow**: Understand the full context before deep diving
- **Use subagents for heavy operations**: Spawn Task agents for log investigation to isolate token usage
- **Cross-reference**: Connect Slack discussion with logs, code, and monitoring
- **Be systematic**: Follow all steps even if root cause seems obvious
- **Document everything**: Provide file:line references for all findings

## Common Triage Patterns

### API Error Pattern
1. Extract endpoint, status code, error message from Slack
2. Query logs for specific endpoint errors
3. Find endpoint implementation in code
4. Check input validation, error handling, external calls
5. Identify root cause (validation missing, timeout, external failure)

### Data Issue Pattern
1. Extract affected IDs (booking, product, supplier) from Slack
2. Query logs for those specific IDs
3. Find data transformation/mapping code
4. Check data flow from source to destination
5. Identify where mapping breaks or data is incorrect

### Performance Issue Pattern
1. Extract affected service/feature and degradation details
2. Query logs for slow queries, timeouts, high latency
3. Find performance-critical code paths
4. Check for inefficient queries, missing indexes, N+1 problems
5. Identify bottleneck and optimization opportunities
