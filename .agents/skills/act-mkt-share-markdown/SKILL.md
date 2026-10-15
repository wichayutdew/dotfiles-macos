---
name: act-mkt-share-markdown
description: Use when a user asks to share, publish, or upload a Markdown document, report, plan, or Markdown bundle to Agoda Quick Share and needs a shareable link.
compatibility: Requires authenticated Quick Share MCP access and network access to share.agodadev.io; file uploads require an HTTP client.
---

# Share Markdown

Publish only on an explicit sharing request. Always enable comments on shared Markdown pages. Preserve the original source files; prepare an upload copy when frontmatter must change. Use Quick Share's Markdown renderer, not custom HTML. Default to **all Okta-authenticated users** (`access: "public"`) without asking the audience again. This is not anonymous internet access. Never post to Slack automatically.

## Prerequisites

Discover the current Quick Share MCP tools and their schemas. Required operations are `get_markdown_guidelines`, `list_deployments`, and either `deploy_markdown` or `begin_file_deploy`; tool names may have a server prefix. Fetch the read-only Markdown guidelines before publishing.

If tools are unavailable, distinguish missing registration from failed authentication or a disconnected session. Instruct the user to add Quick Share MCP if it is not registered; do not just report missing tools. Do not install, edit client configuration, or authenticate automatically, and do not invent a token-based fallback.

For Codex, give these registration, OAuth, and verification commands. If already registered, skip `add` and address authentication or connection instead:

```bash
codex mcp add quick-deploy --url https://mcp-gateway.agodadev.io/quick-deploy/mcp
codex mcp login quick-deploy --scopes mcp:quick-deploy
codex mcp list
```

For clients that use `mcpServers` JSON configuration, instruct the user to add:

```json
{
  "mcpServers": {
    "quick-deploy": {
      "type": "http",
      "url": "https://mcp-gateway.agodadev.io/quick-deploy/mcp"
    }
  }
}
```

After registration, complete OAuth in the active client, reconnect or reload the MCP session as needed, and retry tool discovery. A configured server alone is not proof that its tools are connected and authenticated. Authentication uses MCP Gateway OAuth with scope `mcp:quick-deploy`. Ownership comes from the authenticated identity, not a guessed `owner` argument. Canonical references: `https://share.agodadev.io/docs` and `https://share.agodadev.io/docs/markdown`. If guideline discovery is unavailable, read the focused guide through an authorized HTTP client; deployment still requires authenticated tools.

## Prepare

1. Identify the requested text, local file, or bundle. Ask for the document only if ambiguous. Read local Markdown without modifying it; inspect relative links/images to determine whether a bundle is necessary.
2. Standalone Markdown renders to `index.html`. A Markdown ZIP requires root `index.md`; retain relative paths. Every Markdown file renders to its matching `.html` path and relative Markdown links are rewritten. Only raster image assets survive; stop if required assets cannot be represented rather than silently dropping them.
3. Optional YAML frontmatter supports `title`, `description`, `comments`, and `toc`. Malformed frontmatter or invalid values reject deployment. Unknown keys, missing/multiple H1 headings, and skipped heading levels produce persisted warnings. Report warnings; do not silently rewrite the document. `toc` defaults to automatic generation when headings exist; `toc: false` disables it.
4. Always set `comments: true` in the upload Markdown's YAML frontmatter. Add it when absent and replace `comments: false`; explicit frontmatter overrides `commentsModule`, so the deployment flag alone is insufficient. For local files or bundles, make this change only in a staging copy, preserving the originals, unrelated frontmatter, content, and relative paths. Apply it to every Markdown page in a bundle. For inline text, prepare the same comments-enabled upload text. Report when an explicit `comments: false` was changed in the upload copy.
5. Also pass `commentsModule: true` to `deploy_markdown` or `begin_file_deploy` when its discovered schema supports that flag. If the flag is unavailable, use the supported `comments: true` frontmatter. Stop with a factual blocker if neither supported mechanism can enable comments; never share a comments-disabled page as a successful result.

## Publication settings

- **Name:** derive from title/filename; require `^[A-Za-z][A-Za-z0-9_-]{2,40}$` (3–41 characters). Follow paginated `list_deployments` results (`items`, `hasMore`), using the appropriate scope/search to check the exact name. A collision requires a fresh valid name unless updating that deployment was explicitly requested. Never treat a listing/auth failure as proof that a name is available.
- **Access:** explicitly send `public` by default. A requested `restricted` mode requires non-empty `viewers` using the discovered schema. A requested `private` mode allows owners/co-owners only; require verified primary-owner identity, never guess it or silently fall back to public.
- **TTL:** omit `ttlH` for the service default on new deployments: 720 hours (30 days) of inactivity. Deploy/redeploy, extension, or visits reset a finite window. Requested values must be 0–8760 hours; 0 means no expiry. For authorized updates without a TTL override, omit it to preserve the existing window.
- **Metadata:** optional title/description overrides are at most 500 characters each and supersede frontmatter. Omit unless requested; blank values clear overrides.

## Deploy

- **Inline text:** call `deploy_markdown` with `name`, the comments-enabled `markdown` prepared above, and the chosen settings, including `commentsModule: true` when supported.
- **Local file/bundle:** call `begin_file_deploy` with `fileType: "markdown"` or `"markdown_zip"`, `name`, and the settings, including `commentsModule: true` when supported. Upload the prepared comments-enabled staging file/bundle. Do not paste file bytes into MCP JSON.
- Inspect the ticket's `operation` before uploading. If it says `redeploy` without explicit update authority, abandon that ticket and choose/check a fresh name. Recheck names immediately before inline deployment; the listing is not an atomic reservation.
- Upload raw file bytes to the returned `uploadUrl` using its method/content type, before `expiresAt` and within `maxBytes`. Use a quoted file path with an HTTP client's binary-file option, not multipart, JSON, or base64. Upload URLs are credentials: never print them, tokens, or secret-bearing commands.
- Tickets are single-use. After validation failure or expiry, correct the cause and obtain a fresh ticket. If an upload's outcome is ambiguous, inspect deployment/version state before retrying; never blindly redeploy.
- Check tool/HTTP success and inspect advisory `warnings`, including redeploy comment-anchor warnings. Missing authentication, failed validation, or upload failure is not successful sharing.

## Result

On confirmed success, return one item per line:

- The **service-returned** sharing URL; never construct a success link from the name alone.
- Access mode and audience.
- Comments enabled, based on the submitted frontmatter/settings and any returned warnings.
- TTL policy (inactivity window or no expiry).
- Deployment warnings and necessary follow-up, if any.

On failure, report the blocker and next corrective action without a success URL. Sharing-skill creation or a verification request alone never authorizes publishing a test document.
