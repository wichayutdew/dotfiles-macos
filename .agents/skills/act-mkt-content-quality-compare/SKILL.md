---
name: act-mkt-content-quality-compare
description: Evaluate A/B experiment content quality with cross-language comparison and stratified segment analysis. Use when comparing GPT-enhanced content variants, scoring content quality across locales, or investigating whether content quality explains experiment results. Trigger this skill whenever the user mentions content quality scoring, A/B content comparison, experiment content evaluation, GPT content assessment, or LLM-generated content review.
compatibility: Requires Node.js, network access to Agoda activity services, and an available LLM for scoring. Playwright is required only for rendered-page extraction.
---

# Content Quality Comparison

Evaluate A/B experiment content quality through two phases: cross-language comparison and stratified segment analysis. Extracts content via Activity Search GraphQL API (fast, structured) or Playwright (full rendered page), scores with LLM, and produces findings.

All output goes to `content-quality/<experiment-id>-<short-title>/` where `<short-title>` describes the segment observed (e.g., `indonesian-domestic-sigloss`). See **Output Directory Structure** for layout rules. In commands below, set `SKILL_DIR` to the absolute directory containing this file so bundled scripts can run from any working directory.

## Step 0: Plan

### Step 0.1: Discover Experiments

Query `activity_enhancement_content` for running experiments:

```sql
SELECT experiment_name, COUNT(DISTINCT activityid) AS cnt,
       MIN(insert_datetime) AS started, MAX(insert_datetime) AS latest
FROM agoda_activities.activity_enhancement_content
GROUP BY experiment_name
ORDER BY latest DESC
LIMIT 10;
```

Present the list and ask the user which experiment to evaluate.

### Step 0.2: Gather Requirements

Once the experiment is chosen, ask:

1. **Which locales to compare?** (e.g., `id-id`, `ja-jp`, `th-th`, `vi-vn`, `zh-hk`)
2. **Extraction mode?** — **API** (fast, structured, internal network) or **Playwright** (full rendered page, public web). Default: API.
3. **What segment for stratified analysis?** — The dimension to slice by in Phase 2 (e.g., destination country, city, activity category). This determines how we build the stratified sample.
4. **Do we already have activity IDs, or should we query StarRocks?**
5. **Scoring model?** (default: `gemini-3.1-pro-preview`)

The experiment ID from step 0.1 auto-derives the URL params — no need to ask for them.

### Step 0.3: Create Execution Plan

Document the following before running any scripts:

- **Experiment ID:** `<EXP_ID>` from step 0.1
- **Extraction mode:** API or Playwright (from step 0.2)
- **Control param (A-side):** API: `experimentInfo: {}` / Playwright: `expUser=B`
- **Experiment param (B-side):** API: `forcedExperiments` / Playwright: `expList=<EXP_ID>=B`
- **Output directory:** `content-quality/<EXP_ID>-<short-title>/`
- **Locales:** list from step 0.2
- **Segment:** dimension from step 0.2
- **Scoring model:** from step 0.2
- **Phases:** Phase 1 (cross-language), Phase 2 (stratified), Phase 3 (findings)

### Step 0.4: Get User Approval

Present the execution plan and wait for explicit approval before running any scripts.

Do NOT proceed until the user approves the plan.

### Output Directory

Create the output directory based on experiment ID and a short title describing the segment:

```bash
mkdir -p content-quality/<EXPERIMENT>-<short-title>
# e.g., content-quality/ACTB-2400-thai-beach-activities
```

All sample files, extraction results, scored results, and findings go into this directory.

---

## Phase 1: Cross-Language Comparison

**Goal:** Evaluate content quality across all target languages using a random sample. Confirms whether the GPT pipeline produces uniform quality regardless of language.

### Step 1.1: Sample Activity IDs

Choose a sampling strategy based on the goal:

#### Random sample (~100 activities, default for cross-language comparison)

```sql
SELECT DISTINCT activityid
FROM agoda_activities.activity_enhancement_content
WHERE experiment_name = '<EXPERIMENT>'
  AND languageid = <LANG_ID>
ORDER BY RAND()
LIMIT 100;
```

