---
name: act-mkt-prompt-quality-eval
description: Pre-production prompt quality evaluation for SEOGPTContent activity sync pipeline. Samples top activities, fetches content via detailSeo gRPC, reconstructs production-identical prompts, generates enhanced content via GenAI Gateway, and scores output on 6 quality dimensions. Use when testing prompt changes, comparing generation models, or benchmarking content quality across components and languages.
compatibility: Requires Node.js, Python 3, grpcurl, jq, access to Agoda development services, and GenAI Gateway credentials.
---

# Prompt Quality Evaluation

Pre-production evaluation of SEOGPTContent activity enhancement prompts. Reconstructs the exact production pipeline (gRPC fetch → field filtering → prompt construction → GenAI generation), then scores output quality using the same 6-dimension framework from `content-quality-compare`.

**Use cases:**
- Test system prompt changes before updating the GPT Assistants API
- Compare generation models (e.g., `gemini-2.5-flash` vs `gemini-3.1-pro`)
- Benchmark content quality across components and languages
- Validate prompt changes don't degrade output quality

All output goes to `prompt-quality-eval/<run-name>/` (e.g., `prompt-quality-eval/test-new-prompt-v3/`). In commands below, set `SKILL_DIR` to the absolute directory containing this file so bundled scripts can run from any working directory.

---

## Workflow

### Phase 0: Configuration

Gather parameters:

1. **Run name:** Short identifier for this evaluation run (e.g., `test-new-prompt-v3`, `compare-models-flash-vs-pro`)
2. **Assistant ID (slug):** The GPT assistant identifier from GPT Assistants API (e.g., `activity-product-assistant-v2`). **OR** provide `SYSTEM_PROMPT_FILE` path to override.
3. **Components:** Which components to evaluate — one or more of: `title`, `description`, `product-information` (default: all 3)
4. **Languages:** Target language IDs (default: `1` English). Common: `1,6,22,26` (EN, JP, TH, ID).
5. **Generation model:** Default: `gemini-2.5-flash` (matches production). Can test alternatives like `gemini-3.1-pro`.
6. **Sample size:** How many activities to evaluate (default: 200 for quick eval, up to 10K for full benchmark)
7. **Scoring mode:** `comparison` (scores original vs generated, default) or `absolute` (scores generated content alone, no comparison)

Create output directory:
```bash
export OUTPUT_DIR=prompt-quality-eval/<run-name>
mkdir -p $OUTPUT_DIR
```

### Phase 1: Sample Activities

Run `sample.sql` on StarRocks to get top N servable activities by booking volume:

```sql
-- Edit LIMIT value as needed
SELECT d.activity_id, d.activity_title, COUNT(b.booking_id) AS booking_cnt
FROM bi_dw.dim_activity d
JOIN bi_dw.fact_booking_activity b ON d.activity_id = b.activity_id
WHERE d.activity_servable = TRUE AND d.rec_status = 1
  AND b.booking_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
GROUP BY d.activity_id, d.activity_title
ORDER BY booking_cnt DESC
LIMIT 200;
```

Export results to `$OUTPUT_DIR/sample-ids.txt` (one activity_id per line).

### Phase 2: Fetch Activity Details

Run `fetch-details.js` to call the gRPC `activityDetailSeo` endpoint:

```bash
export OUTPUT_DIR=prompt-quality-eval/<run-name>
node "$SKILL_DIR/fetch-details.js"
```

**What it does:**
- Reads activity IDs from `sample-ids.txt`
- Calls `activity-contentread-production.privatecloud.hk.agoda.is:80` via `grpcurl`
- Extracts `details` (ActivityDetails) and `metadata` (DetailMetadata with geoLocation)
- Outputs `activity-details.jsonl` (one JSON object per line)

**Prerequisite:** `grpcurl` must be installed (`brew install grpcurl` on macOS).

**Output:** `$OUTPUT_DIR/activity-details.jsonl`

### Phase 3: Generate Enhanced Content

Run `generate.js` to construct prompts and call GenAI Gateway:

