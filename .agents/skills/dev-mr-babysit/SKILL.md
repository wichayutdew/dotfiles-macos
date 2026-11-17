---
name: dev-mr-babysit
description: "Use when owning a GitLab MR feedback and CI loop: address review comments aggressively, commit and push proven fixes, and stop when exact-head CI passes or a persisted cap/blocker is reached."
---

# MR Feedback and CI Loop

Own one foreground job: resolve threads aggressively, commit/push scoped changes
to the verified MR source branch, wait for exact-head CI, and repeat on failure.
Stop when required CI passes on that head, or on a blocker, cap, merge or closure.
Never merge, approve, deploy, access production, or toggle discussion resolution.

## Authority and input

Accept an MR URL, IID, or current-branch lookup through glab. Resolve ambiguous
targets before work. Invocation of this workflow explicitly selects
dev-resolve-review-thread --aggressive: proven safe in-scope fixes and replies do
not require fresh per-comment confirmation. Explicit caller restrictions always
win. A read-only or draft-only handoff is not permission to mutate: return drafts
or blocked status without replies, code changes, commits or pushes.

Keep ownership in the current foreground session. Do not start another writer,
recursive babysit loop, detached watcher, or background reply process. Read-only
state gathering may follow the invoking harness's delegation rules.

## 1. Bind context and durable limits

Use glab for all GitLab operations. Fetch the current MR, source project/branch,
head SHA, complete paginated discussions, and CI metadata. Keep raw API output
private. Verify authenticated actor, write permissions, local Git source/ref,
clean starting tree and reservation/owner. Do not adopt unrelated dirty files or
unpublished commits. A changed owner, source branch/project, unexpected local
revision or foreign remote head blocks further effects.

Create private persisted job state with schema version, binding, original
startedAt/deadlineAt, iterations/maxIterations, current expected head, phase,
wait/backoff counters, per-comment/fix/reply receipts and pending Git intents.
Save before effects and waits. Resume that same state; never reset counters,
deadline, reply history or effects because a handler failed or an event arrived.
Incomplete/foreign state blocks. Reconcile uncertain effects before any retry.

Defaults (the native adapter parses these environment values):

    MR_BABYSIT_BASE_INTERVAL_SEC=120
    MR_BABYSIT_MAX_INTERVAL_SEC=1200
    MR_BABYSIT_MAX_ITERATIONS=15
    MR_BABYSIT_MAX_WALLCLOCK_MIN=120

Persist the absolute deadline once. Resumes may tighten limits, never silently
extend them. Check time before and after collection/handlers and before every
effect/wait. Count each resolve/push/CI attempt against the same iteration budget.
At either cap, stop and report current evidence, blockers, iterations and
deadline. A new budget requires a separately authorized new job.

## 2. Resolve aggressively

Explicitly invoke:

    dev-resolve-review-thread <MR URL> --aggressive

Select all open threads unless an explicit one-thread scope was supplied. Pass
the exact head/binding, original restrictions, full note sequences and durable
comment receipts. Resolve the skill and its bundled resources in the executing
context; do not assume an installed sibling directory.

Use its per-comment ledger, including every selected followup and bot/human
suggestion. Deduplicate only fixes/proof and confirmed generated replies.
After a head change, revalidate unchanged reviewer notes against current code;
old replies cannot certify a fix that a CI repair has since removed. Preserve
reply history and distinguish current validation from historical response SHA.
The same rule applies to local repairs while the remote SHA is unchanged.
Before dispatching each failed-CI attempt, the loop advances and persists the
resolver state's sourceGeneration, invalidating earlier claim/fix/test proof.
Pass that state through unchanged; never reconstruct it from reply history.
Unverified proof, unsafe scope, permissions, conflicting changes or failed tests
block the loop. Do not publish an unproven fix to make CI move.

