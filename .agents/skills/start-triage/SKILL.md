---
name: start-triage
description: Triage a production bug or cross-team request from chat, ticket, logs, metrics, and code. Use for evidence-backed impact assessment, diagnosis, ownership, and a draft response.
---

# Start Triage

Stay read-only unless the user explicitly authorizes an external or production mutation.

## 1. Establish Incident Frame

- Source and exact timestamps/time zone.
- Reported symptom, expected behavior, affected surface, and impact.
- Relevant identifiers, errors, links, deployments, and work already attempted.
- Facts stated by reporters versus their theories.

Preserve unknown mention IDs and identifiers verbatim in working evidence; never infer people, teams, or ownership from opaque IDs.

## 2. Choose Evidence

Query only sources needed to answer the question:

- Chat or ticket for timeline and requirements.
- Logs or metrics for runtime behavior within a narrow time window.
- Code and tests for execution path and expected behavior.
- Version history for recent relevant changes.
- Current primary docs for dependency behavior.

Use at most one bounded investigator per heavy evidence stream and avoid nested delegation. Start with small result limits, then narrow. Do not print secrets or broad environment data.

## 3. Test Hypotheses

For each plausible cause, record:

- Supporting evidence.
- Contradicting or missing evidence.
- Confidence.
- Cheapest falsifying check.

Claim root cause only when evidence connects trigger, faulty behavior, and observed impact. Otherwise state most likely cause and required confirmation.

## 4. Report

```markdown
## Summary and Impact
## Timeline
## Facts
## Hypotheses
## Unknowns
## Conclusion
## Recommended Next Actions
## Draft Reply
## Sources Checked
```

Separate mitigation from permanent fix. Name an owner only when source evidence establishes one. Draft replies but never send them. Ticket/document updates, database mutations, mitigations, and production actions require explicit authorization.