```bash
export OUTPUT_DIR=prompt-quality-eval/<run-name>
export ASSISTANT_ID=activity-product-assistant-v2  # or use SYSTEM_PROMPT_FILE

# Optional overrides:
# export SYSTEM_PROMPT_FILE=my-test-prompt.txt  # Test prompt changes before deploying
# export COMPONENT=product-information           # Generate only one component
# export LANGUAGE_IDS=1,6,22                     # EN, JP, TH
# export GEN_MODEL=gemini-3.1-pro                # Test different model

node "$SKILL_DIR/generate.js"
```

**What it does:**
1. Fetches system prompt from GPT Assistants API (or reads from `SYSTEM_PROMPT_FILE`)
2. For each activity × component × language:
   - Filters details per component (matching `ActivityContentReadInjector.filterActivityDetails`)
   - Constructs user prompt in XML format (matching `ActivityProductAssistantSync.yaml`)
   - Calls GenAI Gateway with system + user prompts
3. Outputs `generated-<component>-<lang_id>.csv` per component × language

**Output:** `$OUTPUT_DIR/generated-*.csv` files

Columns: `activity_id, component, language_id, language_name, details_filtered, enhanced_content, generation_model, generation_error`

### Phase 4: Score Quality

Run `score.js` to evaluate generated content:

```bash
export OUTPUT_DIR=prompt-quality-eval/<run-name>
export SCORE_MODE=comparison  # or 'absolute'

# Score all generated files:
node "$SKILL_DIR/score.js"

# Or score specific component + language:
# node "$SKILL_DIR/score.js" product-information 1
```

**Scoring dimensions** (0-100 per dimension, 50 = no improvement in comparison mode):

| Dimension | Weight | What it measures |
|-----------|-------:|------------------|
| fluency | 20% | Natural language flow |
| grammar | 15% | Correctness of spelling, punctuation |
| structure | 15% | Formatting, readability, use of lists/headers |
| relevance | 25% | No hallucination, stays on-topic |
| completeness | 15% | Information preserved from original input |
| tone | 10% | Appropriate travel/marketing voice |

**Scoring modes:**
- **Comparison (default):** LLM sees original details + generated content, scores improvement quality (0-100, where 50 = no improvement)
- **Absolute:** LLM sees only generated content, scores absolute quality (0-100, where 50 = mediocre)

**Output:** `$OUTPUT_DIR/scored-<component>-<lang_id>.csv`

Columns: `activity_id, component, language_id, fluency, grammar, structure, relevance, completeness, tone, score_mode, score_error`

### Phase 4b: Aggregate Scores

Run `aggregate.js` to calculate weighted `total_mark`:

```bash
export OUTPUT_DIR=prompt-quality-eval/<run-name>

# Aggregate all scored files:
node "$SKILL_DIR/aggregate.js"

# Or aggregate specific component + language:
# node "$SKILL_DIR/aggregate.js" product-information 1
```

**Output:** `$OUTPUT_DIR/summary-<component>-<lang_id>.csv`

Adds `total_mark` column (weighted average) and prints console summary with per-dimension averages.

### Phase 5: Analyze and Report

1. **Cross-component comparison:** Compare `total_mark` across title, description, product-information
2. **Cross-language comparison:** Compare scores across languages (should be stable within ~2-3 points if prompts are language-agnostic)
3. **Model comparison:** If testing multiple models, compare their scores
4. **Findings document:** Write `$OUTPUT_DIR/findings.md` with:
   - Executive summary: Does the prompt change improve or degrade quality?
   - Summary table: Component × Language with total_mark
   - Key findings: What changed? Any regressions?
   - Recommendations: Deploy, iterate, or revert?

---

## Scripts Reference

| Script | Purpose | Key env vars |
|--------|---------|-------------|
| `sample.sql` | StarRocks query: top N activities by bookings | (none — manual SQL) |
| `fetch-details.js` | Fetch activity content via gRPC `activityDetailSeo` | `OUTPUT_DIR` (required), `IDS_FILE` (default: sample-ids.txt), `GRPC_HOST` (default: production), `FETCH_CONCURRENCY` (default: 10) |
| `generate.js` | Construct prompts + call GenAI Gateway | `OUTPUT_DIR` (required), `ASSISTANT_ID` (slug, or `SYSTEM_PROMPT_FILE`), `COMPONENT` (comma-sep, default: all), `LANGUAGE_IDS` (comma-sep, default: 1), `GEN_MODEL` (default: gemini-2.5-flash), `GEN_TEMPERATURE` (default: 0.5), `GEN_MAX_TOKENS` (default: 8000), `GEN_CONCURRENCY` (default: 3), `OPENAI_BASE_URL` |
| `score.js` | Evaluate content quality (comparison or absolute) | `OUTPUT_DIR` (required), `SCORE_MODE` (comparison/absolute, default: comparison), `SCORE_MODEL` (default: gemini-3.1-pro-preview), `SCORE_CONCURRENCY` (default: 5), `OPENAI_BASE_URL` |
| `aggregate.js` | Calculate weighted total_mark and summary stats | `OUTPUT_DIR` (required), `WEIGHTS` (JSON, optional) |

