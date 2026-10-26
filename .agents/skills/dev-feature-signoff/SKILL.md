---
name: dev-feature-signoff
description: Generate and publish feature sign-off documentation for a JIRA ticket. Use when a user asks to create a sign-off doc/page, prepare feature sign-off evidence. Reads the ticket and its linked merge requests (JIRA + GitLab), derives test scenarios and sanity-check URLs, captures screenshots and videos with playwright-cli (converting video to mp4 via ffmpeg), then publishes a formatted page with inline media to Confluence. Integrates JIRA (ticket context), GitLab (merge requests), and Confluence (publishing);
---

# Feature Sign-Off Automation

Generate comprehensive sign-off documentation for JIRA tickets with automated media
capture and Confluence publishing.

## Input

`$ARGUMENTS`: a command and optional JIRA id / flags.

| Command | Workflow |
|---|---|
| `generate [jira_id]` | Build the sign-off document from JIRA + MRs |
| `capture [screenshots\|videos\|both]` | Capture screenshots and/or videos |
| `publish [jira_id]` | Upload media and publish to Confluence |

Parse the command and JIRA id from `$ARGUMENTS` (infer the id from the branch name if omitted), then route to the matching workflow below.

At each step, briefly explain to the user — in your own words — what you are about to do and what resulted: which checks ran, what was created or uploaded, and the final page URL. Keep the user informed as you go rather than acting silently.

## Configuration & assets

- `config/paths.yml` — output directory structure and file naming.
- `templates/signoff-template.md` — the document template filled in Workflow 1.
- `scripts/` — see the list at the bottom; capture scripts are generated from the `*.template` files.

Output root: `.sdd/output/signoff/{jira_id}/` with `signoff.md`, `scripts/`, `media/`, `media/videos/`.

## Prerequisites

- `playwright-cli`: `npm install -g @playwright/cli` (capture)
- `ffmpeg` (video capture only)
- Python 3.8+: `pip install -r scripts/requirements.txt` (publish)
- MCP OAuth (Atlassian plugin) for reads; Confluence PAT for publishing — see `references/publishing.md`.

Validate anytime with `scripts/check-prerequisites.sh <jira_id>`.

---

## Workflow 1: Document Generation

Create the sign-off document from the JIRA ticket and (optionally) its merge requests.

### 1. Fetch JIRA context
`mcp__atlassian__getJiraIssue(cloudId: "agoda.atlassian.net", issueKey: {jira_id})`.
Extract Summary, Description, Acceptance Criteria, Epic link, Experiment ID (`ACT-XXX`), and Figma links.
Fail → "Failed to fetch JIRA ticket {jira_id}. Check ID and permissions."

### 2. Ask MR analysis preference (AskUserQuestion)
- **Skip MR Analysis (Recommended)** — generate from the JIRA ticket only. → go to step 5.
- **Include MR Analysis** — find and analyze related MRs. → step 3.

### 3. Find & analyze MRs (only if included)
- **Scope**: if the ticket is an Epic, find children via `searchJiraIssuesUsingJql` (`parent = "{epic_id}"`); if a Story, get its epic/siblings.
- **Find**: for each ticket id try `mcp__gitlab__get_merge_request` with `source_branch: {ticket_id}` across `activities-web`, `activities-bff`, `activities-api`. Fallback: parse `getJiraIssueRemoteIssueLinks` for `merge_requests/(\d+)`. Dedupe by `{project}!{iid}`.
- **Depth** (AskUserQuestion): Basic (files + descriptions), Hybrid (+ keyword scan: components, `ACT-\d+`, API routes, A/B flags), or Deep (line-by-line diff).
- No MRs → "No MRs found for {jira_id}. Add MR links to JIRA or provide manually."

### 4. Generate test scenarios
Acceptance Criteria is the primary source — **every AC item maps to ≥1 scenario**. Experiment ID → mandatory A/B variant tests; Figma → visual regression. If MR analysis ran, supplement (UI→visual, forms→validation, API→data/error, responsive→multi-platform, i18n→translation) but AC coverage still wins. Produce both a quick-reference table and detailed narratives (Description, Pre-conditions, Steps, Expected Result, Evidence, AC covered). Show the draft; offer Approve / Edit / Regenerate.