#### Top-booked activities (quick sanity check on high-impact content)

Top 10 activities by booking volume in the last 90 days. Useful for a fast spot-check before running a full sample.

```sql
SELECT
  f.activity_id,
  COUNT(*) AS booking_count_last_90_days
FROM bi_dw.fact_booking_activity AS f
  LEFT JOIN bi_dw.dim_activity AS d ON d.activity_id = f.activity_id
WHERE f.whitelabel_id = 1
  AND DATE(f.booking_date) >= CURRENT_DATE - INTERVAL '90 days'
  AND d.activity_servable = 1
  AND d.rec_status = 1
GROUP BY f.activity_id
ORDER BY booking_count_last_90_days DESC
LIMIT 10;
```

Save to `content-quality/<EXPERIMENT>-<short-title>/sample-ids.txt` (one ID per line).

### Step 1.2: Extract Content Across Locales

Extraction supports all locales for both A and B sides. Scoring (Step 1.3) is meaningful for languages that have been enhanced — check `activity_enhancement_content` for which `languageid` values have data for the experiment. Use the main language ID per locale (language group ID) for both extraction and scoring, since content is stored and retrieved by language group.

#### API mode (default — fast, structured)

```bash
export OUTPUT_DIR=content-quality/<EXPERIMENT>-<short-title>
export EXP_ID=<EXPERIMENT>
for locale in <LOCALES>; do
  node "$SKILL_DIR/extract-api.js" $locale &
done
wait
```

#### Playwright mode (full rendered page)

```bash
export OUTPUT_DIR=content-quality/<EXPERIMENT>-<short-title>
export EXP_ID=<EXPERIMENT>
for locale in <LOCALES>; do
  node "$SKILL_DIR/extract.js" $locale &
done
wait
```

Output: `<OUTPUT_DIR>/results-<locale>.csv`

Columns: `activity_id, a_title, b_title, a_description, b_description, a_sections, b_sections, a_error, b_error`

The `a_sections` and `b_sections` columns contain JSON arrays of `{name, content_length, content_preview}`. API mode extracts structured sections (genericSection, additionalDetails, inclusions, exclusions, itineraries, offers, logistics, ticketing). Playwright mode captures H2 sections from the rendered page. Content previews capture up to 2000 chars per section for accurate scoring.

### Step 1.3: Score All Locales

```bash
export OUTPUT_DIR=content-quality/<EXPERIMENT>-<short-title>
for locale in <LOCALES>; do
  node "$SKILL_DIR/score.js" $locale
done
```

Output: `<OUTPUT_DIR>/scored-<locale>.csv` — per-dimension scores from LLM (no total_mark yet).

**Scoring dimensions:**
| Dimension | Weight | What it measures |
|-----------|-------:|------------------|
| fluency | 20% | Natural language flow |
| grammar | 15% | Correctness of spelling, punctuation |
| structure | 15% | Formatting, readability, use of lists/headers |
| relevance | 25% | No hallucination, stays on-topic |
| completeness | 15% | Information preserved across ALL sections |
| tone | 10% | Appropriate travel/marketing voice |

Scale: 0-100 per dimension, where 50 = no improvement over original.

### Step 1.3b: Aggregate Scores

Calculate weighted `total_mark` and summary statistics from scored CSVs:

```bash
export OUTPUT_DIR=content-quality/<EXPERIMENT>-<short-title>
node "$SKILL_DIR/aggregate.js" <locale>
```

Output: `<OUTPUT_DIR>/summary-<locale>.csv` — adds `total_mark` column and prints per-dimension averages.

Weights are configurable via `WEIGHTS` env var (JSON object), default: `{"fluency":0.20,"grammar":0.15,"structure":0.15,"relevance":0.25,"completeness":0.15,"tone":0.10}`.

### Step 1.4: Analyze

Build a cross-language comparison table:

| Locale | Total | Fluency | Grammar | Structure | Relevance | Completeness | Tone | Scored |
|--------|:-----:|:-------:|:-------:|:---------:|:---------:|:------------:|:----:|:------:|

