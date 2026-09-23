---
name: act-mkt-sample-activities-offers
description: Sample activity IDs and offer IDs from booking data using configurable strategies (top bookings, stratified by geography or category). Outputs CSV with metadata for consumption by testing and quality assurance workflows. Use this skill when the user asks to sample activities for testing, get top booked activities, generate test data for MSE sanity checks or content quality validation, or needs a representative set of activity/offer IDs with booking metrics and metadata. Also use when the user wants to filter by customer nationality (e.g. "top activities booked by Koreans", "activities popular with Japanese travelers").
compatibility: Requires authenticated Superset access to the Agoda StarRocks booking datasets.
---

# Sample Activities & Offers

Generate representative samples of activity IDs and offer IDs from production booking data. Supports multiple sampling strategies and flexible filtering to produce input datasets for testing workflows like MSE sanity checks and content quality validation.

SQL templates live in `queries.sql`. Copy the relevant template, replace placeholders like `{days}`, `{sample_size}`, and `{nationality_filter}`, then run that query against StarRocks via Superset MCP.

## When to Use This Skill

- User asks for "sample activity IDs" or "get me some activities to test"
- Preparing input for `act-mkt-mse-sanity-check` (needs activity_id + offer_id + city_id)
- Preparing input for `act-mkt-content-quality-compare` (needs activity_id list)
- Need top-booked activities for impact analysis
- Want stratified samples by geography or category to ensure coverage

## Sampling Strategies

### 1. Top Bookings (Default)

Most frequently booked activities over a time window. Best for:
- High-impact testing (changes affect the most users)
- Quick smoke tests before larger rollouts
- Performance testing with real-world traffic patterns

Use `queries.sql`:
- `top_bookings_activity_only`
- `top_bookings_activity_offer`

### 2. Stratified by Geography

Proportional sampling matching the population distribution by country or city. Best for:
- Content quality checks across markets
- Ensuring feature works in all supported geographies
- Avoiding bias toward high-traffic markets

**Two-step process:**
1. Query population distribution
2. Sample proportionally from each segment

Use `queries.sql`:
- `geography_distribution`
- `stratified_geography_activity_only`
- `stratified_geography_activity_offer`

Repeat for each country, then union the results.

### 3. Stratified by Category

Proportional sampling by activity category (tours, attractions, transportation, etc.). Best for:
- Validating category-specific features
- Ensuring GPT content quality across different activity types
- Testing taxonomy-dependent logic

Same two-step process as geography, grouping by `dc.activity_category_name` instead. Use these `queries.sql` templates:
- `category_distribution`
- `stratified_category_activity_only`
- `stratified_category_activity_offer`

## Output Modes

### Activity IDs Only

For workflows that only need activity IDs (e.g., content quality checks):

**CSV columns:**
```
activity_id,city_id,country_id,booking_count,country_name,city_name,category_name
```

### Activity + Offer Pairs

For workflows that need specific activity-offer combinations (e.g., MSE sanity checks):

**CSV columns:**
```
activity_id,offer_id,city_id,country_id,booking_count,country_name,city_name,category_name
```

## Workflow

### Step 1: Understand Requirements

Ask the user:
1. **What sampling strategy?** (top bookings / stratified by geography / stratified by category)
2. **Sample size?** (e.g., 10, 50, 100, 500)
3. **Activity location filter?** (all countries, specific country, specific city — filters *where the activity is*)
4. **Customer nationality filter?** (e.g. "booked by Koreans" — filters *who booked*, independent of activity location)
5. **Output mode?** (activity IDs only / activity+offer pairs)
6. **Time window for booking data?** (default: last 90 days for top bookings)

If the user mentions a downstream tool (e.g., "for MSE sanity check"), infer the output mode:
- MSE sanity check → activity+offer pairs
- Content quality compare → activity IDs only

### Step 2: Build the Query

Start from the matching template in `queries.sql`. For stratified sampling, run the distribution query first, calculate proportional sample sizes, then run the per-segment query at the correct granularity:

- Activity IDs only: sample at `activity_id` granularity
- Activity+offer pairs: sample at `(activity_id, offer_id)` granularity

**Default parameters if not specified:**
- Strategy: Top bookings
- Sample size: 100
- Activity location: All countries (no filter)
- Customer nationality: All (no filter)
- Mode: Activity IDs only
- Time window: 90 days

**Activity location filter patterns** (filters where the activity takes place):
- Country: `AND d.country_name = 'Thailand'`
- City: `AND d.city_name = 'Bangkok'`
- Multiple countries: `AND d.country_name IN ('Thailand', 'Japan', 'Indonesia')`