### 5. Query top activities
Show this query (Superset, Vertica, `bi_dw` schema) and wait for pasted results or `skip`:
```sql
SELECT fba.activity_id, da.activity_title, COUNT(DISTINCT fba.booking_id) AS booking_count,
       da.city_id, da.activity_main_category_name AS activity_category
FROM bi_dw.fact_booking_activity fba
INNER JOIN bi_dw.dim_activity da ON fba.activity_id = da.activity_id
WHERE fba.whitelabel_id = 1 AND da.activity_servable = 1 AND da.rec_status = 1
  AND fba.datadate >= CAST(DATE_FORMAT(DATE_SUB(NOW(), INTERVAL 90 DAY), '%Y%m%d') AS INT)
GROUP BY fba.activity_id, da.activity_title, da.city_id, da.activity_main_category_name
ORDER BY booking_count DESC LIMIT 10;
```
Parse `{activity_id, title, city_id, category}`. On `skip`, accept comma-separated ids and ask for a cityId per activity. At least one activity (id + cityId) is required.

### 6. Build sanity testing URLs
For each activity from step 5, the sanity table needs Variant A and B URLs. URL format is project-specific (detail pages, search results, checkout flows, etc.) — the skill does not assume any pattern. **Ask the user** for either:
- a URL template with placeholders (e.g. `{id}`, `{city}`, `{exp}`, `{variant}`) to fill per activity, or
- the full Variant A/B URLs for each activity.

Always use the `sgp.agoda.com` domain for the sanity testing and capture URLs (e.g. `https://sgp.agoda.com/...`) unless the user explicitly specifies a different domain.

Force the experiment variant via the `explist` query parameter rather than relying on allocation. `explist` takes a comma-separated list of `{EXP_ID}={variant}` pairs (e.g. `explist=ACTD-807=B,ACTD-774=B`) — include the experiment under test plus any dependencies it must run alongside. The Variant A and B URLs should differ only in the variant letters in `explist` (`=A` for Variant A, `=B` for Variant B). Example:
`https://sgp.agoda.com/activities/detail/?activityId=1252815&cityId=9395&explist=ACTD-807=B,ACTD-774=B`

Then show the generated sanity table and have the user confirm or edit the URLs before writing the document, so they're correct for this project and feature.

### 7. Fill template & write document
Fill `templates/signoff-template.md`: metadata, feature details, design/technical context, both test-scenario formats, the sanity table (`| Entity ID | Variant A URL | When EXP=A | Variant B URL | When EXP=B | Remarks |`), monitoring, stakeholders, references. Leave E2E/data/CMS/perf/accessibility sections as placeholders when not applicable.
`mkdir -p .sdd/output/signoff/{jira_id}/{scripts,media}` and write `signoff.md`. Show the summary.

### 8. Offer capture scripts (AskUserQuestion)
Screenshots only (Recommended) / Videos only / Both / Skip. Any non-skip choice → generate the script(s) per Workflow 2, then stop (user runs capture). Skip → done; remind them to run `/dev-feature-signoff {jira_id} capture` later.

---

## Workflow 2: Media Capture

Full concepts, step mapping, and the fuzzy element-mapping/approval flow: `references/capture-guide.md`.

**Choose type** (AskUserQuestion): `screenshots`, `videos`, or `both` (screenshots first, then videos).

### Screenshots
1. Require `signoff.md` and `playwright-cli` (`which playwright-cli`). If `scripts/capture_image.sh` already exists, offer Reuse / Edit / Regenerate.
2. Parse the sanity table → `{id, cityId, urlA, urlB}`. Copy `scripts/capture_image.sh.template` to the output `scripts/capture_image.sh`, fill the `ACTIVITIES` array, `chmod +x`. Confirm the plan with the user.
3. **Test-first**: `./scripts/capture_image.sh --test-only`, show the two PNGs, ask to approve. On failure offer Retry / Adjust URLs / Cancel.
4. **Batch**: `./scripts/capture_image.sh` (browser opens once, `sleep 5` per nav). Report success/failure counts.
5. Update the sanity table: tick `When EXP=A/B` where `{id}_A/B_desktop.png` exist; optionally add image links in Remarks. If type is `both`, continue to videos.

### Videos
1. Require `playwright-cli` and `ffmpeg` (stop if ffmpeg missing). If `scripts/capture-video.sh` exists, offer Reuse / Edit / Regenerate.
2. Parse the "Detailed Test Scenarios" section → `{id, name, url, steps[]}`. Copy `scripts/capture-video.sh.template` to the output `scripts/capture-video.sh`, fill `SCENARIOS` (`"{id}|{name}|{url}|{step}|..."`). Copy `scripts/convert-videos.sh` alongside it; `chmod +x` both. The capture script's final step runs `./scripts/convert-videos.sh ./media/videos` — **conversion is part of capture; a conversion failure fails capture.**
3. **Test-first (mandatory)**: `./scripts/capture-video.sh --test-only`. Then validate the auto-mapped elements with the user, flagging any `< 80%` confidence (see capture-guide). Approve / fix mappings / cancel.
4. **Batch**: `./scripts/capture-video.sh`. Each scenario re-snapshots and remaps at runtime.
5. Require `.mp4` output before updating. Add a `## 🎬 Video Evidence` table linking each video (duration via `ffprobe`). Show the final summary.

