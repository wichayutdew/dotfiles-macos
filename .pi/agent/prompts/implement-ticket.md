---
description: W1 - Implement a Jira ticket end-to-end via subagent chain (explore -> developer -> test -> quality-check -> mr-creator)
argument-hint: "<ticket-id-or-description>"
---
Use the subagent tool to run this workflow for: $@

1. `explore` — fetch Jira ticket details ($@) and gather local codebase + Sourcegraph context. Clarify scope if ambiguous before continuing.
2. `developer` — implement the change (check whether an experiment flag wrap is needed).
3. PAUSE — show the diff and ask the user to review before continuing.
4. `test-automation-engineer` — write unit tests; add integration tests if this introduces a new feature.
5. `quality-checker` — lint + tests must be green before proceeding.
6. `mr-creator` — commit, push, create the MR.
7. If review feedback comes back on the MR, `explore` fetches it, then `developer` applies changes and resolves any merge conflicts (rebase master, keep all changes).

Run steps 1-2 as a chain via the subagent tool ({previous} placeholder), pause for user review after step 2, then continue steps 4-6 as a chain once approved.
