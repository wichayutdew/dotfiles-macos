#!/usr/bin/env bash
# update-managed-region.sh <gitlab|github> <host> <project> <iid> <content.md> [--dry-run]
# Replaces ONLY the interior of the single <!-- ai-only-start --> / <!-- ai-only-end --> pair in an open MR/PR description.
# No markers: appends one pair. Mixed/duplicated/out-of-order markers: exit 3 (blocked). Title is never touched.
# Prints {before, after, changed}; reads the description back after writing.
# Exit: 0 ok (or unchanged), 3 malformed/unsafe, 4 readback mismatch, 11 merged/closed.
set -euo pipefail
kind=${1:?}; host=${2:?}; project=${3:?}; iid=${4:?}; content=${5:?}; dry=${6:-}
S='<!-- ai-only-start -->'; E='<!-- ai-only-end -->'
if [ "$kind" = gitlab ]; then
  pid=$(jq -rn --arg p "$project" '$p|@uri'); url="projects/$pid/merge_requests/$iid"
  get() { glab api --hostname "$host" "$url"; }
  st=$(get | jq -r .state); [ "$st" = opened ] || { echo "MR is $st" >&2; exit 11; }
  desc() { get | jq -j '.description // ""'; }
  put() { jq -Rs '{description:.}' | glab api --hostname "$host" -X PUT "$url" -H 'Content-Type: application/json' --input - >/dev/null; }
else
  url="repos/$project/pulls/$iid"
  get() { gh api --hostname "$host" "$url"; }
  st=$(get | jq -r 'if .merged then "merged" else .state end'); [ "$st" = open ] || { echo "PR is $st" >&2; exit 11; }
  desc() { get | jq -j '.body // ""'; }
  put() { jq -Rs '{body:.}' | gh api --hostname "$host" -X PATCH "$url" --input - >/dev/null; }
fi
if ! before=$(desc && printf x); then
  echo "description unavailable" >&2; exit 3
fi
before=${before%x}
# jq constructs the new value without normalizing any text outside the marker pair.
# The sentinel protects terminal newlines from Bash command substitution.
if ! after=$(jq -n -j --arg b "$before" --arg s "$S" --arg e "$E" --rawfile c "$content" '
  def count($marker): if . == "" then 0 else split($marker) | length - 1 end;
  ($b | count($s)) as $ns | ($b | count($e)) as $ne |
  if $ns == 0 and $ne == 0 then
    $b + (if $b == "" then "" else "\n\n" end) + $s + "\n" + $c +
    (if $c | endswith("\n") then "" else "\n" end) + $e + "\n"
  elif $ns == 1 and $ne == 1 then
    [$b | match("(?m)^" + $s + "\\r?$"; "g")] as $starts |
    [$b | match("(?m)^" + $e + "\\r?$"; "g")] as $ends |
    if ($starts | length) != 1 or ($ends | length) != 1 or
       $starts[0].offset >= $ends[0].offset or
       $b[($starts[0].offset + $starts[0].length):($starts[0].offset + $starts[0].length + 1)] != "\n"
    then error("malformed markers")
    else
      $b[:($starts[0].offset + $starts[0].length + 1)] + $c +
      (if $c | endswith("\n") then "" else "\n" end) +
      $b[$ends[0].offset:]
    end
  else error("malformed markers") end | . + "x"
'); then
  echo "malformed markers or unreadable content" >&2; exit 3
fi
after=${after%x}
changed=$([ "$before" = "$after" ] && echo false || echo true)
if [ "$changed" = true ] && [ -z "$dry" ]; then
  printf '%s' "$after" | put
  if ! back=$(desc && printf x); then
    echo "readback unavailable" >&2; exit 4
  fi
  back=${back%x}
  [ "$back" = "$after" ] || { echo "readback differs from written description" >&2; exit 4; }
fi
jq -n --arg b "$before" --arg a "$after" --argjson c "$changed" '{before:$b, after:$a, changed:$c}'
