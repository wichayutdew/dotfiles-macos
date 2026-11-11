# Executable bounded CI loop

Import scripts/babysit-loop.mjs by absolute path from this skill. It uses only
Node built-ins and does not import sibling skills. The caller resolves
dev-resolve-review-thread in its runtime and binds the resolve hook to that
skill's resolveComments API (or equivalent native skill execution).

    runBabysit({
      context, hooks, state, restrictions,
      limits: { maxIterations: 15, wallclockMs: 7200000,
                intervalMs: 120000, maxIntervalMs: 1200000 },
      waiter: { kind: 'foreground-timer', wait: nativeCancellableWait }
    })

context has target MR URL, sourceProject, sourceBranch, reservation owner,
authenticated actorUsername and exact headSha. On resume, supply the saved head
and full saved state; never replace it with a newly observed foreign head.
Return status is passed/capped/blocked/closed with reason and retained state.

Trusted runtime hooks:

- now(): epoch milliseconds, defaults to Date.now.
- save(state): atomic private persistence, including pending intents.
- getContext(): independently verify binding, source/local refs, reservation,
  permissions (canWrite), remote headSha and mrState. Reject unexpected local
  commits/dirty baseline. Recheck after network/handler returns.
- resolve({actionMode, context, restrictions, state, failedPipeline, deadlineAt,
  babysitOwner}): explicitly
  aggressive per-comment resolver; preserve all restrictions/receipts. If the
  previous pipeline failed, complete/test the scoped CI repair FIRST, then call
  the resolver on that local source, or report blocked. Never repair after the
  validation whose evidence will authorize publication.
  Return completed only after required proof/fixes/tests/replies are accounted
  for. Return the resolver state for durable recovery.
  babysitOwner carries context, startedAt/deadlineAt and iterations/maxIterations.
  Pass it unchanged to dev-mr-assist --pipeline-failure, whose Step 3.4 and
  finishPipelineRepair return tested local changes without committing/pushing.
  This loop alone performs the guarded publication; never reset its budget.
  Before each failed-CI dispatch the loop advances and saves
  state.sourceGeneration in the resolver ledger. Pass that actual state to
  resolveComments and return its updated state. The resolver consumes the
  generation for claim AND fix/test cache identity even if remote headSha has
  not changed. Keep reply history; do not copy old proof into the new generation.
- isDirty(): boolean after verifying every changed path belongs to this job.
- commit({sourceBranch, deadlineAt}): commit only scoped verified changes and
  return the observed new local SHA. Never claim a preexisting commit is new.
- push({sha, sourceBranch, sourceProject, expectedHead, deadlineAt}): enforce
  fast-forward ancestry plus an exact remote-head guard; return confirmed
  headSha after readback. Do not force an unrelated update.
- getPipeline({headSha, sourceBranch, deadlineAt}): fresh exact-source-head
  evidence. Return headSha, id, status, manualGate and requiredChecksPassed.
  Success requires requiredChecksPassed=true. Normalize merged-result identity
  only after authoritative source association; preserve raw/synthetic evidence.

All hooks are trusted native integrations, never reviewer-controlled functions.
Bound each operation to the remaining deadline using its native timeout or
cancellation support. The helper checks time around handlers but cannot preempt
a blocking native write safely. Unconfirmed effects stay pending and require
reconciliation before retry. A restricted/read-only caller blocks before resolve.

For foreground waits, wait({timeoutMs, deadlineAt, signal}) must honor AbortSignal
and release native resources. The helper supplies the actual timer race, clamps
the interval to the persisted deadline, and aborts the waiter on event, timeout
or failure. A never-resolving event promise still reaches the deadline.

No CodeMaster event/deadline adapter ships here. Passing kind=codemaster-event
(or no timer capability) returns bounded wait unsupported before any subscribe.
A later native external integration would need the installed codemaster-ping-me
skill plus an independently verified deadline wakeup; subscription expiry and
self-claimed capability flags do not establish it.

A CI-phase resume polls CI without repeating resolution/push. A failed pipeline
returns to the next attempt, preserving counters. A clean attempt after failed
CI blocks rather than waiting for a nonexistent new pipeline. Manual or unknown
required checks block. Losing or corrupting persisted state is not permission
to restart the same job's budget.
