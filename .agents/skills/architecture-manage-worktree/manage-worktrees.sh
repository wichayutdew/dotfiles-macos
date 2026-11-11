#!/usr/bin/env bash
# Create a git worktree workspace with selected repos.
#
# Each workspace gets a repos/ directory with one git worktree per selected
# repo. overlay/, CLAUDE.md, AGENTS.md, .claude/, and .codex/ are symlinked (read-only, propagate
# main workspace edits). .claude/ is copied so each agent has isolated state.
#
# Usage:
#   skills/architecture-manage-worktree/manage-worktrees.sh                    # Interactive selection
#   skills/architecture-manage-worktree/manage-worktrees.sh -n my-feature      # Named workspace
#   skills/architecture-manage-worktree/manage-worktrees.sh -n fix -r SEOGPTContent,seo-spark-jobs
#   skills/architecture-manage-worktree/manage-worktrees.sh -n fix -r SEOGPTContent -b feature/my-branch
#   skills/architecture-manage-worktree/manage-worktrees.sh -n fix -r SEOGPTContent -B feature/new-branch
#   skills/architecture-manage-worktree/manage-worktrees.sh --list              # List active workspaces
#   skills/architecture-manage-worktree/manage-worktrees.sh --remove my-feature # Remove a workspace
#   skills/architecture-manage-worktree/manage-worktrees.sh --repair            # Re-copy missing assets in all workspaces
#   skills/architecture-manage-worktree/manage-worktrees.sh --repair my-feature # Repair one workspace
#
# Options:
#   -n, --name NAME        Workspace name (default: prompted)
#   -r, --repos REPOS      Comma-separated repo names (default: interactive picker)
#   -b, --branch BRANCH    Branch to check out (default: repo's current default branch)
#   -B, --new-branch NAME  Create and check out a new branch
#   --depth N             Opt in to shallow acquisition (positive integer)

set -euo pipefail

# Detect workspace root: walk up from CWD looking for repos.conf.
_find_workspace_root() {
    local dir
    dir="$(pwd)"
    while [ "$dir" != "/" ]; do
        [ -f "$dir/repos.conf" ] && { echo "$dir"; return 0; }
        dir="$(dirname "$dir")"
    done
    echo "Error: no repos.conf found from current working directory upward." >&2
    echo "  cwd: $(pwd)" >&2
    echo "Run this script from a multi-repo workspace root or a child directory of one." >&2
    return 1
}
WORKSPACE_ROOT="$(_find_workspace_root)"
CONF="$WORKSPACE_ROOT/repos.conf"
CACHE_DIR="$WORKSPACE_ROOT/repo-cache"
SPAWN_DIR="$WORKSPACE_ROOT/worktrees"

# Set up shared workspace assets in a spawned directory (idempotent).
# All assets symlinked — run workspace setup commands from main workspace only.
setup_spawn_workspace_assets() {
    local target="$1"
    for name in overlay CLAUDE.md AGENTS.md .claude .codex; do
        src="$WORKSPACE_ROOT/$name"
        dst="$target/$name"
        [ ! -e "$src" ] && continue
        [ -e "$dst" ] && continue
        ln -s "$src" "$dst"
        echo "  [link] $name"
    done
}

# Interactive multi-select TUI: arrow keys navigate, space toggles, enter confirms.
# Populates the global SELECTED array. Returns 1 if user aborts (q/Esc).
select_repos_tui() {
    local n=${#REPO_NAMES[@]}
    local -a checked
    local i cursor=0 key esc

    for ((i=0; i<n; i++)); do checked[i]=0; done

    printf 'Select repos (↑/↓ or j/k navigate, space toggle, a all, enter confirm, q quit):\n\n' >&2

    _tui_render() {
        local mark arrow
        for ((i=0; i<n; i++)); do
            mark="[ ]"; [ "${checked[i]}" = 1 ] && mark="[x]"
            arrow="  "; [ "$i" = "$cursor" ] && arrow="> "
            printf '\033[2K\r%s%s %s\n' "$arrow" "$mark" "${REPO_NAMES[i]}" >&2
        done
    }
    _tui_render

    while :; do
        IFS= read -rsn1 key </dev/tty
        case "$key" in
            $'\x1b')
                IFS= read -rsn2 -t 0.05 esc </dev/tty || esc=""
                case "$esc" in
                    '[A') ((cursor>0)) && ((cursor--)) ;;
                    '[B') ((cursor<n-1)) && ((cursor++)) ;;
                    '') printf '\n' >&2; return 1 ;;
                esac ;;
            k) ((cursor>0)) && ((cursor--)) ;;
            j) ((cursor<n-1)) && ((cursor++)) ;;
            ' ') checked[cursor]=$((1 - checked[cursor])) ;;
            a)
                local all_on=1
                for ((i=0; i<n; i++)); do [ "${checked[i]}" = 0 ] && all_on=0 && break; done
                for ((i=0; i<n; i++)); do checked[i]=$((1 - all_on)); done ;;
            q) printf '\n' >&2; return 1 ;;
            '') break ;;
        esac
        printf '\033[%dA' "$n" >&2
        _tui_render
    done

    printf '\n' >&2
    SELECTED=()
    for ((i=0; i<n; i++)); do
        [ "${checked[i]}" = 1 ] && SELECTED+=("${REPO_NAMES[i]}")
    done
}