**Customer nationality filter** (filters who booked — independent of activity location):
- Single nationality: `AND f.customer_nationality = 'South Korea'`
- Multiple: `AND f.customer_nationality IN ('South Korea', 'Japan')`
- Known values include: `'South Korea'`, `'Japan'`, `'Thailand'`, `'Philippines'`, `'Malaysia'`, `'Taiwan'`, `'Australia'`, `'Vietnam'`, `'Indonesia'`, `'Singapore'`, `'China'`, `'United States of America'`, etc.
- Note: `customer_nationality` is distinct from `origin_country_name`. Use `customer_nationality` — it has better coverage.

### Step 3: Execute and Save

Run the query via **Superset MCP** (`query_dataset` tool, connection_id 393, format `csv`). This is the preferred execution method — no shell credentials needed.

Fallback (direct StarRocks connection):
```bash
mysql --batch --raw -h <starrocks-host> -u <user> -p<password> < query.sql \
  | python3 -c 'import csv,sys; w=csv.writer(sys.stdout); [w.writerow(line.rstrip("\n").split("\t")) for line in sys.stdin]' \
  > results.csv
```

Save to an appropriate location:
- If preparing for another skill: save to that skill's expected input location
- Otherwise: save to workspace root as `sample-activities-{timestamp}.csv`

### Step 4: Summary Report

Print a summary table showing:
- Total activities/offers sampled
- Breakdown by country (top 5)
- Breakdown by category (top 5)
- Date range of booking data
- Output file path

## Integration with Other Skills

### For MSE Sanity Check

Output activity, offer, and city in CSV format. `act-mkt-mse-sanity-check` derives `cid` and `label` when they are omitted, so this minimal handoff is enough:
```csv
activity_id,offer_id,city_id
```

You can produce this handoff by selecting the first three columns from your full CSV:
```bash
awk -F, 'NR==1 {print "activity_id,offer_id,city_id"; next} {print $1","$2","$3}' full-sample.csv > mse-input.csv
```

### For Content Quality Compare

If you sampled in activity-only mode, export the first column directly. Save as `sample-ids.txt` (one ID per line):
```bash
awk -F, 'NR>1 {print $1}' sample-activities.csv > sample-ids.txt
```

If you only have an activity+offer CSV, deduplicate by `activity_id` so repeated offers do not shrink the effective sample:
```bash
awk -F, 'NR>1 && !seen[$1]++ {print $1}' sample-activities.csv > sample-ids.txt
```

## Common Patterns

### Quick smoke test (top 10 activities)

```
Sample top 10 booked activities from Thailand in the last 30 days
```

Expected behavior:
- Strategy: Top bookings
- Sample size: 10
- Geography: Thailand
- Time window: 30 days
- Mode: Activity IDs only

### Representative sample for content quality

```
Get me 200 activities stratified by country for content quality testing
```

Expected behavior:
- Strategy: Stratified by geography (country)
- Sample size: 200
- Geography: All countries
- Mode: Activity IDs only

### MSE test data

```
Sample 50 activity-offer pairs for MSE sanity check, focus on Indonesia
```

Expected behavior:
- Strategy: Top bookings (implied by "MSE sanity check")
- Sample size: 50
- Geography: Indonesia
- Mode: Activity+offer pairs

## Notes

- **Servability filter:** Always include `d.activity_servable = 1 AND d.rec_status = 1` to exclude stale/unservable activities
- **Whitelabel:** Default to `f.whitelabel_id = 1` (Agoda.com) unless user specifies otherwise
- **Granularity matters:** Do not sample activity-only outputs from an `(activity_id, offer_id)` query and deduplicate afterward. Use the activity-only query templates directly.
- **Booking count:** Use as a tiebreaker for stratified sampling (higher booking count = more representative)
- **StarRocks connection:** Use Superset MCP (connection_id 393) as the default. Obtain credentials from the active workspace instructions or environment.
- **StarRocks interval syntax:** Use `DATE_SUB(CURRENT_DATE, INTERVAL 90 DAY)` — NOT `CURRENT_DATE - INTERVAL '90 days'` (causes parse error).
- **Category column:** Category lives directly on `bi_dw.dim_activity` as `activity_main_category_name`. There is no standalone `dim_activity_category` table — joining it will fail.
- **Customer nationality vs origin country:** `f.customer_nationality` has good coverage (e.g. `'South Korea'`). `f.origin_country_name` also works but `customer_nationality` is preferred for nationality-based filtering.