### CLI Usage

All scripts support CLI args for targeted runs:
- `score.js [component] [lang_id]` — score specific component × language
- `aggregate.js [component] [lang_id]` — aggregate specific component × language
- If no args: process all files in `OUTPUT_DIR`

---

## Configuration Examples

### Example 1: Test a New System Prompt (Quick Eval)

```bash
export OUTPUT_DIR=prompt-quality-eval/test-prompt-v4
mkdir -p $OUTPUT_DIR

# 1. Sample 50 activities (edit sample.sql LIMIT to 50)
# 2. Export to $OUTPUT_DIR/sample-ids.txt
# 3. Fetch details
node "$SKILL_DIR/fetch-details.js"

# 4. Generate with custom system prompt
export SYSTEM_PROMPT_FILE=my-new-prompt.txt
export COMPONENT=product-information  # Test only one component for speed
node "$SKILL_DIR/generate.js"

# 5. Score in comparison mode
export SCORE_MODE=comparison
node "$SKILL_DIR/score.js"

# 6. Aggregate
node "$SKILL_DIR/aggregate.js"

# 7. Compare with baseline (previous run)
# If baseline avg was 82.5 and new prompt is 85.2 → improvement!
```

### Example 2: Compare Two Generation Models

Run the pipeline twice with different `GEN_MODEL`:

```bash
# Run 1: gemini-2.5-flash (baseline)
export OUTPUT_DIR=prompt-quality-eval/model-flash
export GEN_MODEL=gemini-2.5-flash
# ... run fetch → generate → score → aggregate

# Run 2: gemini-3.1-pro (candidate)
export OUTPUT_DIR=prompt-quality-eval/model-pro
export GEN_MODEL=gemini-3.1-pro
# ... run fetch → generate → score → aggregate

# Compare summary CSVs side-by-side
```

### Example 3: Full Multi-Language Benchmark

```bash
export OUTPUT_DIR=prompt-quality-eval/baseline-v2
export LANGUAGE_IDS=1,6,22,26  # EN, JP, TH, ID
export COMPONENT=title,description,product-information  # All components

# Run full pipeline with 200 activities
# ... fetch → generate → score → aggregate

# Produces 12 summary CSVs (3 components × 4 languages)
# Check cross-language stability (should be within ±2-3 points)
```

---

## Output Directory Structure

```
prompt-quality-eval/<run-name>/
  sample-ids.txt                    # Activity IDs (one per line)
  activity-details.jsonl            # gRPC response (one JSON per line)
  generated-title-1.csv             # Generated content (EN)
  generated-description-1.csv
  generated-product-information-1.csv
  generated-title-6.csv             # Japanese
  scored-title-1.csv                # Scored (EN)
  scored-description-1.csv
  scored-product-information-1.csv
  summary-title-1.csv               # Aggregated (EN, with total_mark)
  summary-description-1.csv
  summary-product-information-1.csv
  findings.md                       # Analysis and recommendations (manual)
```

---

## Data Flow

```
StarRocks SQL (sample.sql)
  → sample-ids.txt

gRPC activityDetailSeo (fetch-details.js)
  → activity-details.jsonl

activity-details.jsonl + GPT Assistants API (generate.js)
  → generated-*.csv

generated-*.csv + GenAI Gateway scoring (score.js)
  → scored-*.csv

scored-*.csv + weighted aggregation (aggregate.js)
  → summary-*.csv
```

---

## Key Implementation Details

### Field Filtering

