import { createHash } from 'node:crypto';
import { normalizeDiscussions } from './normalize-discussions.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const bindingFields = ['target', 'sourceProject', 'sourceBranch', 'owner', 'actorUsername'];
const verdicts = new Set(['valid', 'valid_claim_bad_fix', 'invalid', 'over_engineered',
  'stale_or_fixed', 'duplicate', 'not_actionable', 'unverified']);

// Hooks are trusted integration code. validate is read-only in both modes;
// applyFix/testFix/reply are separate effects and never run in passive mode.
export async function resolveComments({ context, discussions, hooks, actionMode = 'passive',
  scope = { type: 'all-threads' }, restrictions = {}, state = {} }) {
  if (!['passive', 'aggressive'].includes(actionMode)) throw new Error('Unknown action mode');
  if (!['one-thread', 'all-threads'].includes(scope.type)) throw new Error('Unknown target scope');
  for (const field of [...bindingFields, 'headSha']) {
    if (typeof context?.[field] !== 'string' || !context[field]) throw new Error(`Missing context.${field}`);
  }
  const binding = Object.fromEntries(bindingFields.map(field => [field, context[field]]));
  const results = [], excluded = [];
  const output = (status, reason = null) => ({ status, reason, actionMode, scope, results, excluded, state });
  state.handled ??= {};
  state.handledHistory ??= [];
  state.fixes ??= {};
  state.replies ??= [];
  state.sourceGeneration ??= 0;
  const threads = normalizeDiscussions(discussions).filter(d => scope.type === 'one-thread'
    ? String(d.id) === String(scope.discussionId) : d.resolvable && !d.resolved);
  if (scope.type === 'one-thread' && threads.length !== 1) throw new Error('Target must match exactly one discussion');
  for (const thread of threads) {
    if (!Array.isArray(thread.notes)) throw new Error('Complete discussion notes are required');
    for (const note of thread.notes) {
      const body = String(note.body ?? '');
      const own = state.replies.find(r => r.discussionId === thread.id && r.noteId === note.id &&
        r.authorUsername === context.actorUsername && note.author?.username === context.actorUsername && r.bodyHash === hash(body));
      if (note.system === true || own) {
        excluded.push({ discussionId: thread.id, noteId: note.id,
          evidence: [own ? 'Native reply receipt matches note ID, author and body hash' : 'GitLab note.system=true'] });
        continue;
      }
      if (note.id === undefined) throw new Error('Every selected comment needs a note ID');
      results.push({ discussionId: thread.id, noteId: note.id, body, author: note.author,
        key: hash(JSON.stringify([context.target, thread.id, note.id, body])),
        verdict: 'unverified', evidence: [], draft: 'Unverified: validation has not completed.', disposition: 'blocked' });
    }
  }
  const save = async () => { if (actionMode === 'aggressive') await hooks.save(state); };
  const guard = async () => {
    const current = await hooks.getContext();
    for (const field of [...bindingFields, 'headSha']) {
      if (current[field] !== context[field]) throw new Error(`Changed ownership/target/head: ${field}`);
    }
    if (actionMode === 'aggressive' && current.canWrite !== true) throw new Error('Write permission unavailable');
  };
  try {
    if (!Number.isSafeInteger(state.sourceGeneration) || state.sourceGeneration < 0) {
      throw new Error('Invalid local source generation');
    }
    if (state.binding && bindingFields.some(field => state.binding[field] !== binding[field])) {
      throw new Error('Saved resolver ownership/target changed');
    }
    state.binding = binding;
    if (state.pending) throw new Error('Unconfirmed effect requires reconciliation before retry');
    await guard();
    for (const result of results) {
      const previous = state.handled[result.key];
      if (actionMode === 'aggressive' && previous &&
          (previous.validatedHeadSha ?? previous.reviewedHeadSha) === context.headSha &&
          (previous.validatedSourceGeneration ?? 0) === state.sourceGeneration) {
        Object.assign(result, previous, { disposition: 'already_replied' });
        continue;
      }
      if (previous) {
        result.reviewedHeadSha = previous.reviewedHeadSha;
        result.historicalReply = previous.reply ?? previous.historicalReply ?? {
          reviewedHeadSha: previous.reviewedHeadSha, body: previous.draft, evidence: previous.evidence,
        };
      }
      let claim;
      try {
        claim = await hooks.validate(result, context);
        if (!verdicts.has(claim?.verdict) || !claim.reason || !Array.isArray(claim.evidence) ||
            (claim.verdict !== 'unverified' && !claim.evidence.length)) throw new Error('Bounded proof unavailable');
      } catch (error) {
        claim = { verdict: 'unverified', reason: error.message, evidence: [] };
      }
      Object.assign(result, { claim, verdict: claim.verdict, evidence: claim.evidence,
        draft: `${claim.reason}. Evidence: ${claim.evidence.join('; ') || 'unavailable'}.`, disposition: 'drafted',
        reuseReply: Boolean(previous && claim.replyStillApplicable === true &&
          !['valid', 'valid_claim_bad_fix', 'unverified'].includes(claim.verdict)) });
    }
    if (actionMode === 'passive') return output('drafted');
    if (restrictions.readOnly || restrictions.replies === false || restrictions.codeChanges === false) {
      throw new Error('Explicit caller restrictions prevent aggressive completion');
    }
    for (const result of results.filter(r => r.disposition !== 'already_replied')) {
      const claim = result.claim;
      if (claim.verdict === 'unverified') throw new Error('Unverified review claim');
      if (['valid', 'valid_claim_bad_fix'].includes(claim.verdict) &&
          (!claim.safe || !claim.inScope || !claim.fixKey)) throw new Error('Fix is unsafe, out of scope, or unproven');
    }
    const pendingResults = results.filter(r => r.disposition !== 'already_replied');
    const capabilities = pendingResults.length ? ['save'] : [];
    if (pendingResults.some(r => !r.reuseReply)) capabilities.push('reply');
    if (pendingResults.some(r => ['valid', 'valid_claim_bad_fix'].includes(r.verdict))) {
      capabilities.push('applyFix', 'testFix');
    }
    for (const capability of capabilities) {
      if (typeof hooks[capability] !== 'function') throw new Error(`Missing ${capability} capability`);
    }
    // Complete all proven code fixes and checks before publishing any replies.
    for (const result of results.filter(r => r.disposition !== 'already_replied')) {
      if (!['valid', 'valid_claim_bad_fix'].includes(result.verdict)) continue;
      const key = hash(JSON.stringify([context.headSha, state.sourceGeneration, result.claim.fixKey]));
      if (!state.fixes[key]) {
        await guard();
        state.pending = { kind: 'fix', key, headSha: context.headSha };
        await save();
        await hooks.applyFix(result.claim, context);
        const tested = await hooks.testFix(result.claim, context);
        if (tested?.passed !== true || !tested.evidence?.length) throw new Error('Fix tests failed or proof unavailable');
        state.fixes[key] = { evidence: tested.evidence };
        state.pending = null;
        await save();
      }
      result.draft += ` Fixed locally and verified: ${state.fixes[key].evidence.join('; ')}.`;
    }
    for (const result of results.filter(r => r.disposition !== 'already_replied')) {
      await guard();
      if (result.reuseReply) {
        result.disposition = 'already_replied';
      } else {
        state.pending = { kind: 'reply', key: result.key, headSha: context.headSha };
        await save();
        const receipt = await hooks.reply({ discussionId: result.discussionId, noteId: result.noteId,
          body: result.draft, headSha: context.headSha }, context);
        if (receipt?.noteId === undefined || receipt.authorUsername !== context.actorUsername || receipt.body !== result.draft) {
          throw new Error('Reply effect is unconfirmed');
        }
        state.replies.push({ ...receipt, discussionId: result.discussionId, bodyHash: hash(receipt.body),
          commentKey: result.key, reviewedHeadSha: context.headSha });
        result.reply = { ...receipt, reviewedHeadSha: context.headSha, evidence: result.evidence };
        result.reviewedHeadSha = context.headSha;
        result.disposition = 'replied';
      }
      result.validatedHeadSha = context.headSha;
      result.validatedSourceGeneration = state.sourceGeneration;
      if (state.handled[result.key]) state.handledHistory.push(state.handled[result.key]);
      state.handled[result.key] = { ...result };
      state.pending = null;
      await save();
    }
    return output('completed');
  } catch (error) {
    return output('blocked', error.message);
  }
}
