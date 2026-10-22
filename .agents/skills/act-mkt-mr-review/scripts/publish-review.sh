#!/usr/bin/env bash
# publish-review.sh <actions.json> [--dry-run]
# actions.json: {"kind":"gitlab|github","host":"...","project":"group/repo","iid":4,
#   "expectedHeadSha":"<sha>","diffRefs":{"base_sha":"...","start_sha":"...","head_sha":"..."},
#   "actions":[{"id":"F1","type":"inline-comment","path":"src/a.ts","oldPath":"src/old.ts",
#     "line":42,"side":"new|old","body":"...","marker":"act-mkt-review:F1"},
#     {"id":"F2","type":"generic-comment","reason":"no valid line","body":"...","marker":"..."}]}
# diffRefs applies to GitLab; body posts as <body> + two newlines + <!-- <marker> -->.
# Existing marker matches require exact body, type and anchor.
# Exit: 0 confirmed (or safe dry run), 1 unconfirmed post, 3 malformed/conflicting,
#       10 moved head/revision, 11 closed review.
set -euo pipefail
f=${1:?actions.json}; dry=${2:-}
[ -z "$dry" ] || [ "$dry" = --dry-run ] || { echo 'unknown option' >&2; exit 3; }
jq -e '.kind=="gitlab" or .kind=="github"' "$f" >/dev/null || exit 3
jq -e '.host and .project and .iid and .expectedHeadSha and (.actions|type=="array")
  and all(.actions[]; .id and .marker and .body and
    (.type=="inline-comment" or .type=="generic-comment") and
    (.type!="inline-comment" or (.path and (.line|type=="number") and
       ((.side//"new")=="new" or .side=="old"))) and
    (.type!="generic-comment" or .reason))
  and (([.actions[].marker]|unique|length)==(.actions|length))' "$f" >/dev/null || { echo 'malformed actions file' >&2; exit 3; }
kind=$(jq -r .kind "$f"); host=$(jq -r .host "$f"); project=$(jq -r .project "$f")
iid=$(jq -r .iid "$f"); want=$(jq -r .expectedHeadSha "$f")
ledger=(); preflight=(); rc=0
emit() { ledger+=("$1"); }
entry() { jq -cn --arg id "$1" --arg type "$2" --arg status "$3" '{id:$id,type:$type,status:$status}'; }
body_for() { jq -nr --argjson a "$1" '$a.body+"\n\n<!-- "+$a.marker+" -->"'; }

if [ "$kind" = gitlab ]; then
  jq -e --arg h "$want" '.diffRefs.base_sha and .diffRefs.start_sha and .diffRefs.head_sha==$h' "$f" >/dev/null || { echo 'malformed diff refs' >&2; exit 3; }
  pid=$(jq -rn --arg p "$project" '$p|@uri'); base="projects/$pid/merge_requests/$iid"
  api() { glab api --hostname "$host" "$@"; }
  current() {
    local mr state head refs
    mr=$(api "$base") || return 1
    state=$(jq -r .state <<<"$mr"); head=$(jq -r .diff_refs.head_sha <<<"$mr")
    [ "$state" = opened ] || { echo "MR is $state" >&2; return 11; }
    [ "$head" = "$want" ] || { echo "head moved: $head != $want" >&2; return 10; }
    refs=$(jq -c .diffRefs "$f")
    jq -e --argjson r "$refs" '.diff_refs.base_sha==$r.base_sha and .diff_refs.start_sha==$r.start_sha and .diff_refs.head_sha==$r.head_sha' <<<"$mr" >/dev/null || { echo 'diff refs moved' >&2; return 10; }
  }
  comments() { api --paginate "$base/discussions?per_page=100" | jq -s 'add // []'; }
  reconcile() {
    jq -c --argjson a "$1" --arg body "$2" '
      [.[] as $d | $d.notes[] | select((.body//"")|contains("<!-- "+$a.marker+" -->")) |
        {discussionId:$d.id,noteId:.id,body,position}] as $hits |
      if ($hits|length)==0 then {status:"missing"}
      elif ($hits|length)!=1 then {status:"conflict",reason:"duplicate-marker",matches:($hits|length)}
      else $hits[0] as $h | ($h.position) as $p |
        if $h.body!=$body then $h+{status:"conflict",reason:"body-mismatch"}
        elif $a.type=="generic-comment" then
          if $p==null then $h+{status:"existing"} else $h+{status:"conflict",reason:"type-mismatch"} end
        elif $p!=null and $p.position_type=="text" and
          $p.base_sha==$refs.base_sha and $p.start_sha==$refs.start_sha and $p.head_sha==$refs.head_sha and
          $p.old_path==($a.oldPath//$a.path) and $p.new_path==$a.path and
          (if ($a.side//"new")=="old" then $p.old_line==$a.line and $p.new_line==null
           else $p.new_line==$a.line and $p.old_line==null end)
        then $h+{status:"existing"} else $h+{status:"conflict",reason:"position-mismatch"} end
      end' --argjson refs "$(jq -c .diffRefs "$f")" <<<"$3"
  }
  current || exit $?
  all=$(comments) || exit 1
elif [ "$kind" = github ]; then
  api() { gh api --hostname "$host" "$@"; }
  current() {
    local pr state merged head
    pr=$(api "repos/$project/pulls/$iid") || return 1
    state=$(jq -r .state <<<"$pr"); merged=$(jq -r .merged <<<"$pr"); head=$(jq -r .head.sha <<<"$pr")
    { [ "$state" = open ] && [ "$merged" != true ]; } || { echo "PR is $state" >&2; return 11; }
    [ "$head" = "$want" ] || { echo "head moved: $head != $want" >&2; return 10; }
  }
  comments() {
    local review issue
    review=$(api --paginate "repos/$project/pulls/$iid/comments?per_page=100" | jq -s 'add // [] | map(. + {kind:"review"})') || return 1
    issue=$(api --paginate "repos/$project/issues/$iid/comments?per_page=100" | jq -s 'add // [] | map(. + {kind:"issue"})') || return 1
    jq -cn --argjson review "$review" --argjson issue "$issue" '$review+$issue'
  }
  reconcile() {
    jq -c --argjson a "$1" --arg body "$2" --arg sha "$want" '
      [.[] | select((.body//"")|contains("<!-- "+$a.marker+" -->"))] as $hits |
      if ($hits|length)==0 then {status:"missing"}
      elif ($hits|length)!=1 then {status:"conflict",reason:"duplicate-marker",matches:($hits|length)}
      else $hits[0] as $h |
        if $h.body!=$body then $h+{status:"conflict",reason:"body-mismatch"}
        elif $a.type=="generic-comment" then
          if $h.kind=="issue" then $h+{status:"existing"} else $h+{status:"conflict",reason:"type-mismatch"} end
        elif $h.kind=="review" and $h.commit_id==$sha and $h.path==$a.path and
          $h.line==$a.line and $h.side==(if ($a.side//"new")=="old" then "LEFT" else "RIGHT" end)
        then $h+{status:"existing"} else $h+{status:"conflict",reason:"position-mismatch"} end
      end' <<<"$3"
  }
  current || exit $?
  all=$(comments) || exit 1
fi

# Reconcile the whole ledger before any mutation. One conflict blocks all writes.
n=$(jq '.actions|length' "$f")
for ((i=0;i<n;i++)); do
  a=$(jq -c ".actions[$i]" "$f"); body=$(body_for "$a")
  hit=$(reconcile "$a" "$body" "$all") || exit 1
  preflight+=("$hit")
  if [ "$(jq -r .status <<<"$hit")" = conflict ]; then rc=3; fi
done
if [ "$rc" = 3 ]; then
  for ((i=0;i<n;i++)); do
    a=$(jq -c ".actions[$i]" "$f"); id=$(jq -r .id <<<"$a"); type=$(jq -r .type <<<"$a")
    emit "$(jq -c --arg id "$id" --arg type "$type" '.+{id:$id,type:$type}' <<<"${preflight[$i]}")"
  done
  printf '%s\n' "${ledger[@]}" | jq -s .
  exit 3
fi

# GitHub keeps its original single COMMENT review for all missing inline comments.
# Refresh every action before the batch so a concurrent conflicting marker blocks the write.
batch_results=()
if [ "$kind" = github ] && [ -z "$dry" ]; then
  need_batch=false
  for ((i=0;i<n;i++)); do
    a=$(jq -c ".actions[$i]" "$f")
    if [ "$(jq -r .type <<<"$a")" = inline-comment ] &&
       [ "$(jq -r .status <<<"${preflight[$i]}")" = missing ]; then need_batch=true; fi
  done
  if [ "$need_batch" = true ]; then
    current || exit $?
    all=$(comments) || exit 1
    for ((i=0;i<n;i++)); do
      a=$(jq -c ".actions[$i]" "$f"); body=$(body_for "$a")
      hit=$(reconcile "$a" "$body" "$all") || exit 1
      preflight[$i]="$hit"
      if [ "$(jq -r .status <<<"$hit")" = conflict ]; then rc=3; fi
    done
    if [ "$rc" = 3 ]; then
      for ((i=0;i<n;i++)); do
        a=$(jq -c ".actions[$i]" "$f")
        emit "$(jq -c --arg id "$(jq -r .id <<<"$a")" --arg type "$(jq -r .type <<<"$a")" '.+{id:$id,type:$type}' <<<"${preflight[$i]}")"
      done
      printf '%s\n' "${ledger[@]}" | jq -s .
      exit 3
    fi
    missing_inline=()
    for ((i=0;i<n;i++)); do
      a=$(jq -c ".actions[$i]" "$f")
      if [ "$(jq -r .type <<<"$a")" = inline-comment ] &&
         [ "$(jq -r .status <<<"${preflight[$i]}")" = missing ]; then
        missing_inline+=("$a")
      fi
    done
    if [ "${#missing_inline[@]}" -gt 0 ]; then
      printf '%s\n' "${missing_inline[@]}" | jq -s --arg sha "$want" '
        {commit_id:$sha,event:"COMMENT",body:"",comments:[.[] |
          {path,line,side:(if (.side//"new")=="old" then "LEFT" else "RIGHT" end),
           body:(.body+"\n\n<!-- "+.marker+" -->")}]}' |
        api -X POST "repos/$project/pulls/$iid/reviews" --input - >/dev/null || true
      if all=$(comments); then
        for ((i=0;i<n;i++)); do
          a=$(jq -c ".actions[$i]" "$f")
          if [ "$(jq -r .type <<<"$a")" != inline-comment ] ||
             [ "$(jq -r .status <<<"${preflight[$i]}")" != missing ]; then continue; fi
          body=$(body_for "$a"); hit=$(reconcile "$a" "$body" "$all") || exit 1
          status=$(jq -r .status <<<"$hit")
          if [ "$status" = existing ]; then status=created
          elif [ "$status" = missing ]; then status=not-found-after-post; rc=1
          else rc=3; fi
          batch_results[$i]=$(jq -c --arg status "$status" '.+{status:$status}' <<<"$hit")
        done
      else
        rc=1
        for ((i=0;i<n;i++)); do
          a=$(jq -c ".actions[$i]" "$f")
          if [ "$(jq -r .type <<<"$a")" = inline-comment ] &&
             [ "$(jq -r .status <<<"${preflight[$i]}")" = missing ]; then
            batch_results[$i]='{"status":"readback-unavailable"}'
          fi
        done
      fi
    fi
  fi
fi

for ((i=0;i<n;i++)); do
  a=$(jq -c ".actions[$i]" "$f"); id=$(jq -r .id <<<"$a"); type=$(jq -r .type <<<"$a")
  status=$(jq -r .status <<<"${preflight[$i]}")
  if [ "$kind" = github ] && [ "$type" = inline-comment ] && [ -z "$dry" ]; then
    if [ "$status" = existing ]; then hit=${preflight[$i]}; else hit=${batch_results[$i]}; fi
    emit "$(jq -c --arg id "$id" --arg type "$type" '.+{id:$id,type:$type}' <<<"$hit")"
    continue
  fi
  if [ "$status" = existing ]; then
    emit "$(jq -c --arg id "$id" --arg type "$type" '.+{id:$id,type:$type}' <<<"${preflight[$i]}")"
    continue
  fi
  if [ -n "$dry" ]; then emit "$(entry "$id" "$type" would-post)"; continue; fi
  if [ "$rc" != 0 ]; then emit "$(entry "$id" "$type" skipped-after-failure)"; continue; fi
  current || exit $?
  # Fresh readback catches concurrent writes and ambiguous prior POSTs.
  all=$(comments) || exit 1
  body=$(body_for "$a"); hit=$(reconcile "$a" "$body" "$all") || exit 1
  status=$(jq -r .status <<<"$hit")
  if [ "$status" = conflict ]; then
    emit "$(jq -c --arg id "$id" --arg type "$type" '.+{id:$id,type:$type}' <<<"$hit")"; rc=3; continue
  fi
  if [ "$status" = existing ]; then
    emit "$(jq -c --arg id "$id" --arg type "$type" '.+{id:$id,type:$type}' <<<"$hit")"; continue
  fi
  if [ "$kind" = gitlab ]; then
    if [ "$type" = inline-comment ]; then
      payload=$(jq -cn --argjson a "$a" --argjson r "$(jq -c .diffRefs "$f")" --arg body "$body" '
        {body:$body,position:({position_type:"text",base_sha:$r.base_sha,start_sha:$r.start_sha,head_sha:$r.head_sha,
          old_path:($a.oldPath//$a.path),new_path:$a.path}+
          (if ($a.side//"new")=="old" then {old_line:$a.line} else {new_line:$a.line} end))}')
      printf '%s' "$payload" | api -X POST "$base/discussions" -H 'Content-Type: application/json' --input - >/dev/null || true
    else
      jq -cn --arg body "$body" '{body:$body}' | api -X POST "$base/notes" -H 'Content-Type: application/json' --input - >/dev/null || true
    fi
  else
    jq -cn --arg body "$body" '{body:$body}' |
      api -X POST "repos/$project/issues/$iid/comments" --input - >/dev/null || true
  fi
  all=$(comments) || { emit "$(entry "$id" "$type" readback-unavailable)"; rc=1; continue; }
  hit=$(reconcile "$a" "$body" "$all") || { emit "$(entry "$id" "$type" readback-unavailable)"; rc=1; continue; }
  status=$(jq -r .status <<<"$hit")
  if [ "$status" = existing ]; then status=created
  elif [ "$status" = missing ]; then status=not-found-after-post; rc=1
  else rc=3; fi
  emit "$(jq -c --arg id "$id" --arg type "$type" --arg status "$status" '.+{id:$id,type:$type,status:$status}' <<<"$hit")"
done
if [ "$n" -eq 0 ]; then printf '[]\n'; else printf '%s\n' "${ledger[@]}" | jq -s .; fi
exit "$rc"
