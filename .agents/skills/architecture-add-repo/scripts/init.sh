#!/usr/bin/env bash
# Usage: init.sh [--status|--pull] [--no-check]; bulk --clean is refused.
set -euo pipefail
exec python3 "$(dirname "${BASH_SOURCE[0]}")/repositories.py" init "$@"
