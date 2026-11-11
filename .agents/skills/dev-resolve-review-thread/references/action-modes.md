# Executable per-comment resolver

Import scripts/resolve-comments.mjs by absolute path from this installed skill.
Its only skill dependency is the bundled normalize-discussions.mjs. It exports:

    resolveComments({
      context, discussions, hooks,
      scope: { type: 'all-threads' }, // or one-thread + discussionId
      actionMode: 'passive',         // explicit aggressive enables effects
      restrictions: {}, state: {}
    })

context binds target MR URL, sourceProject, sourceBranch, reservation owner,
authenticated actorUsername and exact headSha. discussions is the complete
paginated raw or normalized array. Return status is drafted/completed/blocked,
with per-note results, evidenced exclusions, reason and updated state.

Trusted integration hooks:

- getContext(): independently refetch the binding/head and canWrite boolean.
- validate(comment, context): read-only bounded proof; return verdict, reason,
  evidence array. Proven fixes also need fixKey, safe=true, inScope=true.
  valid_claim_bad_fix requires a proven safe alternative.
  At a new head, validate previously replied unchanged notes again. Set
  replyStillApplicable=true only with current-head proof that the historical
  response remains applicable and no new fix is needed. That flag never skips
  a valid fix or permits missing proof.
- applyFix(claim, context): apply the scoped local correction only.
- testFix(claim, context): return passed=true and concrete evidence after checks.
- reply({discussionId, noteId, body, headSha}, context): use glab to reply in the
  selected discussion; return native noteId, authorUsername and exact body.
  No resolve-state or approval endpoint is exposed.
- save(state): atomically persist private state, mandatory for aggressive mode.

Read-only validation must not patch even scratch. The helper never invokes
mutation/test-fix/reply hooks in passive mode. It drafts every selected note and
stops. Aggressive requires complete proof before effects; replies happen after
all fixes pass tests, and head/ownership/permission checks precede each effect.

Keep state across heads/resumes. Fix receipts are keyed by exact head, durable
sourceGeneration and proven root cause. Reply receipts are keyed by unchanged
original comment identity/body; a new followup gets a new ledger entry.
Already-replied notes avoid repeated
work only when validatedHeadSha matches the current head (legacy records use
their reviewedHeadSha) AND validatedSourceGeneration matches sourceGeneration
(both default to zero for older state). New heads/generations require new
validation, including when an approved CI repair removed the old fix.
Unavailable proof blocks completion.

The caller must advance and persist state.sourceGeneration before an owned
local repair, finish/test that repair, THEN invoke this resolver on the supplied
state. The babysit loop enforces this invalidation before every failed-CI
handoff, even with unchanged remote SHA. Do not reuse stale claim/fix/test proof
or reset the ledger; native reply receipts remain historical evidence.

A current proven replyStillApplicable=true claim with no new fix may reuse the
old post. Results keep its original reviewedHeadSha and historicalReply while
current verdict/evidence, validatedHeadSha and validatedSourceGeneration identify
the fresh proof. A valid regressed suggestion gets a current-head tested fix and
fresh reply. Superseded handled entries remain in handledHistory; replies remain
append-only native receipts, including commentKey/reviewedHeadSha for new posts.
Unchanged-source/head/generation resumes do not revalidate, refix or repost
completed notes. Own generated notes
are excluded only when note ID, author and body hash match confirmed evidence.

A pending fix/reply is an uncertain external/local effect. Reconcile source,
tests and native note history read-only before clearing it; never clear intent
just to retry. If a hook or atomic save fails, report blocked. Runtime hooks must
respect caller restrictions and the remaining job deadline; they are not
reviewer-supplied code. No shell CLI fabricates these integrations.
