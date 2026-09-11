Push the KB branch, open the MR, and insert the human guide at the top of Confluence. Prefer MCP.

Input: `{{workflow.input}}`
Approved plan: `{{reviewed.artifact}}`
Ledger: `{{last.summary}}`

Read `~/.pi/agent/workflows/steps/sprint-triage/sprint-triage.yaml`.

1. Push without force. Create the MR via GitLab MCP using the approved title and verified host template only. If none is verified, do not block or ask for confirmation: create it without description adjustment, read back its description as the template, then update only the managed region.
2. Verify `confluence.appendMode` is `top`. Use the Atlassian MCP tool `atlassian_getConfluencePage` with the configured `cloudId`, configured `pageId`, `contentType: "page"`, and `contentFormat: "html"` to fetch the current page. Block if its version or hash drifted from the approved `Execution contract`.
3. Before constructing an HTML update, call `atlassian_getContentFormatGuide` with `{ "toolName": "updateConfluencePage" }` and follow its returned guidance. If it references a follow-up document, fetch that one document with the same tool using its `reference` value.
4. Extract the approved HTML from the fenced html block in `## Publication fragment`. Form the new body by placing that raw fragment immediately before the fetched HTML body. Use `atlassian_updateConfluencePage` with the configured `cloudId`, configured `pageId`, `contentType: "page"`, the fetched page title, the combined body, and `contentFormat: "html"`. Do not send Markdown, Markdown code fences, or an HTML-escaped fragment. Preserve all pre-existing body content and confirm the returned page reflects the top insertion.

`ready`: MR and top-inserted Confluence guide confirmed.
`handoff`: transient API failure.
`blocked`: hash mismatch or mutation failure.

When the KB publication ledger is absent or incomplete, return `gaps` with exact missing fields so the workflow re-enters implementation.
