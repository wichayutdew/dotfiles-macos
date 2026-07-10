---
description: Investigate a feature or system behavior without changing it
argument-hint: "<question-or-feature>"
---
Investigate $@ read-only.

- Snapshot repository state and define one concrete question.
- Use one fresh `scout`; use a second only for an independent repository or documentation stream.
- Verify current behavior, existing patterns, dependencies, recent relevant history, and current primary docs where version-sensitive.
- Return `FACT source`, `HYPOTHESIS confidence + falsifier`, `UNKNOWN next check`, and `CHECKED scope`.
- Compare options only when a real decision exists. Recommend one with evidence and tradeoffs.
- Do not create code, plans, tickets, documents, or messages. End with the smallest useful next step.
