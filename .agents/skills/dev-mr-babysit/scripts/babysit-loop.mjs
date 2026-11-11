const fields = ['target', 'sourceProject', 'sourceBranch', 'owner', 'actorUsername'];
const stop = (reason, status = 'blocked') => { throw Object.assign(new Error(reason), { status }); };

// Native wait must honor AbortSignal; no detached watcher survives this scope.
async function boundedForegroundWait(waiter, timeoutMs, deadlineAt) {
  if (waiter?.kind !== 'foreground-timer' || typeof waiter.wait !== 'function') {
    stop('bounded wait unsupported: event subscriptions need an independent deadline wakeup');
  }
  const controller = new AbortController();
  let timer;
  try {
    await Promise.race([
      new Promise(resolve => { timer = setTimeout(resolve, timeoutMs); }),
      Promise.resolve().then(() => waiter.wait({ timeoutMs, deadlineAt, signal: controller.signal })),
    ]);
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}

export async function runBabysit({ context, hooks, waiter, restrictions = {}, limits = {}, state }) {
  const now = hooks.now ?? Date.now;
  const binding = Object.fromEntries(fields.map(field => [field, context[field]]));
  const save = () => hooks.save(state);
  const timeGuard = () => { if (now() >= state.deadlineAt) stop('deadline reached', 'capped'); };
  const iterationGuard = () => {
    timeGuard();
    if (state.iterations >= state.maxIterations) stop('iteration cap reached', 'capped');
  };
  const current = async () => {
    timeGuard();
    const live = await hooks.getContext();
    timeGuard();
    if (fields.some(field => live[field] !== state.binding[field]) || live.headSha !== state.headSha) {
      stop('Changed ownership, source branch/project, or MR head');
    }
    if (['merged', 'closed'].includes(live.mrState)) stop(`MR ${live.mrState}`, 'closed');
    if (live.canWrite !== true) stop('Write permission unavailable');
    return live;
  };
  try {
    for (const key of ['wallclockMs', 'maxIterations', 'intervalMs', 'maxIntervalMs']) {
      if (limits[key] !== undefined && (!Number.isFinite(limits[key]) || limits[key] <= 0 ||
          (key === 'maxIterations' && !Number.isInteger(limits[key])))) stop(`Invalid ${key}`);
    }
    if (fields.some(field => typeof context[field] !== 'string' || !context[field]) || !context.headSha) {
      stop('Verified MR and ownership context required');
    }
    if (state === undefined) {
      const startedAt = now();
      if (!Number.isFinite(startedAt) || !Number.isFinite(startedAt + (limits.wallclockMs ?? 7200000))) {
        stop('Invalid deadline clock');
      }
      state = { schema_version: 1, binding, headSha: context.headSha, startedAt,
        deadlineAt: startedAt + (limits.wallclockMs ?? 7200000), iterations: 0,
        maxIterations: limits.maxIterations ?? 15, intervalMs: limits.intervalMs ?? 120000,
        maxIntervalMs: limits.maxIntervalMs ?? 1200000, phase: 'resolve', waitCount: 0, pending: null };
      await save();
    } else if (state.schema_version !== 1 || !Number.isFinite(state.startedAt) ||
        !Number.isFinite(state.deadlineAt) || !Number.isInteger(state.iterations) || state.iterations < 0 ||
        !['resolve', 'ci'].includes(state.phase) || !Number.isInteger(state.waitCount) || state.waitCount < 0 ||
        !state.binding || fields.some(field => state.binding[field] !== binding[field]) || state.headSha !== context.headSha) {
      stop('Saved babysit context is incomplete or changed; do not reset caps');
    }
    for (const key of ['maxIterations', 'intervalMs', 'maxIntervalMs']) {
      if (!Number.isFinite(state[key]) || state[key] <= 0 ||
          (key === 'maxIterations' && !Number.isInteger(state[key]))) stop(`Invalid saved ${key}`);
    }
    if (state.deadlineAt <= state.startedAt) stop('Invalid saved deadline');
    // A resume may tighten limits but cannot extend the original budget.
    if (limits.maxIterations !== undefined) state.maxIterations = Math.min(state.maxIterations, limits.maxIterations);
    if (limits.wallclockMs !== undefined) state.deadlineAt = Math.min(state.deadlineAt, state.startedAt + limits.wallclockMs);
    iterationGuard();
    if (restrictions.readOnly || restrictions.codeChanges === false || restrictions.replies === false || restrictions.push === false) {
      stop('Explicit caller restrictions prevent aggressive babysit');
    }
    if (state.pending) stop('Unconfirmed Git effect requires reconciliation; do not retry blindly');
    for (;;) {
      if (state.phase !== 'ci') {
        iterationGuard();
        state.iterations++;
        await save();
        await current();
        if (state.failedPipeline) {
          // resolve must finish the owned local CI repair before validating comments.
          // Its remote head may not change: invalidate claim AND fix/test caches
          // durably before dispatch, including on a resumed repair attempt.
          state.resolution ??= {};
          const generation = state.resolution.sourceGeneration ?? 0;
          if (!Number.isSafeInteger(generation) || generation < 0 || generation === Number.MAX_SAFE_INTEGER) {
            stop('Invalid local source generation');
          }
          state.resolution.sourceGeneration = generation + 1;
          await save();
        }
        const ownerContext = { ...context, headSha: state.headSha };
        const resolution = await hooks.resolve({ actionMode: 'aggressive', context: ownerContext, restrictions,
          state: state.resolution, failedPipeline: state.failedPipeline ?? null, deadlineAt: state.deadlineAt,
          babysitOwner: { context: ownerContext, startedAt: state.startedAt, deadlineAt: state.deadlineAt,
            iterations: state.iterations, maxIterations: state.maxIterations } });
        state.resolution = resolution.state;
        await save();
        if (resolution.status !== 'completed') stop(resolution.reason ?? 'Review proof or resolution blocked');
        timeGuard();
        const dirty = await hooks.isDirty();
        if (typeof dirty !== 'boolean') stop('Dirty-file scope is unverified');
        if (dirty) {
          await current();
          state.pending = { kind: 'commit', headSha: state.headSha };
          await save();
          const sha = await hooks.commit({ sourceBranch: state.binding.sourceBranch, deadlineAt: state.deadlineAt });
          if (typeof sha !== 'string' || !sha || sha === state.headSha) stop('Commit did not produce a verified new head');
          await current();
          state.pending = { kind: 'push', sha, previousHead: state.headSha };
          await save();
          const pushed = await hooks.push({ sha, sourceBranch: state.binding.sourceBranch,
            sourceProject: state.binding.sourceProject, expectedHead: state.headSha, deadlineAt: state.deadlineAt });
          if (pushed?.headSha !== sha) stop('Push is unconfirmed');
          state.headSha = sha;
          state.lastPushHead = sha;
          state.pending = null;
          state.failedPipeline = null;
          state.waitCount = 0;
          await save();
          await current();
        } else if (state.failedPipeline) {
          stop('CI failed and no new proven scoped fix is available; no push or new-pipeline wait');
        }
        state.phase = 'ci';
        await save();
      }
      await current();
      const pipeline = await hooks.getPipeline({ headSha: state.headSha, sourceBranch: state.binding.sourceBranch,
        deadlineAt: state.deadlineAt });
      await current();
      const exact = pipeline?.headSha === state.headSha;
      if (exact && (pipeline.manualGate || ['manual', 'blocked', 'canceled', 'skipped'].includes(pipeline.status))) {
        stop('CI requires manual action or required execution is unavailable');
      }
      if (exact && pipeline.status === 'success') {
        if (pipeline.requiredChecksPassed !== true) stop('Required CI checks are not proven complete');
        state.phase = 'ci';
        await save();
        await current();
        return { status: 'passed', reason: null, state, pipeline };
      }
      if (exact && pipeline.status === 'failed') {
        state.failedPipeline = pipeline;
        state.phase = 'resolve';
        await save();
        continue;
      }
      if (exact && !['created', 'waiting_for_resource', 'preparing', 'pending', 'running', 'scheduled'].includes(pipeline.status)) {
        stop('Unknown exact-head CI status; required execution is unverified');
      }
      if (!exact && state.lastPushHead !== state.headSha) stop('No exact-head pipeline exists and no push occurred');
      iterationGuard();
      const interval = Math.min(state.intervalMs * (2 ** Math.min(state.waitCount, 30)), state.maxIntervalMs);
      const timeoutMs = Math.min(interval, state.deadlineAt - now());
      state.waitCount++;
      await save();
      timeGuard();
      await boundedForegroundWait(waiter, Math.min(timeoutMs, state.deadlineAt - now()), state.deadlineAt);
    }
  } catch (error) {
    return { status: error.status ?? 'blocked', reason: error.message, state };
  }
}
