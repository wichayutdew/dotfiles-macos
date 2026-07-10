---
description: Investigate a bug with falsifiable hypotheses; fix only when asked
agent: build
---

Load only `systematic-debugging`. Investigate $ARGUMENTS read-only unless a fix was explicitly requested. Capture exact symptom, reproduction status, environment, time range, and recent relevant changes. Use one bounded `investigator`. Keep competing hypotheses with supporting and contradicting evidence plus cheapest falsifier. Claim root cause only when causal chain is demonstrated. If a fix was requested, add a failing regression test, make smallest change, run checks, then use `code-reviewer`.
