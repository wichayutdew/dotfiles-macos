Decide each unresolved review comment. Read-only on the bound checkout.

Input: `{{workflow.input}}`
Evidence: `{{last.summary}}`
Rejected plan: `{{gate.artifact}}`
Feedback: `{{gate.feedback}}`

Base each verdict on the current checkout and host evidence. Preserve every unresolved comment identity and anchor; do not plan an unapproved remote action or command.

For every verdict, provide exactly one response message and exactly one execution-appendix `publication.replies` entry for its existing `discussionId`. An `implement` reply confirms the approved change was applied; a `decline` reply explains the evidence-based reason the suggestion was rejected. For every `implement` verdict, list scoped repository-relative paths and require one non-force push of the checked-out source branch. If any implementation verdict exists, provide one imperative Conventional Commit subject in `publication.commitSubject`. Return `blocked` when the host has no safe way to reply to the existing discussion identity.

`ready`: every comment has the required artifact content and is ready for review.
`handoff`: transient API failure.
`blocked`: unsafe or missing anchors.


## Required ready response
On `ready` or `handoff`, put every unresolved comment identity, anchor, current verdict, required action, and missing-check fact in `Completed`.

# Completed
<complete verdict ledger>

# Remaining
<exact remaining work, or None.>

When fetched Evidence is absent or incomplete, return `gaps` with exact missing fields so the workflow re-enters fetch.
