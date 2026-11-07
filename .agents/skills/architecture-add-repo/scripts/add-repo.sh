#!/usr/bin/env bash
# Usage: add-repo.sh <git-url> [directory-name] [branch]
set -euo pipefail
exec python3 "$(dirname "${BASH_SOURCE[0]}")/repositories.py" add "$@"
