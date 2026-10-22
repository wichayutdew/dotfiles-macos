#!/usr/bin/env bash
# ci-wait.sh <gitlab|github> <host> <project> <sha> [--mr <iid>] [--timeout <s>=2700] [--interval <s>=90]
# Polls CI for exactly <sha> until terminal or timeout; prints a JSON summary (pipeline + every job/bridge or check).
# GitLab --mr: verifies the MR head and binds head_pipeline to <sha>. A synthetic
#   merged-result SHA requires current-MR pipeline association and commit-parent evidence.
# Exit: 0 success, 1 failed/canceled/required job not green, 2 still running or not found at timeout (-> handoff), 10 MR head moved.
set -euo pipefail
kind=${1:?}; host=${2:?}; project=${3:?}; sha=${4:?}; shift 4
mr=""; timeout=2700; interval=90
while [ $# -gt 0 ]; do case $1 in --mr) mr=$2;; --timeout) timeout=$2;; --interval) interval=$2;; *) echo "unknown $1" >&2; exit 3;; esac; shift 2; done
deadline=$(( $(date +%s) + timeout ))

if [ "$kind" = gitlab ]; then
  pid=$(jq -rn --arg p "$project" '$p|@uri'); api() { glab api --hostname "$host" "$@"; }
  while :; do
    verified=false; reason="pipeline not found"
    if [ -n "$mr" ]; then
      m=$(api "projects/$pid/merge_requests/$mr")
      [ "$(jq -r .diff_refs.head_sha <<<"$m")" = "$sha" ] || { echo "MR head moved from $sha" >&2; exit 10; }
      p=$(jq -c '.head_pipeline // empty' <<<"$m")
    else
      p=$(api "projects/$pid/pipelines?sha=$sha&order_by=id&sort=desc&per_page=1" | jq -c '.[0] // empty')
    fi
    if [ -n "$p" ]; then
      id=$(jq -r .id <<<"$p"); p=$(api "projects/$pid/pipelines/$id"); st=$(jq -r .status <<<"$p")
      pipeline_sha=$(jq -r '.sha // empty' <<<"$p")
      if [ "$pipeline_sha" = "$sha" ]; then
        verified=true
      elif [ -n "$mr" ]; then
        reason="pipeline SHA differs from requested source SHA; merged-result association unverified"
        if [ "$(jq -r '.source // empty' <<<"$p")" = merge_request_event ] &&
           [ "$(jq -r '.ref // empty' <<<"$p")" = "refs/merge-requests/$mr/merge" ]; then
          if associated=$(api "projects/$pid/merge_requests/$mr/pipelines?per_page=100" 2>/dev/null) &&
             jq -e --arg id "$id" --arg pipeline_sha "$pipeline_sha" \
               'any(.[]; (.id | tostring) == $id and .sha == $pipeline_sha)' <<<"$associated" >/dev/null; then
            if commit=$(api "projects/$pid/repository/commits/$pipeline_sha" 2>/dev/null) &&
               jq -e --arg pipeline_sha "$pipeline_sha" --arg sha "$sha" \
                 '.id == $pipeline_sha and ((.parent_ids // []) | index($sha) != null)' <<<"$commit" >/dev/null; then
              verified=true
            else
              reason="merged-result commit parent evidence unavailable or mismatched"
            fi
          fi
        fi
      else
        reason="pipeline SHA differs from requested source SHA"
      fi
      if [ "$verified" = true ]; then
        case $st in success|failed|canceled|skipped|manual) break;; esac
      fi
    fi
    [ "$(date +%s)" -lt "$deadline" ] || { jq -n --arg sha "$sha" --arg reason "$reason" --argjson verified "$verified" --argjson p "${p:-null}" '{sourceSha:$sha, pipelineSha:($p.sha // null), status:(if $p == null then "not-found" elif $verified then $p.status else "pending" end), pipelineStatus:($p.status // null), sourceVerified:$verified, verification:$reason, pipeline:$p}'; exit 2; }
    sleep "$interval"
  done
  jobs=$(glab api --hostname "$host" --paginate "projects/$pid/pipelines/$id/jobs?per_page=100" | jq -s 'add // []')
  bridges=$(glab api --hostname "$host" --paginate "projects/$pid/pipelines/$id/bridges?per_page=100" | jq -s 'add // []')
  if [ -n "$mr" ]; then
    m=$(api "projects/$pid/merge_requests/$mr")
    [ "$(jq -r .diff_refs.head_sha <<<"$m")" = "$sha" ] || { echo "MR head moved from $sha" >&2; exit 10; }
  fi
  jq -n --arg sha "$sha" --argjson p "$p" --argjson j "$jobs" --argjson b "$bridges" '{
    sourceSha:$sha, pipelineSha:$p.sha, mergeResult:($p.sha!=$sha), pipelineId:$p.id, url:$p.web_url, ref:$p.ref, status:$p.status,
    jobs:[$j[] | {name, stage, status, allowFailure:.allow_failure, url:.web_url}],
    downstream:[$b[] | {name, status, allowFailure:.allow_failure, downstreamStatus:(.downstream_pipeline.status // null), downstreamUrl:(.downstream_pipeline.web_url // null)}],
    requiredNotGreen:([$j[], $b[] | select((.allow_failure|not) and (.status!="success")) | .name]) }' | tee /tmp/ci-wait.$$.json
  if jq -e '.status=="success" and (.requiredNotGreen|length==0) and all(.downstream[]; .allowFailure or .downstreamStatus==null or .downstreamStatus=="success")' /tmp/ci-wait.$$.json >/dev/null; then ok=0; else ok=1; fi
  rm -f /tmp/ci-wait.$$.json; exit $(( ok == 0 ? 0 : 1 ))

elif [ "$kind" = github ]; then
  api() { gh api --hostname "$host" "$@"; }
  while :; do
    runs=$(gh api --hostname "$host" --paginate "repos/$project/commits/$sha/check-runs?per_page=100" | jq -s '[.[].check_runs[]]')
    stat=$(api "repos/$project/commits/$sha/status")
    pending=$(jq -n --argjson r "$runs" --argjson s "$stat" '([$r[] | select(.status!="completed")]|length) + (if ($s.statuses|length)>0 and $s.state=="pending" then 1 else 0 end)')
    found=$(jq -n --argjson r "$runs" --argjson s "$stat" '($r|length) + ($s.statuses|length)')
    { [ "$found" -gt 0 ] && [ "$pending" -eq 0 ]; } && break
    [ "$(date +%s)" -lt "$deadline" ] || { jq -n --arg sha "$sha" --argjson f "$found" --argjson p "$pending" '{sha:$sha, status:(if $f==0 then "not-found" else "running" end), pending:$p}'; exit 2; }
    sleep "$interval"
  done
  jq -n --arg sha "$sha" --argjson r "$runs" --argjson s "$stat" '{
    sha:$sha, combinedStatus:$s.state,
    checks:[$r[] | {name, conclusion, url:.html_url}], statuses:[$s.statuses[] | {context, state, url:.target_url}],
    notGreen:([$r[] | select(.conclusion as $c | ["success","neutral","skipped"] | index($c) | not) | .name] + [$s.statuses[] | select(.state!="success") | .context]) }' | tee /tmp/ci-wait.$$.json
  if jq -e '.notGreen|length==0' /tmp/ci-wait.$$.json >/dev/null; then ok=0; else ok=1; fi; rm -f /tmp/ci-wait.$$.json; exit $(( ok == 0 ? 0 : 1 ))
else echo "unknown kind" >&2; exit 3; fi