# Parse arguments
WS_NAME=""
REPOS_CSV=""
BRANCH=""
NEW_BRANCH=""
CLONE_DEPTH=""
ACTION="spawn"

while [[ $# -gt 0 ]]; do
    case "$1" in
        -n|--name)       WS_NAME="$2"; shift 2 ;;
        -r|--repos)      REPOS_CSV="$2"; shift 2 ;;
        -b|--branch)     BRANCH="$2"; shift 2 ;;
        -B|--new-branch) NEW_BRANCH="$2"; shift 2 ;;
        --depth)
            if [ $# -lt 2 ] || [[ ! "$2" =~ ^[1-9][0-9]*$ ]]; then
                echo "Error: --depth requires a positive integer." >&2
                exit 1
            fi
            CLONE_DEPTH="$2"
            shift 2
            ;;
        --list)          ACTION="list"; shift ;;
        --remove)        ACTION="remove"; WS_NAME="$2"; shift 2 ;;
        --repair)
            ACTION="repair"
            shift
            if [ $# -gt 0 ] && [[ "$1" != -* ]]; then
                WS_NAME="$1"
                shift
            fi
            ;;
        -h|--help)
            sed -n '2,/^$/s/^# //p' "$0"
            exit 0
            ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

# ---------------------------------------------------------------------------
# List active workspaces
# ---------------------------------------------------------------------------
if [ "$ACTION" = "list" ]; then
    if [ ! -d "$SPAWN_DIR" ] || [ -z "$(ls -A "$SPAWN_DIR" 2>/dev/null)" ]; then
        echo "No active workspaces."
        exit 0
    fi
    echo "Active workspaces in $SPAWN_DIR:"
    echo ""
    for ws in "$SPAWN_DIR"/*/; do
        [ ! -d "$ws" ] && continue
        name="$(basename "$ws")"
        repos=""
        if [ -f "$ws/.repos" ]; then
            repos=" $(tr '\n' ' ' < "$ws/.repos" | xargs)"
        fi
        echo "  $name"
        echo "    repos:${repos:- none}"
        if [ -f "$ws/.branch" ]; then
            echo "    branch: $(cat "$ws/.branch")"
        fi
    done
    exit 0
fi

# ---------------------------------------------------------------------------
# Remove a workspace
# ---------------------------------------------------------------------------
if [ "$ACTION" = "remove" ]; then
    WS_TARGET="$SPAWN_DIR/$WS_NAME"
    if [ ! -d "$WS_TARGET" ]; then
        echo "Workspace '$WS_NAME' not found at $WS_TARGET"
        exit 1
    fi
    echo "Removing workspace: $WS_NAME"
    # Collect all git worktree dirs: any subdir (flat or under repos/) containing a .git file.
    # This handles both the new flat layout and old repos/<name>/ layout, and guards against
    # a missing or incomplete .repos file — deregistering from the bare repo is required or
    # git worktree list will report them as corrupt indefinitely.
    while IFS= read -r git_marker; do
        repo_dir="$(dirname "$git_marker")"
        repo_name="$(basename "$repo_dir")"
        bare="$CACHE_DIR/$repo_name.git"
        if [ -d "$bare" ]; then
            echo "  Removing worktree: $repo_name"
            git -C "$bare" worktree remove --force "$repo_dir" 2>/dev/null || rm -rf "$repo_dir"
        fi
    done < <(find "$WS_TARGET" -maxdepth 3 -name ".git" ! -type d 2>/dev/null)
    rm -rf "$WS_TARGET"
    echo "Done."
    exit 0
fi

# ---------------------------------------------------------------------------
# Repair (re-link/re-copy missing assets) on existing spawned workspaces
# ---------------------------------------------------------------------------
if [ "$ACTION" = "repair" ]; then
    if [ ! -d "$SPAWN_DIR" ]; then
        echo "No workspaces directory: $SPAWN_DIR"
        exit 1
    fi
    if [ -n "$WS_NAME" ]; then
        t="$SPAWN_DIR/$WS_NAME"
        if [ ! -d "$t" ]; then
            echo "Not found: $t"
        else
            echo "Repair assets: $t"
            setup_spawn_workspace_assets "$t"
        fi
        exit 0
    fi
    shopt -s nullglob
    any=
    for ws in "$SPAWN_DIR"/*/; do
        any=1
        t="${ws%/}"
        echo ""
        echo "Repair assets: $t"
        setup_spawn_workspace_assets "$t"
    done
    shopt -u nullglob
    [ -z "$any" ] && echo "No workspaces in $SPAWN_DIR"
    exit 0
