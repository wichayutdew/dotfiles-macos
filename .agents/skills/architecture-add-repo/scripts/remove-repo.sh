#!/usr/bin/env bash
# Usage: remove-repo.sh <directory-name> [--remove-cache]
set -euo pipefail
exec python3 "$(dirname "${BASH_SOURCE[0]}")/repositories.py" remove "$@"
