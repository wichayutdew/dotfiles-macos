# Confluence Publishing Reference

Publishing uses **two** auth systems. MCP OAuth (Atlassian) is read-only — JIRA
fetches, Confluence search, page create/metadata. A **Personal Access Token
(PAT)** is required for binary uploads and page content updates via REST API,
because MCP cannot upload attachments or return the `fileId` needed to embed an
image. The publish script (`scripts/confluence_publish_complete.py`) uses the PAT.

## Credentials

Stored at `~/.confluence/feature-sign-off-publish-config.yml` (chmod 600, never
committed). Create a PAT at
https://id.atlassian.com/manage-profile/security/api-tokens.

- Verify: `scripts/check-confluence-auth.py <config> <host>`
  (exit 0 = valid, 1 = invalid, 2 = missing/incomplete)
- Save/validate: `scripts/save-confluence-credentials.sh <email> <pat> <host>`

401 errors → PAT expired/invalid or email mismatch; regenerate and re-save.

## Page create / find (MCP)

The target `space` and `parent_page_id` come from the ticket's Confluence upload
URL (or the user) — see SKILL.md Workflow 3, step 1. A page URL
`.../wiki/spaces/{SPACE}/pages/{PARENT_PAGE_ID}/...` gives both. The instance is
fixed: `agoda.atlassian.net`.

Title format: `[Sign-off] {JIRA Summary} - {JIRA ID}`.

1. Fetch JIRA summary via `getJiraIssue` for the title.
2. Search for an existing page under the parent:
   `searchConfluenceUsingCql` with
   `type=page AND space={space} AND ancestor={parent_page_id} AND title~"{jira_id}"`.
   If found, offer **reuse** (update it) or **create new** (append timestamp to title).
3. Create via `createConfluencePage` with `spaceId`, `parentId` (={parent_page_id}),
   a placeholder body, **`contentFormat: "adf"`** and **`status: "current"`** (never
   draft/html/markdown — published pages allow immediate attachment uploads and
   media nodes).
4. Keep `page_id` and `page_url` from the response.

## Publish (REST, one command)

The complete script uploads attachments, converts markdown→ADF, injects media
nodes into the sanity table, links videos into the Video Evidence table, and
updates the page. Re-running is safe — it reuses existing attachments.

```bash
CONFLUENCE_HOST="${CONFLUENCE_HOST:-agoda.atlassian.net}"
cd .sdd/output/signoff/{jira_id} && \
python3 ${SKILL_ROOT}/scripts/confluence_publish_complete.py \
  --config ~/.confluence/feature-sign-off-publish-config.yml \
  --host "$CONFLUENCE_HOST" \
  --page-id {page_id} \
  --media-dir ./media \
  --video-dir ./media/videos \
  --markdown-file ./signoff.md
```

`--video-dir` defaults to `{media-dir}/videos` and is skipped if absent. Exit 0 =
success; the script retries uploads 3× with backoff. `test_*` images are excluded.

## Embedding media (images & videos)

Embedding is automatic, but only works when the document and the media files line
up. The script uploads every file as an attachment, then rewrites the ADF so the
media displays **inline** (not just as a download link). Two things get embedded:

**Screenshots → sanity testing table.** The table must have the 6-column layout
`| Activity ID | A URL | When ...=A | B URL | When ...=B | Remarks |`. For each row
the script reads the activity id from column 1 (index 0), then injects the image
into the **When ...=A cell (index 2)** and **When ...=B cell (index 4)**, replacing
the `[x]`/`[ ]` checkbox. Column order is positional — the images land in the two
checkbox columns, not the URL columns.
- Filenames **must** be `{activityId}_{A|B}_{device}.png` (e.g.
  `1252815_A_desktop.png`). The `{activityId}` prefix has to match the table row;
  `A`/`B` selects the column (case-insensitive, `_` or `-` separators accepted;
  `.png/.jpg/.jpeg/.gif` supported).
- The row's `When ...=A` / `When ...=B` cell must hold a checkbox (`[x]` for a
  captured variant). A blank/absent cell gets no image.
- `test_*` images are skipped — only batch captures embed.

**Videos → `## 🎬 Video Evidence` table.** The table must use the 5-column layout
`| Scenario | Activity | Description | Duration | Video |`. The script finds the
heading containing `Video Evidence`, then replaces the **Video cell (last column,
index 4)** of each row with an inline `.mp4` player, matched by filename.
- Only `.mp4` embeds — `.webm` must be converted first (capture does this).
- The document must contain the `## 🎬 Video Evidence` heading and table with the
  Video column last; without it, videos upload as attachments but never embed.
  Workflow 2 adds this table (see capture-guide → MP4 conversion).

So, to guarantee embedding at publish time: screenshots follow the
`{activityId}_{A|B}_{device}.png` convention and the matching checkbox is ticked;
videos are `.mp4` and the `## 🎬 Video Evidence` table is present. Re-running is
safe — existing attachments are reused and media nodes re-injected.

## Common failures

- **401 Unauthorized** → PAT/credentials (above).
- **ADF conversion failed** → malformed markdown table or link; validate the document.
- **429 / all uploads failed** → rate limit or bad page id; wait and retry, verify the page exists.
