# Real-package transport probing

Use when a hypothesis depends on actual SDK semantics: singleton initialization, context mutation, buffering, workers, batching, capacity, cancellation, persistence, or interaction with asynchronous application gates. This recipe establishes bounded runtime behavior. It does not independently establish production exposure or causal population loss.

## 1. State the discriminating question

Write the competing predictions before constructing a harness. Examples:
- Does repeated initialization create independent instances, or return the same singleton while mutating context?
- Does a synchronous option cause immediate network dispatch, or only main-thread-to-worker handoff?
- Does cancellation reject a promise, fulfill it with no value, or fulfill it with a wrapper whose result is absent?
- Does an application gate delay event creation, change its position behind competing work, or both?

Choose the smallest seam retaining the behavior under question. Do not replace the queue, worker, promise implementation, or observer you are trying to diagnose with an imitation.

## 2. Record provenance and substitutions

Capture application revision, lockfile/resolved versions, actual bundle and source-map paths, configuration, runtime, and build identity where available. Installed packages are not automatically historical production packages.

List which parts are real and which are controlled: browser versus JSDOM, real versus emulated worker, genuine application helpers versus extracted/transpiled helpers, synthetic components, synthetic API completion, clocks, and transport interception. Do not describe an extracted-helper harness as a full-page reproduction.

Prefer an isolated temporary directory or existing investigation seam. Do not mutate the production dependency graph, send telemetry to a real collector, or modify production configuration to obtain a local reproduction.

## 3. Intercept safely at a named boundary

Use supported package fake mode or a controlled transport adapter while preserving the implementation being investigated. Fail closed on unexpected outbound destinations. Capture serialized payloads, message identifiers, queue IDs, sequence numbers, batch boundaries, and the intercepted operation.

Name what the interception observes: request construction, adapter invocation, dispatch to a local server, or actual receipt. Returning a synthetic successful response establishes neither real network timing nor production ingestion. Control response latency/failure deliberately; clean up workers, timers, listeners, and the temporary harness after saving required evidence.

## 4. Map actual topology

Trace the real chain:

`event creation → main-thread buffer → worker startup/handoff → queue routing → batch selection/serialization → transport → acknowledgement/retry/persistence`

Verify capacity and overflow policy, initial flush scheduling, subsequent flush scheduling, acknowledgement dependence, concurrency, retries/backoff, persistence, and lifecycle flushes where relevant. Inspect implementation and confirm the disputed behavior with runtime observations.

A configured batch size and interval do not establish a fixed messages-per-second rate or a maximum latency. A count near the batch size is not proof of packet boundaries. `sync` is a package-specific option, not a promise of immediate HTTP delivery.

## 5. Run controls before combining mechanisms

Use fresh state per scenario so cached promises, globals, and singleton context do not contaminate arms. Repeat matched controls where scheduling varies. Exercise applicable cases:

| Question | Discriminating controls |
|---|---|
| Initialization | One versus repeated calls; object identity, context, sender identity, and message counts |
| Startup/configuration | Both arms with normal/delayed worker startup and absent/present/malformed bootstrap |
| Contention | No burst, one burst, multiple bursts; verify sent, serialized, dropped, and deferred counts separately |
| Gate interaction | Gate open/closed under otherwise identical schedules; then combine with competing work |
| Lifecycle | Pending, fulfilled, rejected, cancelled, hidden, and reused/already-settled measurements |
| Delivery | Fast/slow/failing acknowledgement, retry, capacity overflow, and persistence/recovery where supported |
| Ownership/observers | Current/stale contexts, repeated navigation, DOM discovery versus visibility triggers |

Inspect the resolved value's actual shape in each lifecycle branch. A truthy wrapper may hold an undefined result. A rejection method name does not prove the returned promise rejects. Do not prescribe a guard until the actual caller contract and failure behavior have been exercised.

Change one variable at a time to discriminate causes, then construct the combined scenario. Record imposed API/LCP/input schedules as synthetic inputs, not measured production behavior.

## 6. Define every clock

Capture a common monotonic origin for the local probe, plus available boundaries: event creation, handoff, batch serialization, request construction, dispatch, and response. Record absolute times and named differences separately.

For example, `requestAt - eventAt` is event-to-request duration; it is not request time relative to navigation. Pre-event API waiting can change message order but is outside that duration. Do not call intercepted request construction 'collector receipt'.

When comparing with warehouse timestamps, verify field semantics, timezone/synchronization, and event identity. Do not pair the earliest creation of one event with the earliest receipt of another. Do not splice local probe times and production medians into one supposedly observed journey.

## 7. Produce a bounded verdict

Deliver:
1. Question, alternatives, source/package provenance, and real/substituted seam inventory.
2. Reproduction command, input schedule, controls, and retained result artifacts.
3. Observed messages/batches, identity checks, loss/capacity accounting, and clock-labelled timings.
4. Verdict scoped to the tested configuration, including counterexamples and variation.
5. Unproven boundaries: full browser behavior, abandonment, persistence recovery, historical exposure, or population contribution.

If claiming early-exit loss, actually exercise close/background/navigation at the relevant boundary and check recovery; otherwise describe it only as a conditional scenario. If claiming production contribution, hand off the mechanism and limits to the main RCA ledger for exposure and distinct-user reconciliation.

The historical ACT-6100-MOBILE example is retained separately at `skill://dev-paint-user-journey-impact/references/act-6100-mobile-case-study.md`. Its numerical settings are not defaults for this procedure.
