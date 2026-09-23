# Sample Activities & Offers Skill

Sample activity IDs and offer IDs from production booking data for testing and quality assurance workflows.

## Overview

This skill provides multiple sampling strategies:
- **Top bookings** - Most frequently booked activities over a time window
- **Stratified by geography** - Proportional sampling by country/city
- **Stratified by category** - Proportional sampling by activity type

## Output

CSV with metadata:

- Activity-only mode: `activity_id, city_id, country_id, booking_count, country_name, city_name, category_name`
- Activity+offer mode: `activity_id, offer_id, city_id, country_id, booking_count, country_name, city_name, category_name`

Supports two modes:
- Activity IDs only (for content-quality-compare)
- Activity+offer pairs (for act-mkt-mse-sanity-check)

## Usage

See `SKILL.md` for complete documentation.

## Testing

### Local Testing

```bash
./test.sh
```

### CI Testing

Tests run automatically on GitLab CI when changes are pushed:
- Validates SKILL.md structure (frontmatter, required fields)
- Validates evals.json format and structure
- Checks for common issues (SQL injection patterns, etc.)

The CI pipeline is defined in the workspace root `.gitlab-ci.yml`.

## Test Cases

Three test cases in `evals/evals.json`:
1. **MSE Indonesia** - Sample 20 activity-offer pairs from Indonesia for MSE sanity checks
2. **SEA Stratified** - Sample 100 activities proportionally across Thailand, Vietnam, Indonesia, Philippines
3. **Japan Smoke Test** - Quick test of top 15 booked activities from Japan

## Development

When modifying the skill:
1. Update `SKILL.md` with changes
2. Update `queries.sql` if query templates change
3. Update test cases in `evals/evals.json` if needed
4. Run `./test.sh` locally to validate
5. Push to GitLab - CI will run automatically
6. Review CI results in the GitLab pipeline
