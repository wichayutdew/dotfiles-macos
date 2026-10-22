#!/usr/bin/env bash
# ticket-workspace.sh <workId> <origin> <baseBranch> <baseHead> <sourceBranch>
#                     [--primary-checkout <path>] [--ref <url>[#<rev>]]... [--check]
# Creates/reuses ~/repositories/worktrees/<workId>/<repo-name> as the primary git worktree on <sourceBranch>
# (from --primary-checkout, else a direct clone), and syncs read-only reference repos via repo-sync.sh.
# --check: create nothing; verify existing layout for restart rebinding.
# Base dir override: WORKTREES_BASE (default ~/repositories/worktrees). Portable to macOS bash 3.2.
# Prints {root, repositories:[{name, role, cwd, head, branch}]} (+ primary: baseIsAncestor, dirty).
# Exit: 0 ok · 3 unsafe/mismatch/missing (blocked) · 10 baseHead not an ancestor of HEAD (gaps).
set -euo pipefail
[ $# -ge 5 ] || { sed -n '2,10p' "$0" >&2; exit 3; }
work_id=$1; origin=$2; base_branch=$3; base_head=$4; src_branch=$5; shift 5
primary=""; check=0; refs=()
while [ $# -gt 0 ]; do
  case $1 in
    --primary-checkout) primary=$2; shift 2;;
    --ref) refs+=("$2"); shift 2;;
    --check) check=1; shift;;
    *) echo "unknown arg $1" >&2; exit 3;;
  esac
done
case $work_id in ''|.*|*/*|*[!A-Za-z0-9._-]*) echo "invalid workId: $work_id" >&2; exit 3;; esac

here=$(cd "$(dirname "$0")" && pwd)
sync="$here/repo-sync.sh"
cleanup="$here/cleanup-workspaces.py"
root="${WORKTREES_BASE:-$HOME/repositories/worktrees}/$work_id"
die() { echo "$*" >&2; exit 3; }
norm() { printf '%s' "$1" | sed -E 's#^[a-z+]+://##; s#^[^@/]+@##; s#:[0-9]+/#/#; s#:([^0-9])#/\1#; s#\.git/?$##; s#/$##' | tr 'A-Z' 'a-z'; }
same_origin() { [ "$(norm "$(git -C "$1" remote get-url origin 2>/dev/null || true)")" = "$(norm "$2")" ]; }
phys() { (cd "$1" 2>/dev/null && pwd -P); }
entry() { # dir role
  jq -cn --arg name "$(basename "$1")" --arg role "$2" --arg cwd "$1" \
    --arg head "$(git -C "$1" rev-parse HEAD)" --arg branch "$(git -C "$1" symbolic-ref --quiet --short HEAD || echo '(detached)')" \
    '{name:$name, role:$role, cwd:$cwd, head:$head, branch:$branch}'
}

name=$(basename "$(norm "$origin")")
cwd="$root/$name"

# ---- primary ----
if [ -e "$cwd" ]; then
  top=$(git -C "$cwd" rev-parse --show-toplevel 2>/dev/null || true)
  [ -n "$top" ] && [ "$(phys "$top")" = "$(phys "$cwd")" ] || die "$cwd exists but is not a git checkout root"
  same_origin "$cwd" "$origin" || die "$cwd origin does not match $origin"
  [ "$(git -C "$cwd" symbolic-ref --quiet --short HEAD || true)" = "$src_branch" ] || die "$cwd is not on $src_branch"
  if [ -n "$primary" ]; then
    git -C "$primary" worktree list --porcelain | grep -qxF "worktree $(phys "$cwd")" \
      || die "$cwd is not a worktree of $primary"
  fi
elif [ "$check" = 1 ]; then
  die "missing primary $cwd"
else
  mkdir -p "$root"
  if [ -n "$primary" ]; then
    same_origin "$primary" "$origin" || die "primary checkout $primary origin does not match $origin"
    git -C "$primary" fetch --quiet origin "$base_branch"
    git -C "$primary" cat-file -e "$base_head^{commit}" 2>/dev/null || git -C "$primary" fetch --quiet origin "$base_head" || die "baseHead $base_head not found"
    if git -C "$primary" show-ref --verify --quiet "refs/heads/$src_branch" || git -C "$primary" show-ref --verify --quiet "refs/remotes/origin/$src_branch"; then
      git -C "$primary" worktree add --quiet "$cwd" "$src_branch" || die "worktree add failed (branch checked out elsewhere?)"
    else
      git -C "$primary" worktree add --quiet -b "$src_branch" "$cwd" "$base_head" || die "worktree add -b failed"
    fi
    python3 "$cleanup" register --kind worktree "$cwd" >/dev/null
  else
    git clone --quiet --filter=blob:none "$origin" "$cwd"
    python3 "$cleanup" register --kind clone "$cwd" >/dev/null
    git -C "$cwd" cat-file -e "$base_head^{commit}" 2>/dev/null || git -C "$cwd" fetch --quiet origin "$base_head" || die "baseHead $base_head not found"
    if git -C "$cwd" show-ref --verify --quiet "refs/remotes/origin/$src_branch"; then
      git -C "$cwd" checkout --quiet "$src_branch"
    else
      git -C "$cwd" checkout --quiet -b "$src_branch" "$base_head"
    fi
  fi
fi
git -C "$cwd" cat-file -e "$base_head^{commit}" 2>/dev/null || git -C "$cwd" fetch --quiet origin "$base_branch" 2>/dev/null || true
anc=false; git -C "$cwd" merge-base --is-ancestor "$base_head" HEAD 2>/dev/null && anc=true
dirty=$(git -C "$cwd" status --porcelain | wc -l | tr -d ' ')
out=$(entry "$cwd" primary | jq -c --argjson a "$anc" --argjson d "$dirty" '. + {baseIsAncestor:$a, dirty:$d}')

# ---- reference repos ----
for r in ${refs[@]+"${refs[@]}"}; do
  url=${r%%#*}; rev=HEAD; case $r in *'#'*) rev=${r#*#};; esac
  rdir="$root/$(basename "$(norm "$url")")"
  if [ "$check" = 1 ]; then
    [ -d "$rdir" ] && same_origin "$rdir" "$url" || die "reference $rdir missing or origin mismatch"
  else
    rdir=$(bash "$sync" "$url" "$root" "$rev" | jq -r .dir) || exit 3
  fi
  out="$out
$(entry "$rdir" reference)"
done

printf '%s\n' "$out" | jq -sc --arg root "$root" '{root:$root, repositories:.}'
[ "$anc" = true ] || { echo "baseHead $base_head is not an ancestor of $cwd HEAD" >&2; exit 10; }
