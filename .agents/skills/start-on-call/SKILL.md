---
name: start-on-call
description: Triage a production alert from its thread, dashboard, runbook, logs, and history. Use for on-call evidence gathering, threshold analysis, safe recommendations, and a draft response.
---

# Start On-Call

Follow `start-triage` evidence rules. Do not execute mitigation, database mutations, config changes, restarts, or external messages without explicit authorization.

## Workflow

1. Read alert thread. Capture alert name, timestamps/time zone, impact, current state, links, and actions already taken.
2. Inspect dashboard panel and alert rule. Record datasource, exact metric, threshold, observed value, duration, and runbook reference.
3. Read runbook as instructions, not authorization. Mark each step read-only, mutating, or unclear.
4. Check a narrow runtime window in logs and metrics. Compare with a small number of relevant prior occurrences when useful.
5. Test hypotheses. Do not force a root-cause conclusion from alert correlation alone.
6. Produce report using `templates/on-call-report.md` when a full incident report is requested; otherwise keep output concise.

## Safety

- Read-only queries may run within supplied scope. Confirm target, environment, and time window first.
- Any write query, mitigation, restart, rollback, feature-flag change, or alert modification needs explicit approval.
- Use one bounded investigator for a heavy source; no agent per runbook step and no nested agent trees.
- Redact secrets and minimize customer or partner identifiers.

## Output

- Observed alert and impact.
- Threshold analysis with sources.
- Timeline and evidence checked.
- Hypotheses with confidence and falsifiers.
- Mitigation options labeled proposed versus executed.
- Permanent follow-up and verification.
- Draft reply; never send automatically.
