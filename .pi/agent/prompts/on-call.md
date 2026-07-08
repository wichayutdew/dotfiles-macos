---
description: W5 - On-call warroom mitigation (debugger mitigates only, documentation-writer records lesson-learn)
argument-hint: "<alert-or-runbook-reference>"
---
Use the subagent tool to run this workflow for: $@

1. `debugger` — follow the runbook, investigate via Grafana + Superset, mitigate only (no long-term fix) for: $@. Verify mitigation via Grafana/Superset before reporting done.
2. `documentation-writer` — write a lesson-learn Confluence page in the PTA space using the mitigation report from step 1 ({previous} placeholder).

Run as a chain via the subagent tool.
