#!/usr/bin/env bash
# repo-sync.sh <clone-url> <root> [<sha>|<ref>|HEAD] [--mr <iid>|--pr <n>]
# Clone (partial) or fetch a repo into <root>/<repo-name>, then pin it detached at a revision.
# Prints JSON {dir, origin, sha}. Exit: 0 ok, 3 unsafe (origin mismatch / unresolvable rev).
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
cleanup="$here/cleanup-workspaces.py"
url=${1:?clone url}; root=${2:?root dir}; rev=${3:-HEAD}; shift $(( $# < 3 ? $# : 3 ))
mr=""; pr=""
while [ $# -gt 0 ]; do case $1 in --mr) mr=$2; shift 2;; --pr) pr=$2; shift 2;; *) echo "unknown arg $1" >&2; exit 3;; esac; done

norm() { # host/path without scheme, user, .git, trailing slash; lowercase
  printf '%s' "$1" | sed -E 's#^[a-z+]+://##; s#^[^@/]+@##; s#:[0-9]+/#/#; s#:([^0-9])#/\1#; s#\.git/?$##; s#/$##' | tr 'A-Z' 'a-z'
}
name=$(basename "$(norm "$url")")
dir="$root/${REPO_DIRNAME:-$name}"
mkdir -p "$root"

if [ -d "$dir/.git" ] || [ -f "$dir/.git" ]; then
  have=$(git -C "$dir" remote get-url origin)
  if [ "$(norm "$have")" != "$(norm "$url")" ]; then
    echo "origin mismatch in $dir: $have (expected $url); not reusing" >&2; exit 3
  fi
  git -C "$dir" fetch --quiet --prune --filter=blob:none origin
  fresh=0
else
  git clone --quiet --filter=blob:none --no-checkout "$url" "$dir"
  python3 "$cleanup" register --kind clone "$dir" >/dev/null
  fresh=1
fi

if [ "$rev" = "HEAD" ]; then
  git -C "$dir" remote set-head origin --auto >/dev/null 2>&1 || true
  sha=$(git -C "$dir" rev-parse origin/HEAD)
else
  if ! git -C "$dir" cat-file -e "$rev^{commit}" 2>/dev/null; then
    git -C "$dir" fetch --quiet --filter=blob:none origin "$rev" 2>/dev/null \
      || { [ -n "$mr" ] && git -C "$dir" fetch --quiet --filter=blob:none origin "refs/merge-requests/$mr/head"; } \
      || { [ -n "$pr" ] && git -C "$dir" fetch --quiet --filter=blob:none origin "pull/$pr/head"; } \
      || true
  fi
  sha=$(git -C "$dir" rev-parse --verify --quiet "$rev^{commit}" || git -C "$dir" rev-parse --verify --quiet "origin/$rev^{commit}" || true)
  [ -n "$sha" ] || { echo "cannot resolve $rev in $dir" >&2; exit 3; }
fi

if [ "$fresh" = 1 ] || [ -z "$(git -C "$dir" status --porcelain 2>/dev/null)" ]; then
  git -C "$dir" checkout --quiet --detach "$sha"
  out=$dir
else
  out="$dir@${sha:0:12}"
  if [ ! -e "$out" ]; then
    git -C "$dir" worktree add --quiet --detach "$out" "$sha"
    python3 "$cleanup" register --kind worktree "$out" >/dev/null
  fi
  echo "clone $dir is dirty; using side worktree $out" >&2
fi
jq -n --arg dir "$out" --arg origin "$url" --arg sha "$sha" '{dir:$dir, origin:$origin, sha:$sha}'
