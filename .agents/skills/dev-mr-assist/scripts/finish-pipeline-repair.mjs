// Native repair/proof and guarded standalone publication are trusted adapters.
// An existing babysit owner always keeps the single commit/push responsibility.
export async function finishPipelineRepair({ repair, babysitOwner,
  publicationAuthorized = false, publish }) {
  const blocked = reason => ({ status: 'blocked', reason, repair, babysitOwner });
  if (repair?.passed !== true || !Array.isArray(repair.changedPaths) || !repair.changedPaths.length ||
      !Array.isArray(repair.evidence) || !repair.evidence.length) {
    return blocked('A tested scoped pipeline repair is required');
  }
  if (babysitOwner !== undefined) {
    if (!babysitOwner?.context?.owner || !babysitOwner.context.headSha ||
        !Number.isFinite(babysitOwner.startedAt) || !Number.isFinite(babysitOwner.deadlineAt) ||
        babysitOwner.deadlineAt <= babysitOwner.startedAt ||
        !Number.isInteger(babysitOwner.iterations) || babysitOwner.iterations < 1 ||
        !Number.isInteger(babysitOwner.maxIterations) || babysitOwner.maxIterations < babysitOwner.iterations) {
      return blocked('Existing babysit ownership and original budget are required');
    }
    return { status: 'local', repair, babysitOwner };
  }
  if (publicationAuthorized !== true) return { status: 'local', repair };
  if (typeof publish !== 'function') return blocked('Guarded standalone publisher unavailable');
  try {
    return await publish(repair);
  } catch (error) {
    return blocked(`Publication unconfirmed; reconcile before retry: ${error.message}`);
  }
}