Key questions:
- Is the spread across languages tight (<3 points)? → Pipeline quality is uniform
- Does one language lag? → Investigate prompt quality for that language
- Is completeness low (<80)? → Check if extraction captures all sections (see Lessons Learned)
- Is relevance low (<90)? → Possible hallucination issue in content generation

---

## Phase 2: Stratified Segment Analysis

**Goal:** Eliminate sampling bias by matching experiment population distribution along the observed segment. Confirms quality is uniform across all slices of the segment.

### Step 2.1: Identify Segment Distribution

Using the segment chosen in Step 0, query the population distribution. Example for city:

```sql
SELECT d.city_name, COUNT(DISTINCT a.activityid) AS cnt
FROM agoda_activities.activity_enhancement_content a
JOIN bi_dw.dim_activity d ON a.activityid = d.activity_id
WHERE a.experiment_name = '<EXPERIMENT>'
  AND a.languageid = <LANG_ID>
  AND d.country_name = '<COUNTRY>'
GROUP BY d.city_name
ORDER BY cnt DESC;
```

Other segment examples:
- **By country:** `GROUP BY d.country_name`
- **By activity category:** `JOIN bi_dw.dim_activity_category ...`

### Step 2.2: Build Stratified Sample

Sample proportionally to the population distribution (~200 activities):

```sql
SELECT a.activityid AS activity_id, d.<segment_column>
FROM agoda_activities.activity_enhancement_content a
JOIN bi_dw.dim_activity d ON a.activityid = d.activity_id
WHERE a.experiment_name = '<EXPERIMENT>'
  AND a.languageid = <LANG_ID>
  AND d.country_name = '<COUNTRY>'
GROUP BY a.activityid, d.<segment_column>
ORDER BY d.<segment_column>, RAND()
LIMIT 200;
```

Save results into the output directory:
- `sample-ids-<segment>.txt` — IDs only (one per line)
- `sample-ids-<segment>-cities.csv` — ID-to-segment mapping

### Step 2.3: Extract and Score

Use `IDS_FILE` and `RUN_TAG` env vars to keep results separate from Phase 1:

```bash
export OUTPUT_DIR=content-quality/<EXPERIMENT>-<short-title>
export EXP_ID=<EXPERIMENT>

# Extract (API mode — use extract.js for Playwright mode)
IDS_FILE=sample-ids-<segment>.txt RUN_TAG=<segment> \
  node "$SKILL_DIR/extract-api.js" <locale>

# Score
RUN_TAG=<segment> \
  node "$SKILL_DIR/score.js" <locale>

# Aggregate
RUN_TAG=<segment> \
  node "$SKILL_DIR/aggregate.js" <locale>
```

Output: `results-<segment>-<locale>.csv`, `scored-<segment>-<locale>.csv`, `summary-<segment>-<locale>.csv`

### Step 2.4: Analyze by Segment

Break down scores by segment using the mapping file:

```python
# Join scored CSV with segment mapping → group by segment → compute averages per segment
```

Produce a table:

| Segment | Count | Avg | Min | Max |
|---------|------:|----:|----:|----:|

Key questions:
- Are scores uniform across segments? → No segment-specific quality issues
- Do stratified results match Phase 1? (within ~1-2 points) → Sampling bias was minimal
- Any outlier segments? → Investigate specific activities

---

## Phase 3: Document Findings

Write findings to `content-quality/<EXPERIMENT>-<short-title>/findings.md` covering:

1. **Executive summary** — One sentence: is content quality the cause of experiment loss?
2. **Cross-language table** — Scores across all locales
3. **Segment breakdown** — Scores by segment with count/avg/min/max
4. **Phase comparison** — Cross-language vs stratified scores (should be stable within ~1-2 points)
5. **Key findings** — Numbered, specific, data-backed
6. **Methodology** — Extraction method, scoring model, sample selection, dimensions
7. **Recommendations** — What to do next based on results
8. **Data files** — Table of all artifacts produced

---

## Output Directory Structure

