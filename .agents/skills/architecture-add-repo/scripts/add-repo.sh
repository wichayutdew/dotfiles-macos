#!/usr/bin/env bash
# Usage: add-repo.sh [--ssh] <git-url> [directory-name] [branch]
# GitLab SSH URLs default to HTTPS; --ssh explicitly preserves SSH.
set -euo pipefail
exec python3 "$(dirname "${BASH_SOURCE[0]}")/repositories.py" add "$@"
