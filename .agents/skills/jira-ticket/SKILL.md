---
name: jira-ticket
description: Read, draft, refine, create, or update Jira issues. Use for ticket fields, acceptance criteria, scope, or explicit Jira mutations; implementation requests should read the issue without editing it.
---

# Jira Ticket

## Boundaries

- Read ticket before refining or implementing it.
- Creating or updating Jira requires an explicit user request. An implementation request authorizes code changes, not ticket edits.
- Discover accessible workspace, project, issue type, and field requirements through the connector. Never guess IDs or keys.
- Treat links and discussion as supporting context; keep ticket understandable without them.

## Grounding

Capture exact source fields:

- Summary and problem context.
- Current versus expected behavior for bugs.
- Acceptance criteria and non-goals.
- Dependencies, rollout constraints, designs, and linked issues.
- Status and unresolved decisions.

Inspect repository evidence only when it materially improves scope. Distinguish verified file/symbol references from proposed locations.

## Draft Shape

```markdown
## Context

Why this work matters and current behavior.

## Scope

- Concrete behavior changes.

## Acceptance Criteria

- [ ] Independently testable outcome.
- [ ] Relevant edge or failure case.

## Out of Scope

- Explicit boundary.

## Technical Notes

Verified constraints, dependencies, and repository evidence only.
```

Follow existing project title and field conventions. Do not impose invented tags, estimates, components, owners, or rollout strategy.

## Quality Gate

- Every acceptance criterion describes observable behavior.
- Scope and non-goals do not conflict.
- Facts match ticket, code, or supplied source; assumptions are labeled.
- No secret, private identifier, or internal detail is added unless required by the target ticket and supplied by the user.
- Connector payload uses its documented format; do not invent markup or raw document JSON.

Show concise draft before mutation when requirements changed materially or required fields remain uncertain. After write, report issue ID and exact fields changed.