fi

# ---------------------------------------------------------------------------
# Read available repos from repos.conf
# ---------------------------------------------------------------------------
REPO_NAMES=()
REPO_URLS=()

while IFS= read -r line || [ -n "$line" ]; do
    line="$(echo "$line" | sed 's/#.*//' | xargs)"
    [ -z "$line" ] && continue
    name="$(echo "$line" | awk '{print $1}')"
    url="$(echo "$line" | awk '{print $2}')"
    REPO_NAMES+=("$name")
    REPO_URLS+=("$url")
done < "$CONF"

if [ ${#REPO_NAMES[@]} -eq 0 ]; then
    echo "No repos found in $CONF"
    exit 1
fi

get_url() {
    local name="$1"
    for i in "${!REPO_NAMES[@]}"; do
        if [ "${REPO_NAMES[$i]}" = "$name" ]; then
            echo "${REPO_URLS[$i]}"
            return 0
        fi
    done
    return 1
}

# ---------------------------------------------------------------------------
# Select repos (interactive or from -r flag)
# ---------------------------------------------------------------------------
SELECTED=()

if [ -n "$REPOS_CSV" ]; then
    IFS=',' read -ra SELECTED <<< "$REPOS_CSV"
    for sel in "${SELECTED[@]}"; do
        sel="$(echo "$sel" | xargs)"
        if ! get_url "$sel" >/dev/null 2>&1; then
            echo "Unknown repo: $sel"
            echo "Available: ${REPO_NAMES[*]}"
            exit 1
        fi
    done
elif [ -t 0 ] && [ -t 1 ]; then
    select_repos_tui || { echo "Aborted."; exit 1; }
else
    echo "Select repos (space-separated numbers, or 'all'):"
    echo ""
    for i in "${!REPO_NAMES[@]}"; do
        printf "  %2d) %s\n" "$((i + 1))" "${REPO_NAMES[$i]}"
    done
    echo ""
    read -rp "Selection: " selection

    if [ "$selection" = "all" ]; then
        SELECTED=("${REPO_NAMES[@]}")
    else
        for num in $selection; do
            idx=$((num - 1))
            if [ "$idx" -ge 0 ] && [ "$idx" -lt "${#REPO_NAMES[@]}" ]; then
                SELECTED+=("${REPO_NAMES[$idx]}")
            else
                echo "Invalid selection: $num"
                exit 1
            fi
        done
    fi
fi

if [ ${#SELECTED[@]} -eq 0 ]; then
    echo "No repos selected."
    exit 1
fi

# ---------------------------------------------------------------------------
# Workspace name
# ---------------------------------------------------------------------------
if [ -z "$WS_NAME" ]; then
    default_name="ws-$(date +%Y%m%d-%H%M%S)"
    read -rp "Workspace name [$default_name]: " WS_NAME
    WS_NAME="${WS_NAME:-$default_name}"
fi

WS_NAME="$(echo "$WS_NAME" | tr ' /' '-')"
WS_TARGET="$SPAWN_DIR/$WS_NAME"

if [ -d "$WS_TARGET" ]; then
    echo "Workspace '$WS_NAME' already exists at $WS_TARGET"
    read -rp "Reuse it? [Y/n] " reuse
    if [[ "$reuse" =~ ^[Nn]$ ]]; then
        exit 1
    fi
else
    mkdir -p "$WS_TARGET"
fi

# ---------------------------------------------------------------------------
# Create worktrees for selected repos
# ---------------------------------------------------------------------------
echo ""
echo "Setting up workspace: $WS_NAME"
echo "  Repos: ${SELECTED[*]}"
[ -n "$BRANCH" ] && echo "  Branch: $BRANCH"
[ -n "$NEW_BRANCH" ] && echo "  New branch: $NEW_BRANCH"
echo ""

for repo_name in "${SELECTED[@]}"; do
    repo_name="$(echo "$repo_name" | xargs)"
    bare="$CACHE_DIR/$repo_name.git"
    target="$WS_TARGET/$repo_name"
    url="$(get_url "$repo_name")"

    if [ -d "$target/.git" ] || [ -f "$target/.git" ]; then
        echo "  [skip] $repo_name (worktree exists)"
        continue
    fi

    if [ ! -d "$bare" ]; then
        echo "  [clone] $repo_name"
        clone_args=(--bare)
        if [ -n "$CLONE_DEPTH" ]; then
            clone_args+=(--depth "$CLONE_DEPTH" --single-branch)
            [ -n "$BRANCH" ] && clone_args+=(--branch "$BRANCH")
        fi
        git clone "${clone_args[@]}" "$url" "$bare" 2>&1 | sed 's/^/         /'
        if [ -n "$CLONE_DEPTH" ]; then
            cache_branch="$(git -C "$bare" symbolic-ref --short HEAD)"
            git -C "$bare" config remote.origin.fetch "+refs/heads/$cache_branch:refs/remotes/origin/$cache_branch"
        else
            git -C "$bare" config remote.origin.fetch "+refs/heads/*:refs/remotes/origin/*"
        fi
    fi

    if [ -n "$CLONE_DEPTH" ] && [ "$(git -C "$bare" rev-parse --is-shallow-repository)" = "true" ]; then
        fetch_args=(--depth "$CLONE_DEPTH" origin)
        # A shallow cache initially tracks one branch. Fetch an explicitly
        # requested branch without broadening or deepening the whole cache.
        [ -n "$BRANCH" ] && fetch_args+=("+refs/heads/$BRANCH:refs/remotes/origin/$BRANCH")
        git -C "$bare" fetch "${fetch_args[@]}"
    else
        # Never truncate a full cache, or implicitly unshallow a reused cache.
        git -C "$bare" fetch origin 2>/dev/null || true
    fi

    if [ -n "$NEW_BRANCH" ]; then
        echo "  [worktree] $repo_name -> new branch: $NEW_BRANCH"
        default_branch="$(git -C "$bare" symbolic-ref --short HEAD 2>/dev/null || echo "main")"
        if ! git -C "$bare" worktree add -b "$NEW_BRANCH" "$target" "origin/$default_branch" 2>&1 | sed 's/^/             /'; then
            if ! git -C "$bare" worktree add "$target" "$NEW_BRANCH" 2>&1 | sed 's/^/             /'; then
                echo "  [error] $repo_name: failed to create worktree for new branch '$NEW_BRANCH'"
                exit 1
            fi
        fi
    elif [ -n "$BRANCH" ]; then
        echo "  [worktree] $repo_name -> branch: $BRANCH"
        if ! git -C "$bare" worktree add "$target" "$BRANCH" 2>&1 | sed 's/^/             /'; then
            if ! git -C "$bare" worktree add -b "$BRANCH" "$target" "origin/$BRANCH" 2>&1 | sed 's/^/             /'; then
                echo "  [error] $repo_name: branch '$BRANCH' not found"
                exit 1
            fi
        fi
    else
        default_branch="$(git -C "$bare" symbolic-ref --short HEAD 2>/dev/null || echo "main")"
        ws_branch="ws/$WS_NAME"
        echo "  [worktree] $repo_name -> branch: $ws_branch (from origin/$default_branch)"
        if ! git -C "$bare" worktree add -b "$ws_branch" "$target" "origin/$default_branch" 2>&1 | sed 's/^/             /'; then
            if ! git -C "$bare" worktree add "$target" "$ws_branch" 2>&1 | sed 's/^/             /'; then
                echo "  [error] $repo_name: failed to create worktree on branch '$ws_branch'"
                exit 1
            fi
        fi
    fi

    git -C "$target" remote set-url origin "$url" 2>/dev/null || \
        git -C "$target" remote add origin "$url" 2>/dev/null || true
    current="$(git -C "$target" branch --show-current 2>/dev/null || true)"
    [ -n "$current" ] && git -C "$target" branch --set-upstream-to="origin/$current" "$current" 2>/dev/null || true
done

# ---------------------------------------------------------------------------
# Copy workspace assets (each workspace is self-contained)
# ---------------------------------------------------------------------------
setup_spawn_workspace_assets "$WS_TARGET"

# Save metadata
echo "${NEW_BRANCH:-${BRANCH:-default}}" > "$WS_TARGET/.branch"
printf '%s\n' "${SELECTED[@]}" > "$WS_TARGET/.repos"

echo ""
echo "Workspace ready: $WS_TARGET"
echo ""
echo "Repos:"
while IFS= read -r r; do
    [ -z "$r" ] && continue
    echo "  $r  branch=$(git -C "$WS_TARGET/$r" branch --show-current 2>/dev/null || echo "?")"
done < "$WS_TARGET/.repos"
