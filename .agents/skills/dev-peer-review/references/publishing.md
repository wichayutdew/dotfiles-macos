# Readable output and original-review publication

Read after independent evidence collection and before publishing. This helper
creates original review summaries and findings. Existing-comment validation,
replies, source fixes and resolution remain with `dev-resolve-review-thread`.

## Finding contract

Keep `schema_version: 1`. Add structured entries to `review.unique_peer_findings`:

```json
{
  "id": "empty-search-result",
  "status": "confirmed",
  "blocking": true,
  "title": "Empty search result crashes",
  "problem": "The result is dereferenced before its presence is checked.",
  "trigger": "Search returns zero rows.",
  "evidence": ["node repro.mjs reproduces TypeError at src/search.js:42"],
  "fix": "Return early when the result is absent.",
  "location": {"path": "src/search.js", "line": 42},
  "position": {"old_path": "src/search.js", "new_path": "src/search.js", "new_line": 42}
}
```

`id` is stable across reviews of the same issue; never reuse it for a different
issue. Revalidate it independently at each head. `confirmed` means actionable and supported by bounded proof. All
other statuses, including `unverified`, remain visible but cannot contribute to
confirmed counts or inline publication. Legacy free-form entries still render,
but require explicit structured confirmation before publication as findings.
Every confirmed entry requires a unique nonempty ID, title, problem, reachable
trigger, nonempty evidence array, smallest fix and boolean blocking status.

Location and position are optional. Preserve a human-readable location when
inline placement is unavailable. The publisher checks positions against current
GitLab diff paths, hunk lines and diff refs. Added lines use `new_line`; deleted
lines use `old_line`; unchanged context lines require both. Renames retain both
paths. Unsupported, collapsed, missing and invalid positions stay in the summary;
the helper never invents a position. It does not fall back from a failed or
uncertain inline POST to another write.

## Run the bundled helper

Use the child-local resolver's `publishScript` and `publishingPath` resources.
Persist the collection record first. Use a single stable state path per MR and
reviewer, separate from the review JSON, so subsequent SHAs retain receipts:

```text
node <absolute-publishScript> <absolute-record.json> <absolute-publication-state.json>
node <absolute-publishScript> <absolute-record.json> <absolute-publication-state.json> --render-only
```

For example, put the publication file alongside `<iid>.json` as
`<iid>.publication.json`. Its parent directory must already exist. Keep the state
file when replacing the review record on re-review. Never use the review path,
a symlink or a hardlink to it as the publication path.

Default execution automatically posts confirmed inline findings then a summary.
`--render-only`, `--offline`, `--read-only`, `--draft-only` and `--no-writes` all
render without network access or publication-state writes. Caller restrictions
must be carried into this command; they also suppress the skill's separate label
step. Raw JSON remains in local files unless explicitly requested.

Default chat and MR summaries are concise: status, MR/SHA/counts, short
finding/location/fix lines, review/CI state and all material gaps. Successful
command lists, full proof/trigger/problem text and rejected hypotheses remain in
the local record; original inline comments retain full finding detail. Return
that detail only when requested, without truncating critical gaps or errors.

Chat adds `## Posted to MR`: the observed summary's actual headline plus native
link and the current review's observed inline titles plus native links. Read
these brief labels from receipt bodies, even if an inline is reused and its old
title differs from the current draft. Escape external Markdown link labels. Do
not copy full posted bodies or show unrelated historical findings. State
no-post/skipped/failed/unconfirmed/partial results accurately. A failed summary
can coexist with confirmed inline posts; an uncertain update shows the last
confirmed summary content, not the unconfirmed new draft. The MR summary excludes
this bookkeeping section (`renderReview(record, {state, destination: 'mr'})`).

