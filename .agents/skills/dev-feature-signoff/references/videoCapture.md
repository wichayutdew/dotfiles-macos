# Video Capture with playwright-cli

Reference for generating video capture scripts using playwright-cli bash automation for test scenarios.

## Overview

Standardized pattern for generating bash scripts that use `playwright-cli` to record videos of test scenarios. Videos demonstrate user flows, interactions, and A/B variant behavior dynamically.

**Compatibility:** Bash 3.2 compatible (macOS default). Uses temp files instead of associative arrays.

## Prerequisites

- `playwright-cli`: `npm install -g @playwright/cli`
- Bash 3.2+ (macOS default)

## When to Use Videos vs Screenshots

**Videos:**
- Multi-step flows (booking, search → filter → detail)
- Interactive features (forms, animations, modals)
- Dynamic content (carousels, lazy loading)
- A/B variant behavior differences

**Screenshots:**
- Static visual regression
- Quick A/B layout checks
- Simple sanity testing

## Critical Concept: Per-Scenario Element Mapping

**⚠️ IMPORTANT:** Element references (e5, e12, etc.) are **NOT stable** across:
- Different pages/URLs
- Different executions
- Page reloads

**Example:**
```bash
# Page A: e5 = "Book Now"
# Page B: e7 = "Book Now"  ← DIFFERENT REFERENCE!
```

**Solution:** Capture fresh snapshot and rebuild element map **per scenario at runtime**.

## playwright-cli Video Commands

### Basic Usage

```bash
# Start recording
playwright-cli video-start media/videos/my-recording.webm

# Navigate and interact
playwright-cli goto "https://example.com"
playwright-cli click e5
playwright-cli fill e7 "test"

# Stop recording
playwright-cli video-stop
```

**Key Points:**
- Filename provided to `video-start` (not `video-stop`)
- `video-stop` takes NO arguments
- Output format: `.webm` (widely supported)
- Browser must stay open during recording

## Script Structure Essentials

### Header
```bash
#!/bin/bash
set -e
cd "$(dirname "$0")/.."
mkdir -p media/videos
```

### Command Line Arguments
```bash
# Parse arguments
TEST_ONLY=false
SCENARIO_NUM=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --test-only) TEST_ONLY=true; shift ;;
    --scenario) SCENARIO_NUM="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done
```

### Scenario Data
```bash
declare -a SCENARIOS=(
  "1|Scenario Name|{url}|Click book button|Select date|Add to cart"
)
```

Format: `"{id}|{name}|{url}|{step1}|{step2}|..."`

### Helper Functions (Bash 3.2 Compatible)

```bash
# Fuzzy match (returns score 0-100)
fuzzy_match() {
  local action=$(echo "$1" | tr '[:upper:]' '[:lower:]')
  local element_name=$(echo "$2" | tr '[:upper:]' '[:lower:]')
  
  if [[ "$element_name" == *"$action"* ]]; then
    echo 100; return
  fi
  
  local score=0
  for word in $action; do
    [[ "$element_name" == *"$word"* ]] && ((score += 30))
  done
  echo $score
}

# Build element map file from snapshot
build_element_map() {
  local snapshot_file="$1"
  local steps="$2"
  
  rm -f .playwright-cli/element_map.txt
  local temp_elements=$(mktemp)
  
  grep -E "^\s+- ref:|^\s+role:|^\s+name:" "$snapshot_file" | \
    awk '/ref:/ {ref=$3} /role:/ {role=$3} 
         /name:/ {name=$0; sub(/.*name:\s*"?/, "", name); sub(/"?\s*$/, "", name);
                  if (role ~ /button|link|textbox|combobox/) print ref "|" role "|" name}' > "$temp_elements"
  
  IFS='|' read -ra STEP_ARRAY <<< "$steps"
  for step in "${STEP_ARRAY[@]}"; do
    local best_ref="" best_score=0
    while IFS='|' read -r ref role name; do
      local score=$(fuzzy_match "$step" "$name")
      [ $score -gt $best_score ] && best_score=$score && best_ref=$ref
    done < "$temp_elements"
    [ -n "$best_ref" ] && echo "${step}|||${best_ref}" >> .playwright-cli/element_map.txt
  done
  rm "$temp_elements"
}

# Get element reference from map
get_element_ref() {
  grep -F "${1}|||" .playwright-cli/element_map.txt 2>/dev/null | cut -d'|' -f4
}

# Execute step
execute_step() {
  local step="$1"
  local element_ref=$(get_element_ref "$step")
  
  if [ -n "$element_ref" ]; then
    if [[ "$step" =~ [Cc]lick ]]; then
      playwright-cli click "$element_ref"
    elif [[ "$step" =~ [Ee]nter|[Ff]ill ]]; then
      playwright-cli fill "$element_ref" "test input"
    else
      playwright-cli click "$element_ref"
    fi
  fi
  sleep 1
}
```

