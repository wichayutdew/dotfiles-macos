# Screenshot Capture with playwright-cli

Reference for generating and executing screenshot capture scripts using playwright-cli bash automation.

## Overview

This reference provides a standardized pattern for generating bash scripts that use `playwright-cli` to capture screenshots for A/B testing and feature verification workflows.

## Prerequisites

- `playwright-cli` must be installed: `npm install -g @playwright/cli`
- Check availability: `which playwright-cli`

## Script Structure

### Header Template

```bash
#!/bin/bash
# Auto-generated screenshot capture script
# JIRA: {jira_id}
# Generated: {timestamp}

set -e  # Exit on error

# Change to signoff directory
cd "$(dirname "$0")/.."
mkdir -p media
```

### Command Line Arguments

Scripts should support test-first workflow:

```bash
# Parse command line arguments
TEST_ONLY=false
if [[ "$1" == "--test-only" ]]; then
  TEST_ONLY=true
fi
```

### Data Array Structure

Store activity/entity data as pipe-delimited strings:

```bash
# Activity data array
declare -a ACTIVITIES=(
  "{activity_id_1}|{city_id_1}|{url_A_1}|{url_B_1}"
  "{activity_id_2}|{city_id_2}|{url_A_2}|{url_B_2}"
  # ... one entry per activity
)

TOTAL_ACTIVITIES=${#ACTIVITIES[@]}
```

### Mode Selection Logic

```bash
if [ "$TEST_ONLY" = true ]; then
  echo "🧪 Test Mode: Capturing first activity only..."
  LIMIT=1
else
  echo "🚀 Batch Mode: Capturing all activities..."
  LIMIT=$TOTAL_ACTIVITIES
fi

echo "Activities: $LIMIT"
echo "Variants: A, B"
echo "Platform: Desktop (1920×1080)"
echo ""
```

### Browser Lifecycle

Open browser once and reuse for all captures:

```bash
# Open browser once (reuse for all captures)
playwright-cli open

# ... perform all captures ...

# Close browser at end
playwright-cli close
```

### Capture Loop with Progress Tracking

```bash
# Counter for progress
COUNT=0
SUCCESS=0
FAILED=0

# Loop through activities
for i in "${!ACTIVITIES[@]}"; do
  if [ $i -ge $LIMIT ]; then
    break
  fi
  
  IFS='|' read -r ACT_ID CITY_ID URL_A URL_B <<< "${ACTIVITIES[$i]}"
  COUNT=$((COUNT + 1))
  
  echo "[$COUNT/$LIMIT] Capturing Activity $ACT_ID..."
  
  # Variant A
  if playwright-cli goto "$URL_A" && \
     playwright-cli resize 1920 1080 && \
     sleep 5 && \
     playwright-cli screenshot --filename="media/${ACT_ID}_A_desktop.png"; then
    echo "  ✅ Variant A captured"
    SUCCESS=$((SUCCESS + 1))
  else
    echo "  ❌ Variant A failed"
    FAILED=$((FAILED + 1))
  fi
  
  # Variant B
  if playwright-cli goto "$URL_B" && \
     playwright-cli resize 1920 1080 && \
     sleep 5 && \
     playwright-cli screenshot --filename="media/${ACT_ID}_B_desktop.png"; then
    echo "  ✅ Variant B captured"
    SUCCESS=$((SUCCESS + 1))
  else
    echo "  ❌ Variant B failed"
    FAILED=$((FAILED + 1))
  fi
  
  echo ""
done
```

### Summary Report

```bash
# Report summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Capture complete!"
echo "Success: $SUCCESS"
echo "Failed: $FAILED"
echo "Screenshots: media/"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

exit 0
```

## playwright-cli Command Reference

### Core Commands

| Command | Purpose | Example |
|---------|---------|---------|
| `playwright-cli open` | Open browser instance | Opens Chromium browser |
| `playwright-cli close` | Close browser | Cleanup after captures |
| `playwright-cli goto <url>` | Navigate to URL | `playwright-cli goto "https://example.com"` |
| `playwright-cli resize <w> <h>` | Set viewport size | `playwright-cli resize 1920 1080` |
| `playwright-cli screenshot --filename=<path>` | Capture screenshot | `playwright-cli screenshot --filename="media/test.png"` |
| `playwright-cli click <selector>` | Click element | `playwright-cli click "button.submit"` |
| `playwright-cli fill <selector> "<value>"` | Fill form field | `playwright-cli fill "input[name=email]" "test@example.com"` |
| `playwright-cli press <key>` | Press keyboard key | `playwright-cli press "Enter"` |
| `playwright-cli eval "<js>"` | Execute JavaScript | `playwright-cli eval "window.scrollTo(0, 500)"` |

### Common Wait Patterns

Use `sleep` for page load timing:

```bash
# Wait for page load before screenshot
playwright-cli goto "$URL"
sleep 5  # Adjust based on page complexity
playwright-cli screenshot --filename="output.png"
```

### Screenshot Naming Convention

Format: `{entity_id}_{variant}_{platform}.png`

Examples:
- `1252815_A_desktop.png` - Activity 1252815, Variant A, Desktop
- `1252815_B_desktop.png` - Activity 1252815, Variant B, Desktop
- `9876543_A_mobile.png` - Activity 9876543, Variant A, Mobile

