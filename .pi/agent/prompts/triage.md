---
description: Triage a cross-team bug or request and draft a response
argument-hint: "<thread-url-or-description>"
---
Load `start-triage`, then triage $@ read-only.

- Establish source, timestamps, impact, affected behavior, identifiers, and work already attempted.
- Query only necessary ticket, chat, logs, metrics, code, and history. Use one fresh scout for local code when isolation helps; avoid nested agents.
- Separate facts, hypotheses, unknowns, and next falsifying checks. Do not force a root-cause conclusion.
- Produce concise timeline, impact assessment, evidence-backed conclusion, recommended owner/action, and a draft reply.
- Never send the reply, update a ticket/document, execute mitigation, or run mutating database queries unless explicitly requested.
