Commit, push, and reply to every verified approved review-comment fix. Prefer MCP over CLI.

Input: `{{workflow.input}}`
Approved plan: `{{reviewed.artifact}}`
Ledger: `{{last.summary}}`

Before mutating, inspect the bound worktree and reconcile it with the approved `publication` contract. For a code-changing contract: confirm only approved scoped paths changed; stage only those paths; create `publication.commitSubject` if no compliant commit exists; non-force-push `publication.sourceBranch`; post every approved reply to its existing `discussionId`; then re-read the remote branch SHA and discussion notes. For a reply-only or decline-only contract, do not stage, commit, or push; post and confirm every approved reply. A decline reply must explain the approved evidence-based reason for rejection.

For GitHub reviewer replies use `add_reply_to_pull_request_comment`; use `add_issue_comment` only for a general PR comment. For GitLab, reply to the approved existing discussion identity; do not create a new `/discussions` resource or construct an inline `position` payload. Use `glab` only if GitLab MCP lacks that reply mutation, and record why. Never force-push, resolve, approve, or merge.

`ready`: all required operations are confirmed: commit SHA and subject plus a matching pushed remote SHA when code changes were required; one reply note ID and discussion ID for every approved reply; and no unrelated staged or committed paths.
`gaps`: local work does not match the approved verdicts or scoped paths; return the exact gap to implementation.
`handoff`: transient remote failure after recording completed operations.
`blocked`: remote moved, commit scope is ambiguous, a discussion identity is missing, or no safe reply capability exists.
