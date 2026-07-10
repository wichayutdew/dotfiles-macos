---
description: Investigate a bug with falsifiable hypotheses; fix only when asked
argument-hint: "<symptom-or-bug>"
---
Load only the `systematic-debugging` skill, then investigate $@.

- Stay read-only unless the user explicitly asked for a fix.
- Capture exact symptom, environment, time range, reproduction status, and recent relevant changes.
- Trace from failure point backward. Use one fresh `scout` for bounded code/history evidence when useful.
- Keep competing hypotheses; record supporting and contradicting evidence plus the cheapest falsifying check.
- Call something root cause only after demonstrating the causal chain. Otherwise report likelihood and missing proof.
- If a fix was requested, use one writer for failing regression test plus smallest code change, then one fresh reviewer and fresh verification.
- Never expose secrets or print broad environment dumps.
