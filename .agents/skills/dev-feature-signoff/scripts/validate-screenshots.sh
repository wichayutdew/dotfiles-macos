#!/usr/bin/env bash
# Validate screenshots in media directory
# Usage: ./validate-screenshots.sh <media_dir>

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <media_dir>"
  echo "Example: $0 .sdd/output/signoff/ACTD-123/media"
  exit 1
fi

MEDIA_DIR="${1}"

if [[ ! -d "${MEDIA_DIR}" ]]; then
  echo "❌ Media directory not found: ${MEDIA_DIR}"
  exit 1
fi

# Count screenshots (excluding test files)
SCREENSHOT_COUNT=$(find "${MEDIA_DIR}" -type f \( -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" \) ! -name "*test*" 2>/dev/null | wc -l | tr -d ' ')

if [[ ${SCREENSHOT_COUNT} -eq 0 ]]; then
  echo "❌ No valid screenshots found in ${MEDIA_DIR}"
  echo "   Expected: PNG, JPG, or JPEG files (excluding *test* files)"
  exit 1
fi

# List files
echo "✅ Found ${SCREENSHOT_COUNT} screenshots:"
find "${MEDIA_DIR}" -type f \( -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" \) ! -name "*test*" -exec basename {} \; | sort

exit 0
