# Separate peer-review dispatch contract

The implementation parent imports its own bundled helper by absolute path. It
does not read the peer skill or resolve the peer skill's dependencies itself.
The helper uses only Node built-ins, so installing this skill independently does
not require sibling directories to import it.

```js
import { pathToFileURL } from 'node:url';
const { dispatchPeerReview } = await import(pathToFileURL(
  `${implementationSkillDirectory}/scripts/dispatch-peer-review.mjs`
));
const peerGate = await dispatchPeerReview({
  Agent: nativeAgentAdapter,
  parentSessionId: runtimeSessionId,
  mrUrl,
  headSha: fetchedMrHead,
  storeRoot: absoluteReviewStoreRoot,
  peerSkillDirectory: absolutePeerSkillDirectory, // optional explicit installation
  model: runtimeModel,
  thinkingEffort: runtimeThinkingEffort,
});
// Refetch through glab; never use the child's claimed current head.
const review = peerGate.verifyCurrent({ mrUrl, headSha: freshlyFetchedMrHead });
// Assess required findings before the Step 8 handoff.
```

## Bind the real Agent capability

`nativeAgentAdapter(request)` must invoke the runtime's actual separate agent
tool as `Agent(skill="dev-peer-review", args=request.args)` and wait for that
specific native run. In a runtime with different tool names, map its spawn and
wait operations to this same contract. This adapter is supplied by the calling
runtime; the Node helper cannot manufacture an Agent capability from a shell.

Return this shape only after observing native completion:

```js
{
  childSessionId, // native spawn/session metadata, never parsed from child text
  runId,          // native run metadata, never parsed from the review JSON
  status: 'completed', // native terminal success; failed/canceled is not completed
  result: { recordPath }, // absolute stored path reported by the child
}
```

The adapter must not run the reviewer in the parent, synthesize native IDs, or
return an old run. Supply `request.args` unchanged to the child. It contains
`mr_url`, `head_sha`, `store_root`, `model`, `thinking_effort`, and dispatcher-created
`dispatch: {dispatch_id, parent_session_id}`. Optional `peer_skill_directory` is
an absolute location passed through without parent-side reads or dependency
resolution. When supplied, the child reads that exact skill bundle; otherwise it
discovers the skill in its own catalog. This supports a freshly checked-out skill
bundle without changing global installs. The child reads its own session/run
IDs from the runtime; if the runtime only exposes them to the dispatcher, the
adapter must deliver those native IDs to that specific child before it reviews.
If reliable IDs or separate execution are unavailable, stop `blocked`.

The child's first action is resolving the peer skill and its dependencies in its
own runtime as described by that skill's preparation step. Missing installation
is a blocker, not permission to ask the implementation parent to review.

## Gate and trust boundary

`dispatchPeerReview` generates a fresh dispatch ID before calling Agent. After
native completion it reads the canonical stored MR record, checks MR/head,
verification status, and all four provenance fields against its retained
dispatch and native lifecycle metadata. It retains the record digest for later
`verifyCurrent` calls; overwrites invalidate handoff even if the metadata matches.

The injected native adapter is trusted integration code. Reviewer-controlled
output, a fabricated adapter, or a JSON file is not native dispatch evidence.
Tests replace this boundary with mocks; those passes never establish a real
agent review. There is intentionally no CLI accepting a record plus self-claimed
"expected" IDs to recreate a successful gate. After losing the live gate on a
parent restart, dispatch a fresh reviewer.

Standalone version-1 review records remain valid in the peer-review store. They
cannot satisfy this implementation handoff without matching dispatched provenance.

## Readable result and publication handoff

Pass caller offline/read-only/draft-only/no-write constraints as accompanying
native child instructions without changing dispatcher-generated identity fields.
The child applies them to both labeling and original-review publication. The
adapter retains the child's readable Markdown and observed summary/inline links
from native completion alongside `recordPath`; display them in the parent's actual
chat reply, preserving the concise findings and receipt-derived `Posted to MR`
section without adding full proof, successful commands or rejected hypotheses.
Keep partial/unconfirmed/skipped/error states and material gaps visible. They are
display material, never a substitute for the stored-record
gate. Show incomplete status and gaps even when the gate rejects handoff.

The review JSON remains immutable after collection. Publication writes separate
native receipts, so the digest/provenance gate remains unchanged. Successful
publication of an incomplete summary does not satisfy the complete-verification
requirement. Original summaries and confirmed inline findings are automatic
unless restricted; existing-comment replies, fixes and resolution remain with
`dev-resolve-review-thread`.