On exact-head CI failure, feed that failure into the next attempt. Diagnose and
prove a focused repair within the approved scope. dev-mr-assist --pipeline-failure
may help within this job; pass the deadline/restrictions and return to this owner.
Pass the complete babysitOwner envelope from the loop; assist Step 3.4 returns
tested scoped changes uncommitted and unpublished, with original counters and
deadline. The outer loop alone commits/pushes and updates its expected SHA.
Complete and test that repair before invoking the comment resolver with the
supplied state. Revalidate against the repaired local source, reapply/test any
regressed correction, then return completed. Do not validate first and repair
afterward: the repair could invalidate that proof before publication.
Do not pass --babysit or recursively restart the workflow. If no proven repair
or new review fix is available, stop blocked; do not retry a no-op push or wait
for a pipeline that no push created.

## 3. Commit and push only actual scoped changes

Recheck live head/ownership/permissions after resolution. Inspect dirty paths
and tests; commit only the job's proven in-scope changes with a Conventional
Commit. If clean, skip both commit and push and inspect existing current-head CI.

Push the exact new commit to the verified MR source project/branch, never a
default remote/branch inferred from cwd. The native adapter must enforce both
fast-forward ancestry and an expected-remote-head guard; block if it cannot
guarantee them. Never force an unrelated update or absorb another writer's head.
Persist commit/push intent, native evidence and the new exact expected head.
A failed/uncertain commit or push stops for read-only reconciliation, not retry.

## 4. Check CI for that exact head

Read pipeline/job results with glab. An old-head green result is not success.
Require the current source head and all required jobs/checks to have passed.
For a merged-result pipeline, retain the synthetic SHA and authoritative source
association; if that association cannot be proved, report unverified.

- Exact head + all required checks success: stop the CI loop and report it.
- Exact-head failure: return to Step 2 within the same persisted budget.
- Manual/blocked/canceled/skipped required execution or unknown proof: stop
  blocked. Never trigger a manual/deployment job or guess that it is optional.
- Running/pending exact-head pipeline, or waiting for a confirmed new push's
  pipeline: use only a supported bounded wait below.
- No exact-head pipeline and no confirmed push: stop blocked, not a no-op wait.

An independent-review handoff remains separate from CI. New commits invalidate
the old reviewed SHA. Preserve dev-implement-ticket's separate-Agent dispatch and
record gate: rerun its Step 7 on the new head before claiming reviewed readiness.
A label or a green pipeline alone never satisfies that review gate.

## 5. Bounded waiting, including no events

A subscription expiry is NOT a timer wakeup. A job must terminate by its persisted
deadline even when no pipeline/MR event ever arrives.

- A foreground harness with real timer support may use the bundled
  [CI-loop helper](references/loop-contract.md). It races a cancellable wait with
  an actual timer and clamps every wait to min(backoff, deadline-now). Abort the
  native waiter on every return. Stop at the deadline; no interval overshoot is
  intentionally allowed.
- CodeMaster external waits must use the installed codemaster-ping-me skill,
  and only when an independently verified deadline callback can wake this same
  job at the persisted deadline. Reuse matching live subscriptions; retain both
  event-subscription and independent deadline-callback evidence/IDs in state.
  A ping-me --timeout/expiry alone does not provide that callback.
- This package ships no native CodeMaster deadline-callback adapter. Its
  executable helper therefore rejects CodeMaster/event-only waits as
  **bounded wait unsupported** before subscribing. Report the pending CI,
  deadline and limitation and STOP; do not register an event-only wait, sleep in
  the workspace, invent a timer callback, or leave a detached watcher.

On any supported resume, check original caps before collection. A pending CI
phase resumes CI inspection; it does not reprocess replies, repeat fixes, or
push again. Preserve the same backoff counter; clamp to the remaining budget.

## Report

Return MR/source branch, exact expected/pushed SHA, per-comment dispositions,
local checks, confirmed commit/push receipts, exact-head pipeline/job evidence,
phase, iteration count, original deadline and remaining blocker. Distinguish
CI-passed from review freshness, approvals and merge readiness. No automatic
/review trigger, readiness label, reviewer assignment, merge or approval is part
of this replacement workflow.

The helper provides orchestration and foreground timing. Live validation,
GitLab effects, Git operations, persistence and permission/ownership checks are
trusted runtime integrations supplied by the caller. Tests of those hooks are
not evidence that live GitLab writes, native waits or a real MR CI loop ran.
