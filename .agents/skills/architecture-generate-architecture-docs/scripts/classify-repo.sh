#!/usr/bin/env bash
# Classify a repository's documentation readiness
# Returns JSON with classification: "generated", "has_docs", or "no_docs"

set -euo pipefail

readonly CLASSIFICATION_GENERATED="generated"
readonly CLASSIFICATION_HAS_DOCS="has_docs"
readonly CLASSIFICATION_NO_DOCS="no_docs"

REPO_PATH="${1:-.}"

cd "$REPO_PATH"

HAS_EVENT_CATALOG=false
HAS_API_CONTRACTS=false
HAS_SYSTEM_MAP=false
HAS_COMPLETE_OVERLAY=false

if [[ -f "overlay/event-catalog.md" ]] && \
   [[ -f "overlay/api-contracts.md" ]] && \
   [[ -f "overlay/system-map.md" ]]; then
  HAS_COMPLETE_OVERLAY=true
  HAS_EVENT_CATALOG=true
  HAS_API_CONTRACTS=true
  HAS_SYSTEM_MAP=true
else
  [[ -f "overlay/event-catalog.md" ]] && HAS_EVENT_CATALOG=true
  [[ -f "overlay/api-contracts.md" ]] && HAS_API_CONTRACTS=true
  [[ -f "overlay/system-map.md" ]] && HAS_SYSTEM_MAP=true
fi

HAS_CLAUDE_MD=false
HAS_AGENTS_MD=false
HAS_ARCHITECTURE_DIR=false
HAS_ADRS=false

[[ -f "CLAUDE.md" ]] && HAS_CLAUDE_MD=true
[[ -f "AGENTS.md" ]] && HAS_AGENTS_MD=true

# Check for markdown files using bash globs (consolidate nullglob usage)
shopt -s nullglob

if [[ -d "architecture" ]]; then
  arch_files=(architecture/*.md)
  [[ ${#arch_files[@]} -gt 0 ]] && HAS_ARCHITECTURE_DIR=true
fi

for adr_dir in docs/adr docs/architecture adr; do
  [[ ! -d "$adr_dir" ]] && continue
  adr_files=("$adr_dir"/*.md)
  if [[ ${#adr_files[@]} -gt 0 ]]; then
    HAS_ADRS=true
    break
  fi
done

shopt -u nullglob

CLASSIFICATION="$CLASSIFICATION_NO_DOCS"
REASON=""
DOC_PATHS=()

if $HAS_COMPLETE_OVERLAY; then
  CLASSIFICATION="$CLASSIFICATION_GENERATED"
  REASON="Has all three overlay files: event-catalog.md, api-contracts.md, system-map.md"
  DOC_PATHS+=("overlay/event-catalog.md" "overlay/api-contracts.md" "overlay/system-map.md")
elif $HAS_CLAUDE_MD || $HAS_AGENTS_MD || $HAS_ARCHITECTURE_DIR || $HAS_ADRS; then
  CLASSIFICATION="$CLASSIFICATION_HAS_DOCS"
  REASON="Has agentic documentation but missing complete overlay set"

  $HAS_CLAUDE_MD && DOC_PATHS+=("CLAUDE.md")
  $HAS_AGENTS_MD && DOC_PATHS+=("AGENTS.md")
  $HAS_ARCHITECTURE_DIR && DOC_PATHS+=("architecture/")
  $HAS_ADRS && DOC_PATHS+=("adr/")
else
  CLASSIFICATION="$CLASSIFICATION_NO_DOCS"
  REASON="No meaningful documentation detected"
fi

# Build JSON using jq for proper escaping and array handling
# Convert doc_paths array to JSON, handling empty array case
DOC_PATHS_JSON="[]"
if [[ ${#DOC_PATHS[@]} -gt 0 ]]; then
  DOC_PATHS_JSON=$(printf '%s\n' "${DOC_PATHS[@]}" | jq -Rs 'split("\n") | map(select(length > 0))')
fi

jq -n \
  --arg repo_path "$PWD" \
  --arg classification "$CLASSIFICATION" \
  --arg reason "$REASON" \
  --argjson has_complete_overlay "$HAS_COMPLETE_OVERLAY" \
  --argjson has_claude_md "$HAS_CLAUDE_MD" \
  --argjson has_agents_md "$HAS_AGENTS_MD" \
  --argjson has_architecture_dir "$HAS_ARCHITECTURE_DIR" \
  --argjson has_adrs "$HAS_ADRS" \
  --argjson has_event_catalog "$HAS_EVENT_CATALOG" \
  --argjson has_api_contracts "$HAS_API_CONTRACTS" \
  --argjson has_system_map "$HAS_SYSTEM_MAP" \
  --argjson doc_paths "$DOC_PATHS_JSON" \
  '{
    repo_path: $repo_path,
    classification: $classification,
    reason: $reason,
    has_complete_overlay: $has_complete_overlay,
    has_claude_md: $has_claude_md,
    has_agents_md: $has_agents_md,
    has_architecture_dir: $has_architecture_dir,
    has_adrs: $has_adrs,
    doc_paths: $doc_paths,
    overlay_files: {
      event_catalog: $has_event_catalog,
      api_contracts: $has_api_contracts,
      system_map: $has_system_map
    }
  }'
