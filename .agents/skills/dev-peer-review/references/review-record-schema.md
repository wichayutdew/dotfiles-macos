# Peer-review record schema

Each successful review writes one JSON object with `schema_version: 1`.

```json
{
  "schema_version": 1,
  "identity": {
    "hostname": "gitlab.example.com",
    "project_path": "group/project",
    "repository": "project",
    "iid": 123,
    "target": "https://gitlab.example.com/group/project/-/merge_requests/123"
  },
  "reviewer": {
    "username": "reviewer",
    "name": "Reviewer Name",
    "user_id": 456
  },
  "mr": {
    "title": "Short title",
    "state": "opened",
    "draft": false,
    "head_sha": "0123456789abcdef",
    "author": {"username": "author", "name": "Author Name"},
    "assignees": [],
    "pipeline": {"status": "success", "url": "https://gitlab.example.com/pipeline/1"},
    "approved_by_reviewer": false,
    "refreshed_at": "2026-09-17T10:00:00.000Z",
    "refresh_error": null,
    "terminal": false,
    "terminal_at": null
  },
  "sources": [
    {
      "label": "Team channel",
      "conversation_url": "https://example.slack.com/archives/C123",
      "message_url": "https://example.slack.com/archives/C123/p123",
      "thread_url": "https://example.slack.com/archives/C123/p123"
    }
  ],
  "review": {
    "model": "gpt-6.1 sol",
    "thinking_effort": "High",
    "reviewed_at": "2026-09-17T10:00:00.000Z",
    "head_sha": "0123456789abcdef",
    "verdict": "Code clear; ready to approve",
    "material_mr_body_evidence": [],
    "unique_peer_findings": [],
    "rejected_hypotheses": [],
    "verification": [],
    "verification_complete": true,
    "verification_gaps": [],
    "access_blocked": false,
    "draft_comments": [],
    "draft_actions": [],
    "review_threads_considered": false,
    "writes_performed": false
  }
}
```

## Required fields and meaning

- `identity.hostname`, `identity.project_path`, `identity.iid`, and
  `identity.target` identify the MR and determine its storage path.
- `reviewer.username` is the authenticated GitLab user for whom ownership and
  approval are evaluated.
- `mr` is a refreshable snapshot. The summary renderer updates it through
  `glab`; it never changes `review`.
- `review.head_sha` records the exact revision reviewed. A different
  `mr.head_sha` makes the review stale.
- `review.model` and `review.thinking_effort` record the runtime or caller-provided
  metadata for this review, independently of label attachment. Use the same values
  as the label (for example, `gpt-6.1 sol` and `High`). Set an unavailable value
  to `null`; never guess it. Each field must be a non-empty string or `null`.
  Existing version-1 records may omit these fields; the storage script accepts
  them and writes `null` for missing metadata. Re-reviews record the current run's
  values rather than inheriting the previous model or effort.
- `verification_complete` describes peer-review verification only. CI is
  informational and must not determine it.
- `sources` is optional caller metadata. Use an empty array for direct reviews.
- `writes_performed` must be `false`: schema version 1 records the independent
  collection phase, during which no review-content or source-code writes occur.
  The separate automatic label step is recorded in `verification` and label
  failures in `verification_gaps` before persistence. Later original-review
  publication has its own native receipts outside this immutable collection
  record. Never flip this field or rewrite gated bytes after publication.
- `unique_peer_findings` accepts existing version-1 entries. For readable counts
  and publication, use the additive structured finding contract in
  [publishing.md](publishing.md). Only proven `status: "confirmed"` entries count
  as confirmed and can be posted inline. Legacy/unverified entries remain visible
  and make the readable report incomplete until independently verified.
- `verification_gaps` may contain a label error even when review verification is
  complete. Do not infer incompleteness from nonempty gaps or failed CI alone.
  Set `verification_complete` false when required review proof is missing.

## Optional dispatched-review provenance

Standalone version-1 records remain valid without this field. A review dispatched
by `dev-implement-ticket` must additionally store:

```json
"dispatch": {
  "dispatch_id": "fresh-id-created-by-dispatcher",
  "parent_session_id": "native-implementation-session",
  "child_session_id": "native-reviewer-session",
  "run_id": "native-reviewer-run"
}
```

This object is inside `review`. All four values must be non-empty strings, and
the child session must differ from the parent. The store validates their shape
only; it does not attest native execution. The implementation dispatcher compares
them with its own fresh dispatch context and actual Agent spawn/wait metadata,
checks exact MR/head and completed verification, and gates handoff. A valid
standalone record or arbitrary provenance cannot substitute for that dispatch.
