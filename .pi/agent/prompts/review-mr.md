---
description: W3 - Review an MR diff and post batched comments (explore -> code-reviewer)
argument-hint: "<MR-URL-or-ID>"
---
Use the subagent tool to run this workflow for: $@

1. `explore` — fetch the MR diff and linked Jira ticket from GitLab.
2. `code-reviewer` — review for security, performance, and coding standards using the context from step 1 ({previous} placeholder). Batch all comments and post to the GitLab MR in one shot.

Run as a chain via the subagent tool.