⚠️ Fuzzy element matching can fail on dynamic content or A/B variants — always use the test-first approval flow.

---

## Workflow 3: Confluence Publishing

Auth model, page create/find, and the full publish command: `references/publishing.md`. Uses REST + PAT for uploads/updates; MCP only for metadata. Re-running is safe.

**Confluence instance** (constant for Agoda): host `agoda.atlassian.net`, base URL `https://agoda.atlassian.net`. Scripts take the host via `CONFLUENCE_HOST` (defaults to `agoda.atlassian.net`).

1. **Resolve the publish target**: find the Confluence **upload URL** — the parent page the sign-off should nest under — from the JIRA ticket (check the description, remote/web links, and any link labelled Confluence or sign-off). Parse the space key and parent page id from it: `.../wiki/spaces/{SPACE}/pages/{PARENT_PAGE_ID}/...`. If the ticket has no such URL, **explicitly ask the user** for the Confluence page URL to publish under — never assume a default space or parent page. Keep `space` and `parent_page_id` for the next steps.
2. **Prerequisites**: run `scripts/check-prerequisites.sh {jira_id}` (document + screenshots + Python + deps). On failure, route the user to generate/capture/install.
3. **Credentials**: run `scripts/check-confluence-auth.py ~/.confluence/feature-sign-off-publish-config.yml "$CONFLUENCE_HOST"`. If missing/invalid, tell the user a Confluence PAT is required (see publishing.md for creating one), collect email + PAT, and run `scripts/save-confluence-credentials.sh "<email>" "<pat>" "$CONFLUENCE_HOST"`.
4. **Page**: fetch the JIRA summary, search for an existing page under `parent_page_id` (from step 1), and either reuse it or `createConfluencePage` with `contentFormat: "adf"` and `status: "current"`. Keep `page_id`.
5. **Validate media**: `scripts/validate-screenshots.sh .sdd/output/signoff/{jira_id}/media` (exit 1 → offer to capture).
6. **Publish**: run `scripts/confluence_publish_complete.py` (see publishing.md for the exact command). The script embeds media **inline**, not as bare attachments — screenshots into the sanity table's `When ...=A`/`When ...=B` cells, and `.mp4` videos into the `## 🎬 Video Evidence` table. Before publishing, confirm the document is embed-ready: screenshots named `{activityId}_{A|B}_{device}.png` with the matching variant checkbox ticked, and a `## 🎬 Video Evidence` table present for any videos (see publishing.md → "Embedding media"). Verify exit 0.

---

## Critical anti-patterns

1. ❌ `publish` before `generate` — no document exists for the script to convert.
2. ❌ Skipping credential setup — 401s on every upload.
3. ❌ Publishing to production without confirming `CONFLUENCE_HOST`.
4. ❌ Skipping test-first mode — a bad URL or mapping wastes the whole batch.
5. ❌ Search/list-page URLs, hardcoded URLs, or editing capture scripts by hand instead of regenerating from the document.
6. ❌ Updating or publishing the document before videos are converted to `.mp4`.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Document not found | Run `generate` first |
| `playwright-cli not found` | `npm install -g @playwright/cli` |
| Screenshot/video capture fails | Run `--test-only`; increase `sleep`; verify URLs/mappings |
| `ModuleNotFoundError` (requests/yaml) | `pip install -r scripts/requirements.txt` |
| 401 Unauthorized on publish | Regenerate PAT and re-run `save-confluence-credentials.sh` |
| ADF conversion failed | Validate markdown tables/links in `signoff.md` |

Philosophy: never block the whole workflow on one failure — fall back to a manual path (JIRA-only scenarios, manual activity ids, manual MR urls).

## Files

- `references/capture-guide.md` — screenshot/video capture concepts, step mapping, element approval.
- `references/publishing.md` — Confluence auth, page create/update, publish script.
- `templates/signoff-template.md`, `config/paths.yml`.
- `scripts/`: `check-prerequisites.sh`, `check-confluence-auth.py`, `save-confluence-credentials.sh`, `validate-screenshots.sh`, `convert-videos.sh`, `confluence_publish_complete.py`, `markdown_to_adf.py`, `capture_image.sh.template`, `capture-video.sh.template`, `requirements.txt`.