### Recording Loop

```bash
playwright-cli open

for i in "${!SCENARIOS[@]}"; do
  IFS='|' read -r ID NAME URL STEPS <<< "${SCENARIOS[$i]}"
  
  VIDEO_FILE="media/videos/scenario_${ID}_${NAME}.webm"
  
  # Navigate FIRST
  playwright-cli goto "$URL"
  sleep 3
  
  # Capture snapshot for THIS scenario
  SNAPSHOT_FILE=".playwright-cli/scenario_${ID}_snapshot.yaml"
  playwright-cli snapshot --filename="$SNAPSHOT_FILE"
  
  # Build element map for THIS scenario
  build_element_map "$SNAPSHOT_FILE" "$STEPS"
  
  # Record
  playwright-cli video-start "$VIDEO_FILE"
  
  IFS='|' read -ra STEP_ARRAY <<< "$STEPS"
  for STEP in "${STEP_ARRAY[@]}"; do
    execute_step "$STEP"
  done
  
  playwright-cli video-stop
  
  # Clear map for next scenario
  rm -f .playwright-cli/element_map.txt
done

playwright-cli close
```

## Automated Element Discovery

**How it works:**
1. Navigate to scenario URL
2. Capture snapshot programmatically
3. Parse YAML to extract interactive elements
4. Fuzzy match action text to element names
5. Build element map with confidence scores
6. Execute steps using mapped elements

**Confidence Scores:**
- **90-100%**: High confidence - likely correct
- **70-89%**: Medium - review recommended
- **50-69%**: Low - verification required
- **< 50%**: Very low - may need fallback

**Test-first validation is MANDATORY.** Always run `--test-only` before batch.

## Usage Patterns

### Test-First Workflow (MANDATORY)
```bash
# Test with first scenario only
./capture-video.sh --test-only

# Review video, verify correct elements clicked
# If OK, run full batch
./capture-video.sh
```

### Single Scenario
```bash
./capture-video.sh --scenario 3
```

### File Naming
Format: `scenario_{id}_{name}.webm`
- `scenario_1_booking_flow_variant_a.webm`
- `scenario_2_booking_flow_variant_b.webm`

## Step Mapping Guide

| Document Step | Script Command | playwright-cli |
|---------------|----------------|----------------|
| Navigate to X | Start URL | `goto {url}` |
| Click button/link | `Click {target}` | `click {selector}` |
| Enter text | `Fill {field}` | `fill {selector} "{text}"` |
| Select option | `Select {option}` | `select {selector} "{value}"` |
| Scroll | `Scroll to {pos}` | `eval "window.scrollTo(...)"` |
| Wait | `Wait {N} seconds` | `sleep {N}` |

## Integration with Sign-off Workflow

### Output Structure
```
.sdd/output/signoff/{jira_id}/
├── signoff.md
├── scripts/
│   └── capture-video.sh
└── media/
    └── videos/
        ├── scenario_1_*.webm
        └── scenario_2_*.webm
```

### Document Updates
Add video evidence section to sign-off document:

```markdown
## 🎬 Video Evidence

| Scenario | Video | Duration | Status |
|----------|-------|----------|--------|
| Booking Flow - Variant A | [📹 Watch](media/videos/scenario_1_booking_flow_variant_a.webm) | 15s | ✅ Pass |
| Booking Flow - Variant B | [📹 Watch](media/videos/scenario_2_booking_flow_variant_b.webm) | 15s | ✅ Pass |
```

## Best Practices

✅ **DO:**
- Map elements per-scenario at runtime
- Navigate BEFORE capturing snapshot
- Use test-first workflow (--test-only)
- Open browser once, reuse for all recordings
- Keep recordings under 60 seconds
- Include both A/B variants

❌ **DON'T:**
- Reuse element maps across scenarios
- Hard-code element references globally
- Skip snapshot per scenario
- Skip test mode validation
- Record without wait periods
- Open/close browser per recording

## Troubleshooting

### Video Not Created
- Check filename provided to `video-start`
- Verify parent directory exists
- Confirm browser still open

### Element References Changed
- **Expected behavior** - refs change per page
- Verify snapshot captured for current scenario
- Check element_map.txt exists

### Wrong Element Clicked
- Increase wait time after navigation
- Check element visible on page
- Review snapshot: `cat .playwright-cli/scenario_X_snapshot.yaml`
- Improve action naming to match element labels

## Summary

Videos provide rich evidence of feature behavior. Key takeaways:

1. **Per-scenario mapping**: Element refs change per page - map at runtime
2. **Bash 3.2 compatible**: Uses temp files, not associative arrays
3. **Test-first mandatory**: Validate with `--test-only` before batch
4. **Automated discovery**: Fuzzy matching with confidence scores
5. **Integration ready**: Works with sign-off workflow

**Critical:** Always map elements per-scenario at runtime, never globally.
