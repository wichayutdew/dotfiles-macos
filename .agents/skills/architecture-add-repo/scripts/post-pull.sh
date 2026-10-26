#!/bin/bash
# post-pull.sh — Post-pull extension point. Called by init.sh --pull.
#
# The legacy docgen/check-freshness workflow was removed. Keep this script as a
# stable hook point for future workspace checks without breaking init.sh.

set -euo pipefail

echo ""
echo "=== Post-pull checks ==="
echo "No post-pull checks are currently configured."
echo "=== Post-pull checks complete ==="