### Single phase (one run)

If you only run one phase, put everything flat in the root:

```
content-quality/<EXPERIMENT>-<short-title>/
  sample-ids.txt
  sample-ids-<segment>-cities.csv
  results-<locale>.csv
  scored-<locale>.csv
  findings.md
```

### Multiple phases (more than one run)

When running multiple iterations, add a `phase-<n>-<segment>/` subfolder for each run:

```
content-quality/<EXPERIMENT>-<short-title>/
  findings.md                           # Aggregated findings across all phases
  phase-1-cross-language/
    sample-ids.txt
    results-<locale>.csv
    scored-<locale>.csv
  phase-2-indonesia/
    sample-ids.txt
    sample-ids-cities.csv
    results-<locale>.csv
    scored-<locale>.csv
```

The subfolder name should be `phase-<n>-<segment>` where `<segment>` describes what that run focused on (e.g., `cross-language`, `indonesia`, `thailand-beach`, `category-tours`).

---

## Extraction Modes

| Aspect | API (`extract-api.js`) | Playwright (`extract.js`) |
|--------|----------------------|--------------------------|
| Speed | ~1 min / 200 activities | ~30 min / 200 activities |
| Content | Structured JSON fields | HTML scraping, accordion expansion |
| Sections | genericSection, additionalDetails, inclusions, exclusions, itineraries, offers, logistics, ticketing | H2 elements only |
| A/B variants | `forcedExperiments` in request context | URL params (expUser, expList) |
| Network | Internal API (privatecloud) | Public web (hkg.agoda.com) |
| Dependencies | Node.js built-in fetch | playwright, chromium |
| When to use | Default — fast, structured, reliable | When you need rendered page fidelity or sections not in the API |

Both produce the same CSV format, so `score.js` works with either.

## Experiment Param Convention

**API mode:** A-side uses `experimentInfo: {}` (empty = control). B-side uses `forcedExperiments: [{ experiment: "<EXP_ID>", variant: "B" }]`.

**Playwright mode:** Agoda FE forced experiments use URL params:
- `expUser=A|B` — assigns user to group A or B. B = control/default group.
- `expList=<exp-id>=A|B` — forces a specific experiment to variant A or B.

The skill auto-constructs params from `EXP_ID`:
- **A-side (control):** `expUser=B` — default control group
- **B-side (experiment):** `expList=<EXP_ID>=B` — forces experiment to B variant

Override with `EXP_PARAM_A`/`EXP_PARAM_B` for non-standard experiments.

## Scripts Reference

| Script | Purpose | Key env vars |
|--------|---------|-------------|
| `extract-api.js` | API extraction via Activity Search GraphQL, 10 parallel requests | `OUTPUT_DIR` (required), `EXP_ID` (required), `IDS_FILE`, `RUN_TAG`, `EXP_VARIANT` (default: B), `API_HOST`, `API_CONCURRENCY` (default: 10) |
| `extract.js` | Playwright extraction, 5 parallel workers | `OUTPUT_DIR` (required), `EXP_ID` (primary), `IDS_FILE`, `RUN_TAG`, `EXP_PARAM_A`, `EXP_PARAM_B` (overrides), `EXP_CONTROL`, `EXP_VARIANT` |
| `score.js` | LLM scoring via GenAI Gateway (per-dimension, no total) | `OUTPUT_DIR` (required), `RUN_TAG`, `OPENAI_BASE_URL`, `SCORE_MODEL` (default: gemini-3.1-pro-preview), `SCORE_CONCURRENCY` (default: 5) |
| `aggregate.js` | Calculate weighted total_mark and summary stats | `OUTPUT_DIR` (required), `RUN_TAG`, `WEIGHTS` (JSON, optional) |

### Customizing

- **Different model:** Set `SCORE_MODEL` env var (default: `gemini-3.1-pro-preview`)
- **Different concurrency:** Set `SCORE_CONCURRENCY` env var (default: 5)
- **Different dimensions:** Edit `SCORING_PROMPT` in `score.js`
- **Different experiment:** Set `EXP_ID` env var, or override with `EXP_PARAM_A`/`EXP_PARAM_B`
- **Different control group:** Set `EXP_CONTROL` env var (default: `expUser=B`)

