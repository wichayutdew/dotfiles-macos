#!/usr/bin/env bash
# Check prerequisites for feature sign-off workflow
# Usage: ./check-prerequisites.sh <jira_id>

set -euo pipefail

# Derive SKILL_ROOT from script location
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

JIRA_ID="${1:-}"

if [[ -z "${JIRA_ID}" ]]; then
  echo "Usage: $0 <jira_id>"
  exit 1
fi

OUTPUT_DIR=".sdd/output/signoff/${JIRA_ID}"

# Check document exists
if [[ ! -f "${OUTPUT_DIR}/signoff.md" ]]; then
  echo "❌ Document not found: ${OUTPUT_DIR}/signoff.md"
  echo "   Run: dev-feature-signoff generate ${JIRA_ID}"
  exit 1
fi

# Check screenshots exist (excluding test files)
if [[ ! -d "${OUTPUT_DIR}/media" ]]; then
  echo "⚠️  Media directory not found: ${OUTPUT_DIR}/media/"
  echo "   Run: dev-feature-signoff capture screenshots"
  exit 1
fi

SCREENSHOT_COUNT=$(find "${OUTPUT_DIR}/media" -type f -name "*.png" ! -name "*test*" 2>/dev/null | wc -l | tr -d ' ')
if [[ ${SCREENSHOT_COUNT} -eq 0 ]]; then
  echo "⚠️  No screenshots found in ${OUTPUT_DIR}/media/"
  echo "   Run: dev-feature-signoff capture screenshots"
  exit 1
fi

# Check Python availability
if ! command -v python3 &>/dev/null; then
  echo "❌ python3 not found"
  echo "   Install Python 3.8 or higher"
  exit 1
fi

# Check Python dependencies (DO NOT auto-install)
if ! python3 -c "import requests, yaml" 2>/dev/null; then
  echo "❌ Python dependencies missing"
  echo "   Run: pip install -r ${SKILL_ROOT}/scripts/requirements.txt"
  exit 1
fi

echo "✅ All prerequisites met"
echo "   Document: ${OUTPUT_DIR}/signoff.md"
echo "   Screenshots: ${SCREENSHOT_COUNT} files"
exit 0
