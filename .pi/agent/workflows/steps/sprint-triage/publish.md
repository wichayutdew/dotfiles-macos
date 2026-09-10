Push the KB branch, open the MR, and insert the human guide at the top of Confluence. Prefer MCP.

Input: `{{workflow.input}}`
Approved plan: `{{reviewed.artifact}}`
Ledger: `{{last.summary}}`

Read `~/.pi/agent/workflows/steps/sprint-triage/sprint-triage.yaml`.

1. Push without force. Create the MR via GitLab MCP using the approved title and verified host template only. If none is verified, do not block or ask for confirmation: create it without description adjustment, read back its description as the template, then update only the managed region.
2. Re-read the Confluence page as HTML. Block if its version or hash drifted. Verify `confluence.appendMode` is `top`. Extract the approved `Exact top-insert HTML` fragment from the plan artifact, insert it before the fetched page body, and update the page through the Atlassian MCP with `contentFormat: "html"`. Do not send Markdown, Markdown code fences, or an HTML-escaped fragment. Preserve the page title and all pre-existing body content.

`ready`: MR and top-inserted Confluence guide confirmed.
`handoff`: transient API failure.
`blocked`: hash mismatch or mutation failure.
