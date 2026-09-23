---
name: act-mkt-trigger-content-enhancement
description: >
  Trigger activity content enhancement for a supplied list of activity IDs through the
  activity-marketing content-enhancement API. Use when manually reprocessing SEO/GPT
  content, dry-running eligibility, or triggering a bounded batch from sampled IDs.
compatibility: Requires Node.js and authenticated network access to the activity-marketing content-enhancement API.
---

# Trigger Content Enhancement

Trigger GPT content enhancement for activity IDs through `activity-marketing`. In commands below, set `SKILL_DIR` to the absolute directory containing this file so bundled scripts can run from any working directory.

## Usage

```bash
node "$SKILL_DIR/trigger.js" \
  --ids-file=top-10k-activities.txt \
  --dry-run
```

Use `top-10k-booking.sql` to generate a high-impact activity ID list from StarRocks.

## Options

- `--ids-file=<file>` — Required. Text file with one activity ID per line, or CSV with an `activity_id` column.
- `--dry-run` — Validate and call the API without triggering actual workflows.
- `--lookback-date=YYYYMMDD` — Override the API lookback date.
- `--api-url=<url>` — Override the activity-marketing API base URL.