The API exports `renderReview(record, publication)` and
`publishReview({record, state, hooks, restrictions})`. Restrictions accept
`offline`, `readOnly`, `draftOnly`, `noWrites`, or `publish: false`. Hooks are
trusted integration code: `getContext`, `listNotes`, `listDiscussions`, `save`,
`createInline`, `createSummary`, and `updateSummary`. The CLI supplies real
`glab` hooks and atomic persistence. `getContext` supplies authenticated actor,
current head, MR state, diff refs and complete paginated diffs; each effect has a
fresh guard. The production adapter uses argv plus stdin JSON (`--input -`),
explicit hostname and complete pagination. It never shells comment bodies.

## Durable receipts and retry rules

The publisher never edits the collection record. Its separate state contains:

- `schema_version: 1` and `binding`: exact MR identity plus reviewer username/ID.
- `summaries`: reviewed-SHA keys with observed native note ID, author and body.
- `findings`: stable-ID hashes with observed native note ID, discussion ID,
  author, body and position. Fresh proof and moved line numbers do not duplicate
  an independently reconfirmed issue. Its current summary carries a short current
  action/location and links to the historical original inline comment; newly
  verified full evidence remains in the local record.
- `pending`: durable intent written before an effect, including kind, key,
  reviewed SHA, exact body, position for inline creation, and note ID for updates.

A successful receipt requires native ID, matching authenticated author and exact
body; inline effects also require the expected native position. The helper reads
native summary and original inline notes only after independent review is
complete. This history is publication bookkeeping, never review evidence.

Same-SHA retries reuse the marked summary; completing an incomplete review
updates that native note. A new SHA creates a new summary and preserves history.
Unchanged original inline findings are reused across heads; no discussion is
resolved or replied to. Current summaries link only to observed inline receipts.

A lost response leaves `pending` intact. On the next run, reconcile it against
paginated native notes/discussions by marker, author, exact body, note ID for
updates, and expected inline position. One matching native effect recovers its
receipt; no match, multiple matches or a mismatch blocks further effects. An
absent result after a timeout is not proof that a POST failed. Do not clear intent
and retry blindly. Resolve uncertain outcomes through read-only inspection and
explicit operator reconciliation before allowing another effect.

Head or actor drift stops further effects and preserves observed receipts. If
a guard blocks before a request was sent, its known-unsent intent is cleared; an
actually attempted request remains uncertain until native reconciliation.
Publication errors return `blocked` and CLI exit code 1, while keeping the review
report and pending intent. `published` means summary and applicable inline effects
were observed; review verification may still be incomplete. CI and label failures
do not by themselves change `verification_complete`.

The CLI serializes a state path with an exclusive `.lock` file. A concurrent run
fails closed. After an interrupted process, verify it has stopped and reconcile
any pending native effect before removing a stale lock; never auto-delete locks
or receipts to force a retry. Use the same state path for a given MR/reviewer;
GitLab provides no transactional uniqueness guarantee for simultaneous publishers
using different state files. Head checks cannot make GitLab writes atomic with
concurrent pushes; drift observed after a write is reported as blocked.

All external Markdown text is quoted line by line so embedded GitLab quick
actions remain prose. The helper does not approve, merge, label, resolve, push,
change source, or route original findings through the existing-comment resolver.

## API contracts and local validation

- [GitLab Notes API](https://docs.gitlab.com/api/notes/): create a summary with
  `POST .../notes`, update the same SHA's note with `PUT .../notes/:note_id`.
- [GitLab Discussions API](https://docs.gitlab.com/api/discussions/): create an
  original inline thread with `POST .../discussions`, body and text position
  containing base/start/head SHAs and the correct old/new paths and lines.
- `glab api --help`: `--input -` reads request JSON from stdin; `--paginate`
  fetches all pages. The adapter parses the adjacent JSON page arrays.

Run `node --test skills/dev-peer-review/tests/publish-review.test.mjs` offline.
Tests exercise production rendering, state transitions and the CLI through a
fake local glab executable. They do not prove behavior on a live GitLab instance;
a live smoke check requires a separately designated MR and authorization.
