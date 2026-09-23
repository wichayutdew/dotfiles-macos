#!/usr/bin/env bash
# Fetch B-side content for all locale/activity pairs from a CSV file.
#
# Usage:
#   EXP_ID=ACTB-2314 OUTPUT_DIR=/path/to/out CSV_FILE=/path/to/pairs.csv bash fetch-content-all-locales.sh
#
# The CSV must have columns: activity_id, servable_content_locale
# Each row's servable_content_locale is a comma-separated list of locales.
#
# Output:
#   OUTPUT_DIR/content-<locale>.csv   — per-locale results
#   OUTPUT_DIR/content-all.csv        — merged flat file

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FETCH_SCRIPT="$SCRIPT_DIR/fetch-content.js"

: "${EXP_ID:?EXP_ID env var required}"
: "${OUTPUT_DIR:?OUTPUT_DIR env var required}"
: "${CSV_FILE:?CSV_FILE env var required}"

EXP_VARIANT="${EXP_VARIANT:-B}"
NUM_WORKERS="${NUM_WORKERS:-4}"
TIMEOUT="${TIMEOUT:-45000}"
RENDER_WAIT="${RENDER_WAIT:-3000}"

OUTPUT_DIR="$(realpath "$OUTPUT_DIR")"
mkdir -p "$OUTPUT_DIR"

# Parse CSV → per-locale sample-ids.txt files
python3 - "$CSV_FILE" "$OUTPUT_DIR" <<'PYEOF'
import sys, csv, os, json

csv_file, out_dir = sys.argv[1], sys.argv[2]
locale_ids = {}

with open(csv_file) as f:
    reader = csv.DictReader(f)
    for row in reader:
        act_id = row['activity_id'].strip()
        for loc in row['servable_content_locale'].split(','):
            loc = loc.strip()
            if loc:
                locale_ids.setdefault(loc, [])
                if act_id not in locale_ids[loc]:
                    locale_ids[loc].append(act_id)

# Write per-locale id files
for loc, ids in locale_ids.items():
    loc_dir = os.path.join(out_dir, loc)
    os.makedirs(loc_dir, exist_ok=True)
    with open(os.path.join(loc_dir, 'sample-ids.txt'), 'w') as f:
        f.write('\n'.join(ids) + '\n')

# Write locale list
with open(os.path.join(out_dir, 'locales.txt'), 'w') as f:
    f.write('\n'.join(sorted(locale_ids.keys())) + '\n')

total = sum(len(v) for v in locale_ids.values())
print(f"Locales: {len(locale_ids)}, total pairs: {total}")
PYEOF

LOCALES=$(cat "$OUTPUT_DIR/locales.txt")

export EXP_ID EXP_VARIANT NUM_WORKERS TIMEOUT RENDER_WAIT

FAILED_LOCALES=()
for locale in $LOCALES; do
  echo "=== $locale ==="
  if ! OUTPUT_DIR="$OUTPUT_DIR/$locale" IDS_FILE="sample-ids.txt" \
       node "$FETCH_SCRIPT" "$locale"; then
    echo "ERROR: fetch-content.js failed for $locale (exit $?)" >&2
    FAILED_LOCALES+=("$locale")
  fi
done

if [[ ${#FAILED_LOCALES[@]} -gt 0 ]]; then
  echo "WARNING: ${#FAILED_LOCALES[@]} locale(s) failed: ${FAILED_LOCALES[*]}" >&2
fi

echo ""
echo "=== Merging results ==="
python3 - "$OUTPUT_DIR" "$OUTPUT_DIR/locales.txt" <<'PYEOF'
import sys, os, csv

out_dir, locales_file = sys.argv[1], sys.argv[2]
merged_path = os.path.join(out_dir, 'content-all.csv')
header_written = False
merged_rows = 0
missing = []
empty_content = []

expected_locales = open(locales_file).read().split()

with open(merged_path, 'w', newline='', encoding='utf-8') as outf:
    writer = csv.writer(outf)
    for locale in expected_locales:
        loc_csv = os.path.join(out_dir, locale, f'content-{locale}.csv')
        if not os.path.exists(loc_csv):
            missing.append(locale)
            print(f"  MISSING: {loc_csv}", file=sys.stderr)
            continue
        with open(loc_csv, encoding='utf-8') as inf:
            reader = csv.reader(inf)
            header = next(reader, None)
            if not header:
                missing.append(locale)
                print(f"  EMPTY CSV: {loc_csv}", file=sys.stderr)
                continue
            if not header_written:
                writer.writerow(header)
                header_written = True
            for row in reader:
                writer.writerow(row)
                merged_rows += 1
                # title is col 2, description col 3
                if len(row) >= 4 and not row[2].strip('"') and not row[3].strip('"'):
                    empty_content.append(f"{row[0]}@{row[1]}")

# Count expected pairs from per-locale id files
expected_pairs = 0
for locale in expected_locales:
    ids_file = os.path.join(out_dir, locale, 'sample-ids.txt')
    if os.path.exists(ids_file):
        expected_pairs += sum(1 for l in open(ids_file) if l.strip() and l.strip().isdigit())

print(f"Merged → {merged_path}")
print(f"Rows: {merged_rows} / expected {expected_pairs} pairs")
has_error = False
if missing:
    print(f"MISSING locales ({len(missing)}): {' '.join(missing)}", file=sys.stderr)
    has_error = True
if merged_rows < expected_pairs:
    print(f"ROW COUNT MISMATCH: got {merged_rows}, expected {expected_pairs}", file=sys.stderr)
    has_error = True
if empty_content:
    print(f"Empty title+description ({len(empty_content)} rows): {' '.join(empty_content[:20])}", file=sys.stderr)
    has_error = True
if has_error:
    sys.exit(1)
PYEOF

MERGE_EXIT=$?
if [[ $MERGE_EXIT -ne 0 ]]; then
  echo "WARNING: merge completed with data gaps (see above)" >&2
fi

if [[ ${#FAILED_LOCALES[@]} -gt 0 ]] || [[ $MERGE_EXIT -ne 0 ]]; then
  echo "Done with errors. Results in $OUTPUT_DIR/content-all.csv" >&2
  exit 1
fi

echo "Done. Results in $OUTPUT_DIR/content-all.csv"
