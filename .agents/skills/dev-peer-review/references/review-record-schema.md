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
- `verification_complete` describes peer-review verification only. CI is
  informational and must not determine it.
- `sources` is optional caller metadata. Use an empty array for direct reviews.
- `writes_performed` must be `false` for the read-only peer-review workflow.
