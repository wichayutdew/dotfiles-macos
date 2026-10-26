#!/bin/bash
# Workspace initializer - sets up all repositories from repos.conf
#
# Each repo is stored as a bare clone in repo-cache/ and checked out
# as a git worktree in repos/. This gives normal working directories
# while sharing git object stores for speed and disk savings.
#
# Usage:
#   init.sh            # Set up all repos (skip existing)
#   init.sh --pull     # Set up missing + pull existing
#   init.sh --clean    # Wipe everything and re-clone
#   init.sh --status   # Show status of each repo

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

WORKSPACE_ROOT="$(resolve_workspace_root)"
CONF="$WORKSPACE_ROOT/repos.conf"
CACHE_DIR="$WORKSPACE_ROOT/repo-cache"
REPOS_DIR="$WORKSPACE_ROOT/repos"

if [ ! -f "$CONF" ]; then
    echo "Error: repos.conf not found at $CONF"
    exit 1
fi

NO_CHECK="false"
for arg in "$@"; do
    case "$arg" in
        --pull|--clean|--status) MODE="$arg" ;;
        --no-check) NO_CHECK="true" ;;
    esac
done
MODE="${MODE:-}"

if [ "$MODE" = "--clean" ]; then
    read -rp "This will remove repos/ and repo-cache/. Continue? [y/N] " confirm
    if [[ "$confirm" =~ ^[Yy]$ ]]; then
        rm -rf "$REPOS_DIR" "$CACHE_DIR"
        echo "Cleaned."
    else
        echo "Aborted."
        exit 0
    fi
fi

if [ "$MODE" = "--status" ]; then
    while IFS= read -r line || [ -n "$line" ]; do
        line="$(echo "$line" | sed 's/#.*//' | xargs)"
        [ -z "$line" ] && continue
        REPO_DIR="$(echo "$line" | awk '{print $1}')"
        TARGET="$REPOS_DIR/$REPO_DIR"
        if [ -d "$TARGET/.git" ] || [ -f "$TARGET/.git" ]; then
            BRANCH="$(git -C "$TARGET" branch --show-current 2>/dev/null || echo "detached")"
            STATUS="$(git -C "$TARGET" status --short 2>/dev/null | wc -l | xargs)"
            echo "  $REPO_DIR  branch=$BRANCH  changes=$STATUS"
        else
            echo "  $REPO_DIR  (not set up)"
        fi
    done < "$CONF"
    exit 0
fi

mkdir -p "$CACHE_DIR" "$REPOS_DIR"

SUCCESS=0
SKIPPED=0
FAILED=0
TOTAL=0

setup_repo() {
    local REPO_DIR="$1" REPO_URL="$2" BRANCH="$3"
    local BARE="$CACHE_DIR/$REPO_DIR.git"
    local TARGET="$REPOS_DIR/$REPO_DIR"

    # Step 1: bare clone into cache (if not already there)
    if [ ! -d "$BARE" ]; then
        echo "[clone] $REPO_DIR -> repo-cache/$REPO_DIR.git"
        if ! git clone --bare "$REPO_URL" "$BARE" 2>&1 | sed 's/^/        /'; then
            echo "        FAILED to clone"
            return 1
        fi
        # Allow worktrees to check out any branch independently
        git -C "$BARE" config remote.origin.fetch "+refs/heads/*:refs/remotes/origin/*"
    fi

    # Step 2: create worktree in repos/ (if not already there)
    if [ -d "$TARGET/.git" ] || [ -f "$TARGET/.git" ]; then
        if [ "$MODE" = "--pull" ]; then
            echo "[pull]  $REPO_DIR"
            git -C "$BARE" fetch --prune origin 2>&1 | sed 's/^/        /'
            local CURRENT_BRANCH
            CURRENT_BRANCH="$(git -C "$TARGET" branch --show-current 2>/dev/null)"
            if [ -n "$CURRENT_BRANCH" ]; then
                git -C "$TARGET" branch --set-upstream-to="origin/$CURRENT_BRANCH" "$CURRENT_BRANCH" 2>/dev/null || true
            fi
            git -C "$TARGET" pull --ff-only 2>&1 | sed 's/^/        /' || echo "        (pull skipped - may have local changes)"
        else
            echo "[skip]  $REPO_DIR (already set up)"
        fi
        return 2
    fi

    # Determine branch to check out
    local CHECKOUT_BRANCH="$BRANCH"
    if [ -z "$CHECKOUT_BRANCH" ]; then
        CHECKOUT_BRANCH="$(git -C "$BARE" symbolic-ref --short HEAD 2>/dev/null || echo "main")"
    fi

    echo "[worktree] $REPO_DIR -> repos/$REPO_DIR (branch: $CHECKOUT_BRANCH)"
    # Fetch so remote tracking refs are available
    git -C "$BARE" fetch origin 2>/dev/null || true
    if ! git -C "$BARE" worktree add "$TARGET" "$CHECKOUT_BRANCH" 2>&1 | sed 's/^/           /'; then
        # If the branch only exists as remote, create a local tracking branch
        git -C "$BARE" worktree add -b "$CHECKOUT_BRANCH" "$TARGET" "origin/$CHECKOUT_BRANCH" 2>&1 | sed 's/^/           /' || {
            echo "           FAILED to create worktree"
            return 1
        }
    fi

    # Configure remote and upstream tracking so pull/push work from the worktree
    git -C "$TARGET" remote set-url origin "$REPO_URL" 2>/dev/null || \
        git -C "$TARGET" remote add origin "$REPO_URL" 2>/dev/null || true
    git -C "$TARGET" branch --set-upstream-to="origin/$CHECKOUT_BRANCH" "$CHECKOUT_BRANCH" 2>/dev/null || true

    return 0
}

while IFS= read -r line || [ -n "$line" ]; do
    line="$(echo "$line" | sed 's/#.*//' | xargs)"
    [ -z "$line" ] && continue

    REPO_DIR="$(echo "$line" | awk '{print $1}')"
    REPO_URL="$(echo "$line" | awk '{print $2}')"
    BRANCH="$(echo "$line" | awk '{print $3}')"
    TOTAL=$((TOTAL + 1))

    if [ -z "$REPO_URL" ]; then
        echo "[!] Skipping malformed line: $line"
        FAILED=$((FAILED + 1))
        continue
    fi

    setup_repo "$REPO_DIR" "$REPO_URL" "$BRANCH" && RC=$? || RC=$?
    case $RC in
        0) SUCCESS=$((SUCCESS + 1)) ;;
        1) FAILED=$((FAILED + 1)) ;;
        2) SKIPPED=$((SKIPPED + 1)) ;;
    esac
done < "$CONF"

echo ""
echo "Done: $SUCCESS set up, $SKIPPED skipped, $FAILED failed (of $TOTAL)"
echo ""
echo "Workspace ready. Repos are in repos/, bare caches in repo-cache/"

# Run post-pull checks (unless --no-check)
if [ "$MODE" = "--pull" ] && [ "$NO_CHECK" = "false" ]; then
    POST_PULL="$(dirname "${BASH_SOURCE[0]}")/post-pull.sh"
    if [ -f "$POST_PULL" ]; then
        "$POST_PULL"
    fi
fi
