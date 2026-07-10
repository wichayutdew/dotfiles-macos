---
description: Investigate and implement a Jira ticket as a verified local diff
agent: build
---

Use the native skill tool to load `jira-ticket` only if ticket-field handling is needed.

Implement $ARGUMENTS. Read the ticket and repository evidence; extract testable acceptance criteria and unknowns. Use one bounded read-only scout for non-trivial work. Use Plannotator only for ambiguous, cross-file, or cross-system scope. Keep one writer; add regression tests with behavior; run focused and repository-required checks; use one fresh `code-reviewer` after meaningful changes. Stop at a verified local diff. Do not edit Jira, commit, push, or create a merge request unless explicitly requested.
