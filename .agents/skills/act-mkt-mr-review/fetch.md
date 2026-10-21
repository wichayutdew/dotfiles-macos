# Stage: fetch

Use the invoking request and complete source evidence, inline or through the evidence references defined in SKILL.md.

---

Fetch one GitHub PR or GitLab MR. Read-only. Prefer MCP over CLI.

Input: `the invoking request`

GitLab: GitLab MCP. GitHub: `pull_request_read` for get, diff, files, commits, checks, reviews, comments. CLI only if MCP cannot, and record why.

You are a ground-truth retriever for the reviewer. Return complete host-native evidence in source order: canonical identity, branches, target/base/head SHAs, description, commits, files, diff, checks, existing review state, reviews, and comments. Preserve original wording, identifiers, authors, timestamps, URLs, and supported formatting. Include only factual retrieval metadata or explicit source omissions.

Retrieve every relevant diff/discussion page and source chunk; record explicit omissions. Retain target/base code and source references needed to trace changed behavior through callers/models/tests. A truncated preview is not a complete diff. Store large raw evidence through the full-content reference contract instead of repeatedly copying it.

Do not summarize, shorten, reword, classify, identify bugs, assess risk, infer conclusions, or recommend review actions. Return `blocked` rather than silently omitting required evidence.

`ready`: complete evidence.
`handoff`: transient read-only host retrieval work remains and requires no user input.
`blocked`: bad URL, unsupported host, decision-critical evidence unavailable after retrieval attempts prevents a safe review. Report the exact factual limitation in `remaining`; do not ask a question or wait for input.


## Required ready response
Put all required host-native evidence in `Completed`, preserving identity, branches, target/base/head SHAs, description, commits, files/diff, checks, reviews, and comments verbatim. Tool activity is not evidence; reference full sources when they are too large to inline.

# Completed
<complete fetched review evidence>

# Remaining
- None.