`generate.js` mirrors `ActivityContentReadInjector.scala:67-95` field filtering:
- **title:** `activityInfo.title` only
- **description:** `activityInfo.title`, `activityInfo.description`, `supplierInfo.providerName`
- **product-information:** title, description, providerName, + `additionalInfoList`, `imageList`, `inclusionRefs`, `exclusionRefs`, `itineraryRef`, `genericSection`

Filtered output uses gRPC field names as keys (e.g., `{"activityInfo.title":"...", "genericSection":[...]}`), exactly matching production.

### User Prompt Template

From `ActivityProductAssistantSync.yaml:42-50`:

```xml
<Input>
<parameters>
<details><![CDATA[{filtered_details_json}]]></details>
<metadata><![CDATA[{detailsMetadata_json}]]></metadata>
<language><![CDATA[{language_name}]]></language>
</parameters>
</Input>
```

### System Prompt Source

- **GPT Assistants API:** `GET https://gpt-assistants-api-prod.privatecloud.sg.agoda.is/v1/assistants/slug/{ASSISTANT_ID}` → extracts `assistant_definition.system_message`
- **File override:** Set `SYSTEM_PROMPT_FILE` to test prompt changes before deploying to the API

### Resume Support

All scripts support resume (skip already-processed items):
- `fetch-details.js`: reads existing JSONL, skips fetched IDs
- `generate.js`: reads existing generated CSVs, skips generated keys
- `score.js`: reads existing scored CSVs, skips scored IDs

Safe to ctrl+C and re-run.

---

## Dependencies

- `openai` npm package (already used by content-quality-compare): `npm install --no-save openai`
- `grpcurl` CLI: `brew install grpcurl`
- Node.js 18+ (for built-in `fetch`)
- StarRocks access for `sample.sql`
- Network access to:
  - `activity-contentread-production.privatecloud.hk.agoda.is:80` (gRPC)
  - `gpt-assistants-api-prod.privatecloud.sg.agoda.is` (HTTP)
  - `genai-gateway.agoda.is` (HTTP)

---

## Troubleshooting

### grpcurl: command not found
```bash
brew install grpcurl
```

### grpcurl: failed to resolve service
Check VPN connection. The gRPC endpoint is internal-only.

### GenAI Gateway 429 (rate limit)
Reduce `GEN_CONCURRENCY` (default: 3). The script has exponential backoff but lowering concurrency helps.

### Scoring takes too long
- Reduce sample size (use 50-100 activities for quick tests)
- Increase `SCORE_CONCURRENCY` (default: 5, try 10)
- Use `absolute` mode if you don't need comparison (slightly faster, simpler prompt)

### Low scores (<60)
- Check `generation_error` column in generated CSV — generation may have failed
- Inspect `details_filtered` and `enhanced_content` columns — verify content makes sense
- Run with `SCORE_MODE=absolute` to see if comparison mode is penalizing unfairly

### Generated content is empty
- Check `generation_error` column
- Verify `ASSISTANT_ID` is correct or `SYSTEM_PROMPT_FILE` exists
- Increase `GEN_MAX_TOKENS` if content is being truncated

---

## Comparison to content-quality-compare

| Aspect | content-quality-compare | prompt-quality-eval |
|--------|------------------------|---------------------|
| **Use case** | Post-deployment A/B experiment evaluation | Pre-deployment prompt testing |
| **Data source** | Activity Search GraphQL (deployed content) | gRPC activityDetailSeo (raw content) |
| **Content** | Compares A-side (control) vs B-side (experiment) from live site | Compares original details vs freshly-generated content |
| **Generation** | No generation (evaluates already-deployed content) | Generates content via GenAI Gateway |
| **Scoring** | Always comparison mode (A vs B) | Dual mode: comparison or absolute |
| **Prompt control** | N/A (content already generated) | Full control: test system prompts before deploy |

---

## Best Practices

1. **Baseline first:** Run a baseline eval with current production settings before testing changes
2. **Small sample for iteration:** Use 50-100 activities for quick prompt iteration, 200+ for final validation
3. **Cross-language check:** Always test at least 2-3 languages to confirm prompt changes don't break non-English
4. **Comparison mode for regression testing:** Use `comparison` mode to detect if new prompts degrade quality
5. **Absolute mode for new features:** Use `absolute` mode when adding new content types not present in original details
6. **Version control your prompts:** Save tested prompts to files, commit to repo, reference in findings.md
