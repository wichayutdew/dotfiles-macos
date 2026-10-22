# Stage: fetch

Use the invoking request and complete source evidence, inline or through the evidence references defined in SKILL.md.

---

Fetch one GitHub PR or GitLab MR. Read-only on the host. Use the `glab`/`gh` CLI per [Host CLI](../generic/host-cli.md); code comes from the local clone, never from remote code search.

Input: `the invoking request`

Run `bash scripts/fetch-mr.sh <url> <run-dir>/fetch`. It writes metadata, commits, diffs, raw `diff.patch`, discussions/review comments, reviews and pipelines/checks to files and prints `index.json` (identity, state, diff refs/head SHA, files with a `generated` flag, unresolved discussion IDs). Use MCP only if `glab`/`gh` is missing or unauthenticated, and record why.

Capture pipeline/check status once without polling or waiting for completion. A pending, failed, or unavailable pipeline does not block fetching the diff or continuing the review; record it as context.

You are a ground-truth retriever for the reviewer. Return complete host-native evidence in source order: canonical identity, branches, target/base/head SHAs, description, commits, files, diff, checks, existing review state, reviews, and comments. Preserve original wording, identifiers, authors, timestamps, URLs, and supported formatting. Include only factual retrieval metadata or explicit source omissions.

The script paginates every diff/discussion page; record explicit omissions. Then prepare the local clone per [Local code access](../generic/local-code-access.md): `bash scripts/repo-sync.sh <index.cloneUrl> ~/repositories/mr-review <index.headSha> --mr <iid>` (GitHub: `--pr <n>`). Record its `{dir, sha}` and the base SHA (GitHub: `git -C <dir> merge-base <baseBranchSha> <headSha>`). A truncated preview is not a complete diff. Store large raw evidence through the full-content reference contract instead of repeatedly copying it.

Do not summarize, shorten, reword, classify, identify bugs, assess risk, infer conclusions, or recommend review actions. Return `blocked` rather than silently omitting required evidence.

`ready`: complete evidence.
`handoff`: transient read-only host retrieval work remains and requires no user input.
`blocked`: bad URL, unsupported host, decision-critical evidence unavailable after retrieval attempts prevents a safe review. Report the exact factual limitation in `remaining`; do not ask a question or wait for input.


## Required ready response
Put `index.json`, the evidence directory path and the local clone `{dir, sha}` in `Completed`; the files are the verbatim evidence (identity, branches, SHAs, description, commits, files/diff, checks, reviews, comments). Tool activity is not evidence.

# Completed
<complete fetched review evidence>

# Remaining
- None.
