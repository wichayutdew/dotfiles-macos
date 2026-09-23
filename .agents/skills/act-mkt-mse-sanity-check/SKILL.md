---
name: act-mkt-mse-sanity-check
description: Verify MSE (GTTD / TikTok Go) landing flow - search page card highlight, click-through to detail page, offer auto-expansion, and viewport scroll. Use when testing MSE landing pages, validating offer deep links, running sanity checks on activity search-to-detail flow, or debugging mseOfferId URLs. Trigger this skill whenever the user mentions GTTD, TikTok Go, MSE landing, offer expansion, or activity search testing.
compatibility: Requires Node.js, Playwright with Chromium, and network access to the target Agoda environment.
---

# MSE Landing Sanity Check

Verify the MSE (GTTD / TikTok Go) landing flow: search URL → highlighted activity card → click-through to detail page → offer auto-expanded and scrolled into view. In commands below, set `SKILL_DIR` to the absolute directory containing this file so bundled scripts can run from any working directory.

## Prerequisites
```bash
npm install --no-save playwright
npx playwright install chromium
```

## Quick Start
```bash
# 1. Devs: single activity via CLI flags
node "$SKILL_DIR/check.js" \
  --activity-id=12345 --offer-id=67890 --city-id=456

# 2. Content ops: batch from CSV
node "$SKILL_DIR/check.js" --file=test-cases.csv

# 3. Inline JSON (no temp file needed)
node "$SKILL_DIR/check.js" --json='[{"activityId":12345,"offerId":67890,"cityId":456}]'

# 3b. JSON file
node "$SKILL_DIR/check.js" --file=test-cases.json
```

## Options
| Flag | Description | Default |
|------|-------------|---------|
| `--activity-id` | Activity ID (single mode) | |
| `--offer-id` | MSE offer ID (single mode) | |
| `--city-id` | City ID (single mode) | |
| `--json` | Inline JSON array/object of test cases (agent-friendly) | |
| `--file` | CSV or JSON file for batch mode | |
| `--cid` | CID | 1909882 (GTTD) |
| `--locale` | Browser locale | en-us |
| `--domain` | Domain | www.agoda.com |
| `--headed` | Show browser window | false |
| `--screenshot-dir` | Screenshot output dir | ./mse-screenshots |
| `--workers` | Parallel workers for batch | 3 |
| `--exp` | Experiment JIRA ID for A/B comparison (runs each case twice) | |
| `--exp-user` | Experiment user bucket (expUser param) | A |
| `--discover` | Inspect search page DOM to find card selectors | false |

## Input Formats

### CLI flags (devs)
`--activity-id`, `--offer-id`, `--city-id` for quick single checks.

### CSV (content ops)
Minimum columns: `activity_id,offer_id,city_id`

Optional trailing columns: `cid,label`

Accepted layouts:

- `activity_id,offer_id,city_id`
- `activity_id,offer_id,city_id,cid`
- `activity_id,offer_id,city_id,cid,label`

### JSON (dev agents)
Array of objects (camelCase or snake_case keys):
```json
[
  { "activityId": 12345, "offerId": 67890, "cityId": 456 },
  { "activity_id": 99999, "offer_id": 11111, "city_id": 789, "cid": "1945279", "label": "tiktok-test" }
]
```
Single object also accepted (auto-wrapped to array). Pass via `--json='...'` or `--file=cases.json`.

## Experiment A/B Mode

Compare MSE landing behaviour between experiment control (A) and treatment (B):

```bash
# Runs each test case twice: expUser=A&expList=ACTSO-1234=A and expUser=A&expList=ACTSO-1234=B
node "$SKILL_DIR/check.js" \
  --json='[{"activityId":715511,"offerId":474016,"cityId":23021}]' \
  --exp=ACTSO-1234
```

- Automatically uses `hkg.agoda.com` (experiment enforcement requires it)
- CSV output includes `exp_side` column (A or B)
- Summary shows per-side pass rates and any A/B differences

## Validation Flow
1. **Search page**: Navigate to MSE URL, wait for activity cards to render
2. **Card highlight**: Find target activity card (`[data-activity-id]`), verify highlight border
3. **Click-through**: Click the highlighted card, wait for detail page in new tab
4. **Detail page**: Verify offer is auto-expanded (booking form or accordion) and scrolled into viewport

## Output
- **Console:** `[PASS]`/`[FAIL]` per test case with phase details
- **CSV:** `mse-results.csv` — columns: `activity_id,offer_id,city_id,label,pass,search_loaded,card_found,card_highlighted,card_clicked,detail_loaded,expanded_count,in_viewport,final_url,error`
- **Screenshots:** `{label}-search.png` (search page) + `{label}-viewport.png` + `{label}-full.png` (detail page)

## MSE Landing URL Formats
```
GTTD:    https://www.agoda.com/activities/search?cid=1909882&cityId={}&selectedActivity={}&mseOfferId={}&currency=USD
TikTok:  https://www.agoda.com/activities/search?cityId={}&selectedActivity={}&cid=1945279&mseOfferId={}
```