### Adding a New Locale

1. Add entry to `LANG_NAMES` in `score.js`
2. No changes needed in `extract.js` — it accepts any locale string

## Locale-to-Language-ID Reference

Multiple locales share the same **language group ID** (main language ID). For example, `en-us` (1), `en-gb` (16), `en-au` (18) all belong to the English language group — content enhancement is stored by language group, so use the main locale per group (e.g., `en-us` for English, `fr-fr` for French) for extraction and scoring.

Which languages have enhanced content depends on the experiment — query `activity_enhancement_content` to check:

```sql
SELECT DISTINCT languageid, COUNT(*) AS cnt
FROM agoda_activities.activity_enhancement_content
WHERE experiment_name = '<EXPERIMENT>'
GROUP BY languageid;
```

Common enhanced languages (from ETL): `en-us` (1), `ja-jp` (6), `th-th` (22), `zh-hk` (7), `id-id` (26), `vi-vn` (24).

<details>
<summary>Full locale-to-language-ID mapping (52 locales)</summary>

| Locale | Lang ID | Locale | Lang ID | Locale | Lang ID |
|--------|--------:|--------|--------:|--------|--------:|
| en-us | 1 | en-ca | 14 | nb-no | 28 |
| fr-fr | 2 | en-in | 15 | da-dk | 29 |
| de-de | 3 | en-gb | 16 | fi-fi | 30 |
| it-it | 4 | en-za | 17 | cs-cz | 31 |
| es-es | 5 | en-au | 18 | tr-tr | 32 |
| ja-jp | 6 | en-sg | 19 | ca-es | 33 |
| zh-hk | 7 | zh-tw | 20 | hu-hu | 34 |
| zh-cn | 8 | en-nz | 21 | hi-in | 35 |
| ko-kr | 9 | th-th | 22 | bg-bg | 36 |
| el-gr | 10 | ms-my | 23 | ro-ro | 37 |
| ru-ru | 11 | vi-vn | 24 | sl-si | 38 |
| pt-pt | 12 | sv-se | 25 | he-il | 39 |
| nl-nl | 13 | id-id | 26 | ar-ae | 40 |
| | | pl-pl | 27 | nl-be | 41 |
| en-ie | 42 | lt-lt | 46 | uk-ua | 50 |
| pt-br | 43 | lv-lv | 47 | tl-ph | 51 |
| es-ar | 44 | hr-hr | 48 | fr-ca | 52 |
| es-mx | 45 | et-ee | 49 | | |

</details>

## Prerequisites

```bash
npm install --no-save playwright openai
npx playwright install chromium
```

---

## Lessons Learned

These were discovered during past investigations and are built into the current methodology:

1. **Extract ALL sections, not just visible fields.** Early attempts only captured 3 fields (title, description, product-info) and the LLM unfairly penalized B-side for "missing" info that existed in accordion sections. Always expand all accordions and capture every H2 section.

2. **Score completeness holistically.** The scoring prompt must instruct: "Do NOT penalize B-side for having a concise summary in one section if the detailed information exists elsewhere in another section." Content may be reorganized between variants.

3. **Stratified sampling matters.** Random sampling can over/under-represent segments. Use proportional stratified sampling when the experiment spans diverse geographies or categories.

4. **High content quality scores don't explain experiment loss.** If scores are 85+, the root cause is likely non-content: page load performance, layout shift (CLS), engagement metrics, or conversion funnel effects. Pivot investigation accordingly.

5. **Cross-language scores are remarkably stable.** The GPT pipeline produces uniform quality (±2-3 points) across languages. A single-locale evaluation is usually sufficient for content quality; multi-locale confirms consistency.

6. **Full section content matters for accurate scoring.** Truncating section content to 150 chars caused the LLM to underscore completeness and relevance — it couldn't see enough text to judge. Capture up to 2000 chars per section and pass the full content to the scoring prompt.
