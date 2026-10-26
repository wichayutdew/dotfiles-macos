#!/bin/bash
# Usage: add-repo.sh <git-url> [directory-name] [branch]
# Adds a single repository to the workspace and appends it to repos.conf

set -euo pipefail

# Resolve workspace root: repos.conf marks the multi-repo workspace.
# Order: ARCHITECTURE_WORKSPACE_ROOT, then walk from cwd, then walk from script dir (legacy).
resolve_workspace_root() {
    if [[ -n "${ARCHITECTURE_WORKSPACE_ROOT:-}" ]]; then
        local w
        w="$(cd "${ARCHITECTURE_WORKSPACE_ROOT}" && pwd -P 2>/dev/null || cd "${ARCHITECTURE_WORKSPACE_ROOT}" && pwd)"
        if [[ -f "$w/repos.conf" ]]; then
            echo "$w"
            return 0
        fi
        echo "Error: ARCHITECTURE_WORKSPACE_ROOT=${ARCHITECTURE_WORKSPACE_ROOT} does not contain repos.conf" >&2
        exit 1
    fi

    local dir
    dir="$(pwd -P 2>/dev/null || pwd)"
    while [[ "$dir" != "/" ]]; do
        if [[ -f "$dir/repos.conf" ]]; then
            echo "$dir"
            return 0
        fi
        dir="$(dirname "$dir")"
    done

    dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    while [[ "$dir" != "/" ]]; do
        if [[ -f "$dir/repos.conf" ]]; then
            echo "$dir"
            return 0
        fi
        dir="$(dirname "$dir")"
    done

    echo "Error: Could not find workspace root (no repos.conf found). cd to the workspace root or set ARCHITECTURE_WORKSPACE_ROOT." >&2
    exit 1
}

REPO_URL="${1:?Usage: $0 <git-url> [directory-name] [branch]}"
REPO_DIR="${2:-$(basename "$REPO_URL" .git)}"
BRANCH="${3:-}"
WORKSPACE_ROOT="$(resolve_workspace_root)"
CACHE_DIR="$WORKSPACE_ROOT/repo-cache"
TARGET="$WORKSPACE_ROOT/repos/$REPO_DIR"
BARE="$CACHE_DIR/$REPO_DIR.git"

mkdir -p "$CACHE_DIR" "$WORKSPACE_ROOT/repos"

# Bare clone
if [ ! -d "$BARE" ]; then
    echo "=> Bare clone -> repo-cache/$REPO_DIR.git"
    git clone --bare "$REPO_URL" "$BARE"
    git -C "$BARE" config remote.origin.fetch "+refs/heads/*:refs/remotes/origin/*"
else
    echo "=> Bare cache exists, fetching latest..."
    git -C "$BARE" fetch --prune origin
fi

# Worktree
if [ -d "$TARGET/.git" ] || [ -f "$TARGET/.git" ]; then
    echo "=> Worktree already exists at repos/$REPO_DIR, pulling..."
    git -C "$TARGET" pull --ff-only 2>/dev/null || echo "   (pull skipped)"
else
    CHECKOUT_BRANCH="${BRANCH:-$(git -C "$BARE" symbolic-ref --short HEAD 2>/dev/null || echo "main")}"
    echo "=> Creating worktree -> repos/$REPO_DIR (branch: $CHECKOUT_BRANCH)"
    git -C "$BARE" fetch origin 2>/dev/null || true
    git -C "$BARE" worktree add "$TARGET" "$CHECKOUT_BRANCH" 2>/dev/null || \
        git -C "$BARE" worktree add -b "$CHECKOUT_BRANCH" "$TARGET" "origin/$CHECKOUT_BRANCH"
    git -C "$TARGET" remote set-url origin "$REPO_URL" 2>/dev/null || \
        git -C "$TARGET" remote add origin "$REPO_URL" 2>/dev/null || true
    git -C "$TARGET" branch --set-upstream-to="origin/$CHECKOUT_BRANCH" "$CHECKOUT_BRANCH" 2>/dev/null || true
fi

# Append to repos.conf if not already listed
if ! grep -q "^${REPO_DIR}\b" "$WORKSPACE_ROOT/repos.conf" 2>/dev/null; then
    entry="$REPO_DIR  $REPO_URL"
    [ -n "$BRANCH" ] && entry="$entry  $BRANCH"
    echo "$entry" >> "$WORKSPACE_ROOT/repos.conf"
    echo "=> Added to repos.conf"
fi

echo "=> Done: $TARGET"
