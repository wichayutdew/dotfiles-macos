#!/usr/bin/env bash
# Check workspace structure and output JSON with workspace properties

set -euo pipefail

WORKSPACE_ROOT="${1:-.}"

cd "$WORKSPACE_ROOT"

# Initialize result object
HAS_REPOS_CONF=false
HAS_OVERLAY=false
OVERLAY_IS_SYMLINK=false
OVERLAY_TARGET=""

if [[ -f "repos.conf" ]]; then
  HAS_REPOS_CONF=true
fi

if [[ -e "overlay" ]]; then
  HAS_OVERLAY=true

  if [[ -L "overlay" ]]; then
    OVERLAY_IS_SYMLINK=true
    OVERLAY_TARGET=$(readlink "overlay" || echo "")
  fi
fi

# Output JSON (use jq for proper escaping)
jq -n \
  --arg workspace_root "$PWD" \
  --argjson has_repos_conf "$HAS_REPOS_CONF" \
  --argjson has_overlay "$HAS_OVERLAY" \
  --argjson overlay_is_symlink "$OVERLAY_IS_SYMLINK" \
  --arg overlay_target "$OVERLAY_TARGET" \
  --argjson is_spawned_workspace "$OVERLAY_IS_SYMLINK" \
  '{
    workspace_root: $workspace_root,
    has_repos_conf: $has_repos_conf,
    has_overlay: $has_overlay,
    overlay_is_symlink: $overlay_is_symlink,
    overlay_target: $overlay_target,
    is_spawned_workspace: $is_spawned_workspace
  }'
