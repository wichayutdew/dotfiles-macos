# Stage: publish

## Pi profile

- Role: `scout`
- Model: `gateway/gemini-3.8-flash`
- Thinking: `low`

The Pi adapter supplies the invoking request and previous stage artifact automatically. In a portable session, use the active conversation request and prior artifacts.

---

Push the KB branch and open the review MR. Prefer MCP.

Input: `the invoking request`
Approved plan: `the approved plan artifact from this run`
Ledger: `{{last.summary}}`

Use `sprint-triage.yaml` in this skill directory. If it is absent, ask the user to create it from `sprint-triage.example.yaml`, replace every placeholder locally, and keep the concrete file uncommitted.

1. Validate the implementation completed ledger against the configured knowledge-base repository. The current linked worktree, topic branch, base SHA, and commit SHA must equal the recorded values, and the commit must contain the approved paths. Block on a mismatch.
2. Push without force the recorded topic branch. Create the MR via GitLab MCP against configured `gitlab.targetBranch`, using the approved title and verified host template only. If none is verified, do not block or ask for confirmation: create it without description adjustment, read back its description as the template, then update only the managed region. Re-read the MR and preserve its locator for every later outcome.
3. Parse `## Publication fragment` from the approved plan before calling any Atlassian tool. The fragment must be either exactly `None` or one fenced `html` block containing non-empty markup. A malformed fragment is `blocked` after the MR is created, with the MR locator and factual reason.
4. If the fragment is exactly `None`, intentionally skip Confluence and return `ready` with the verified MR. This path makes no Confluence mutation.

## Conditional Confluence publication

For a non-empty approved HTML fragment only:

1. Validate configured `confluence.cloudId`, `confluence.pageId`, and `confluence.appendMode: top`. Block after MR creation if any required target value is missing or invalid.
2. Use `atlassian_getConfluencePage` with the configured target and `contentFormat: "html"`. Block if its version or content integrity drifted from the approved `Execution contract`.
3. Before constructing an HTML update, call `atlassian_getContentFormatGuide` with `{ "toolName": "updateConfluencePage" }` and follow its returned guidance. If it references a follow-up document, fetch that one document with the same tool using its `reference` value.
4. Form the new body by placing the approved raw fragment immediately before the fetched HTML body. Use `atlassian_updateConfluencePage` with the configured target, fetched title, combined body, and `contentFormat: "html"`. Do not send Markdown, Markdown code fences, or HTML-escaped fragment text. Preserve all pre-existing body content.
5. Re-read the page and confirm the approved fragment is its top insertion before returning `ready` with the verified MR and Confluence locator.

Git push/MR failure is `handoff` for a transient API failure or `blocked` for a persistent failure, before any Confluence call. A malformed fragment, missing target, page-integrity drift, or Confluence mutation failure after MR creation is `blocked` with the MR locator and factual reason.

`ready`: verified MR; when the approved fragment is non-empty, verified top-inserted Confluence content.
`handoff`: transient Git, GitLab, or Atlassian API failure.
`blocked`: invalid worktree/branch/commit ledger, malformed fragment, missing Confluence target for a non-empty fragment, integrity mismatch, or persistent publication failure.

When the KB publication ledger is absent or incomplete, return `gaps` with exact missing fields so the workflow re-enters implementation.
