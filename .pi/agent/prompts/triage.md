---
description: W4 - Triage a production issue (debugger investigates, then documentation-writer records findings if new)
argument-hint: "<slack-thread-url-or-description>"
---
Use the subagent tool to run this workflow for: $@

1. `debugger` — investigate via Grafana logs, Slack thread, Sourcegraph, and Confluence context for: $@
2. Reply with findings directly to the Slack thread (via the `mcp` tool, Slack/Atlassian server) — do this yourself, don't delegate the reply.
3. If the finding is new or broadly useful, `documentation-writer` writes a new Confluence doc summarizing it.

Run step 1 via the subagent tool. Step 2 is a direct MCP call. Step 3 is conditional — ask the user first if unsure whether it's worth documenting.
