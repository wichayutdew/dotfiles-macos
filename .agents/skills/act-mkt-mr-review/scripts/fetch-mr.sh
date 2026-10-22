#!/usr/bin/env bash
# fetch-mr.sh <PR/MR URL> <out-dir>
# Read-only. Dumps complete host evidence to <out-dir> and prints index.json.
# GitLab files: mr.json commits.json diffs.json diff.patch discussions.json pipelines.json approvals.json
# GitHub files: pr.json diff.patch review_comments.json issue_comments.json reviews.json checks.json
# Exit: 0 ok, 3 bad URL / auth / API failure.
set -euo pipefail
url=${1:?PR/MR URL}; out=${2:?out dir}; mkdir -p "$out"
sh_out() { local f=$1; shift; "$@" > "$f"; }
pids=(); bg() { "$@" & pids+=($!); }
join() { local f=0; for p in "${pids[@]}"; do wait "$p" || f=1; done; [ $f = 0 ] || { echo "a retrieval call failed; see stderr" >&2; exit 3; }; }

if [[ $url =~ ^https?://([^/]+)/(.+)/-/merge_requests/([0-9]+) ]]; then
  host=${BASH_REMATCH[1]}; project=${BASH_REMATCH[2]}; iid=${BASH_REMATCH[3]}
  glab auth status --hostname "$host" >/dev/null 2>&1 || { echo "glab not authenticated for $host: run glab auth login --hostname $host" >&2; exit 3; }
  pid=$(jq -rn --arg p "$project" '$p|@uri'); base="projects/$pid/merge_requests/$iid"
  api() { glab api --hostname "$host" "$@"; }
  page() { glab api --hostname "$host" --paginate "$1" | jq -s 'add // []'; }
  api "$base" > "$out/mr.json"
  bg sh_out "$out/commits.json" page "$base/commits?per_page=100"
  bg sh_out "$out/diffs.json" page "$base/diffs?per_page=100"
  bg sh_out "$out/discussions.json" page "$base/discussions?per_page=100"
  bg sh_out "$out/pipelines.json" page "$base/pipelines?per_page=20"
  bg sh_out "$out/approvals.json" api "$base/approvals"
  bg sh_out "$out/diff.patch" glab mr diff "$iid" -R "$host/$project" --raw
  join
  jq -n --arg host "$host" --arg project "$project" --argjson iid "$iid" --arg out "$out" \
    --slurpfile mr "$out/mr.json" --slurpfile d "$out/diffs.json" --slurpfile disc "$out/discussions.json" '
    ($mr[0]) as $m | {
      kind:"gitlab", host:$host, project:$project, iid:$iid, url:$m.web_url, state:$m.state, draft:($m.draft // false),
      sourceBranch:$m.source_branch, targetBranch:$m.target_branch,
      diffRefs:$m.diff_refs, headSha:$m.diff_refs.head_sha,
      cloneUrl:("https://"+$host+"/"+$project+".git"),
      files:[$d[0][] | {path:.new_path, oldPath:.old_path, new:.new_file, deleted:.deleted_file, renamed:.renamed_file,
                         generated:((.generated_file // false) or (.new_path|test("(^|/)(package-lock\\.json|yarn\\.lock|pnpm-lock\\.yaml|go\\.sum|.*\\.snap|.*\\.min\\.js)$|(^|/)(generated|vendor|dist)/")))}],
      discussions:{total:($disc[0]|length),
                   unresolved:[$disc[0][] | select(any(.notes[]; .resolvable and (.resolved|not))) | .id]},
      evidenceDir:$out }' | tee "$out/index.json"

elif [[ $url =~ ^https?://([^/]+)/([^/]+)/([^/]+)/pull/([0-9]+) ]]; then
  host=${BASH_REMATCH[1]}; repo="${BASH_REMATCH[2]}/${BASH_REMATCH[3]}"; n=${BASH_REMATCH[4]}
  gh auth status --hostname "$host" >/dev/null 2>&1 || { echo "gh not authenticated for $host: run gh auth login --hostname $host" >&2; exit 3; }
  page() { gh api --hostname "$host" --paginate "$1" | jq -s 'add // []'; }
  gh pr view "$n" -R "$host/$repo" --json number,url,title,body,state,isDraft,author,baseRefName,headRefName,baseRefOid,headRefOid,commits,files,reviewDecision,mergedAt,closedAt > "$out/pr.json"
  head=$(jq -r .headRefOid "$out/pr.json")
  bg sh_out "$out/diff.patch" gh pr diff "$n" -R "$host/$repo"
  bg sh_out "$out/review_comments.json" page "repos/$repo/pulls/$n/comments?per_page=100"
  bg sh_out "$out/issue_comments.json" page "repos/$repo/issues/$n/comments?per_page=100"
  bg sh_out "$out/reviews.json" page "repos/$repo/pulls/$n/reviews?per_page=100"
  bg sh_out "$out/checks.json" gh api --hostname "$host" "repos/$repo/commits/$head/check-runs?per_page=100"
  join
  jq -n --arg host "$host" --arg repo "$repo" --arg out "$out" --slurpfile pr "$out/pr.json" --slurpfile rc "$out/review_comments.json" '
    ($pr[0]) as $p | {
      kind:"github", host:$host, project:$repo, iid:$p.number, url:$p.url, state:$p.state, draft:$p.isDraft,
      sourceBranch:$p.headRefName, targetBranch:$p.baseRefName,
      headSha:$p.headRefOid, baseBranchSha:$p.baseRefOid,
      note:"merge-base: git -C <clone> merge-base <baseBranchSha> <headSha>",
      cloneUrl:("https://"+$host+"/"+$repo+".git"),
      files:[$p.files[] | {path:.path, additions, deletions}],
      reviewComments:($rc[0]|length), evidenceDir:$out }' | tee "$out/index.json"
else
  echo "unsupported URL: $url" >&2; exit 3
fi