## Complete Example Script

```bash
#!/bin/bash
# Auto-generated screenshot capture script
# JIRA: ACTD-370
# Generated: 2026-06-26 14:30:00

set -e  # Exit on error

# Change to signoff directory
cd "$(dirname "$0")/.."
mkdir -p media

# Parse command line arguments
TEST_ONLY=false
if [[ "$1" == "--test-only" ]]; then
  TEST_ONLY=true
fi

# Activity data array
declare -a ACTIVITIES=(
  "1252815|2656|https://hkg.agoda.com/activities/detail?activityId=1252815&cityId=2656&explist=ACTD-370=A|https://hkg.agoda.com/activities/detail?activityId=1252815&cityId=2656&explist=ACTD-370=B"
  "9876543|3952|https://hkg.agoda.com/activities/detail?activityId=9876543&cityId=3952&explist=ACTD-370=A|https://hkg.agoda.com/activities/detail?activityId=9876543&cityId=3952&explist=ACTD-370=B"
)

TOTAL_ACTIVITIES=${#ACTIVITIES[@]}

if [ "$TEST_ONLY" = true ]; then
  echo "🧪 Test Mode: Capturing first activity only..."
  LIMIT=1
else
  echo "🚀 Batch Mode: Capturing all activities..."
  LIMIT=$TOTAL_ACTIVITIES
fi

echo "Activities: $LIMIT"
echo "Variants: A, B"
echo "Platform: Desktop (1920×1080)"
echo ""

# Open browser once (reuse for all captures)
playwright-cli open

# Counter for progress
COUNT=0
SUCCESS=0
FAILED=0

# Loop through activities
for i in "${!ACTIVITIES[@]}"; do
  if [ $i -ge $LIMIT ]; then
    break
  fi
  
  IFS='|' read -r ACT_ID CITY_ID URL_A URL_B <<< "${ACTIVITIES[$i]}"
  COUNT=$((COUNT + 1))
  
  echo "[$COUNT/$LIMIT] Capturing Activity $ACT_ID..."
  
  # Variant A
  if playwright-cli goto "$URL_A" && \
     playwright-cli resize 1920 1080 && \
     sleep 5 && \
     playwright-cli screenshot --filename="media/${ACT_ID}_A_desktop.png"; then
    echo "  ✅ Variant A captured"
    SUCCESS=$((SUCCESS + 1))
  else
    echo "  ❌ Variant A failed"
    FAILED=$((FAILED + 1))
  fi
  
  # Variant B
  if playwright-cli goto "$URL_B" && \
     playwright-cli resize 1920 1080 && \
     sleep 5 && \
     playwright-cli screenshot --filename="media/${ACT_ID}_B_desktop.png"; then
    echo "  ✅ Variant B captured"
    SUCCESS=$((SUCCESS + 1))
  else
    echo "  ❌ Variant B failed"
    FAILED=$((FAILED + 1))
  fi
  
  echo ""
done

# Close browser
playwright-cli close

# Report summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Capture complete!"
echo "Success: $SUCCESS"
echo "Failed: $FAILED"
echo "Screenshots: media/"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

exit 0
```

## Usage Patterns

### Test-First Workflow

Always run test mode before full batch:

```bash
# 1. Test with first activity
./capture.sh --test-only

# 2. Review test screenshots in media/

# 3. Run full batch if test passes
./capture.sh
```

### Error Handling

Script exits on first error (`set -e`) but tracks success/failure per screenshot. This ensures:
- Browser failures stop execution immediately
- Individual screenshot failures are counted but don't stop the batch
- Final summary shows success rate

### File Permissions

Make script executable after generation:

```bash
chmod +x scripts/capture.sh
```

## Integration Points

### Data Source

Activity/entity data typically comes from:
1. Sign-off document sanity testing table
2. JIRA ticket metadata
3. Manual user input during workflow

### Output Location

Standard directory structure:
```
.sdd/output/signoff/{jira_id}/
├── scripts/
│   └── capture.sh      # Generated script
└── media/              # Screenshot output
    ├── {id}_A_desktop.png
    └── {id}_B_desktop.png
```

### Document Updates

After capture, update sign-off document:
- Mark checkboxes in sanity testing table
- Add screenshot links in Remarks column
- Update evidence tracking sections

## Best Practices

✅ **DO:**
- Open browser once, reuse for all captures
- Use test-first workflow (--test-only)
- Track success/failure counts
- Use consistent naming conventions
- Add sleep after navigation for page load
- Parse data arrays in bash loop

❌ **DON'T:**
- Open/close browser per screenshot (slow)
- Skip test mode
- Hardcode URLs (use data array)
- Execute playwright-cli commands manually in workflow
- Run captures in background without progress tracking
- Use TypeScript/Node.js for simple capture scripts

## Chrome Recorder Conversion

For converting Chrome DevTools Recorder JSON to playwright-cli commands, see `chrome-recorder-spec.md`.

Common conversions:
- `navigate` → `playwright-cli goto {url}`
- `click` → `playwright-cli click {selector}`
- `change` → `playwright-cli fill {selector} "{value}"`
- `scroll` → `playwright-cli eval "window.scrollTo({x}, {y})"`
- `keyDown`/`keyUp` → `playwright-cli press {key}`
