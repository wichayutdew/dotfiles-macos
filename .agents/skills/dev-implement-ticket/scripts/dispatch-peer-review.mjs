import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

const required = (value, field) => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} is required`);
  return value;
};
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

// Agent is a trusted runtime adapter, not a reviewer-supplied callback or JSON
// receipt. Native session/run/status fields must come from its spawn/wait API.
export async function dispatchPeerReview({
  Agent, parentSessionId, mrUrl, headSha, storeRoot, model = null, thinkingEffort = null,
  peerSkillDirectory = null,
}) {
  if (typeof Agent !== 'function') throw new Error('blocked: native Agent capability unavailable');
  required(parentSessionId, 'parentSessionId');
  required(headSha, 'headSha');
  const url = new URL(required(mrUrl, 'mrUrl'));
  const match = url.pathname.match(/^\/(.+)\/-\/merge_requests\/([1-9]\d*)$/);
  if (!match || !['https:', 'http:'].includes(url.protocol) ||
      url.username || url.password || url.search || url.hash) throw new Error('Invalid GitLab MR URL');
  if (!path.isAbsolute(required(storeRoot, 'storeRoot'))) throw new Error('storeRoot must be absolute');
  if (peerSkillDirectory !== null && !path.isAbsolute(required(peerSkillDirectory, 'peerSkillDirectory'))) {
    throw new Error('peerSkillDirectory must be absolute');
  }
  const identity = { hostname: url.host, project_path: match[1], iid: Number(match[2]), target: mrUrl };
  const encodedProject = encodeURIComponent(`${identity.hostname.toLowerCase()}/${identity.project_path}`)
    .replace(/[!'()*]/g, character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
  const recordPath = path.join(storeRoot, encodedProject, `${identity.iid}.json`);
  const dispatch = Object.freeze({ dispatch_id: randomUUID(), parent_session_id: parentSessionId });

  // Resolve the peer skill and all its resources in the spawned child. This
  // module deliberately has no sibling-skill imports or parent-side skill reads.
  const run = await Agent({ skill: 'dev-peer-review', args: Object.freeze({
    mr_url: mrUrl, head_sha: headSha, store_root: storeRoot, model, thinking_effort: thinkingEffort,
    peer_skill_directory: peerSkillDirectory,
    dispatch,
  }) });
  const childSessionId = required(run?.childSessionId, 'native childSessionId');
  const runId = required(run?.runId, 'native runId');
  if (childSessionId === parentSessionId) throw new Error('Reviewer must be separate from parent session');
  if (run.status !== 'completed') throw new Error('Native reviewer run has not completed');
  if (run.result?.recordPath !== recordPath) throw new Error('Reviewer returned the wrong record path');
  const provenance = Object.freeze({ ...dispatch, child_session_id: childSessionId, run_id: runId });

  const readCompletedRecord = () => {
    const bytes = fs.readFileSync(recordPath);
    const record = JSON.parse(bytes);
    if (record.schema_version !== 1) throw new Error('Unsupported review record schema');
    for (const [field, expected] of Object.entries(identity)) {
      if (record.identity?.[field] !== expected) throw new Error(`Review identity.${field} mismatch`);
    }
    if (record.mr?.head_sha !== headSha || record.review?.head_sha !== headSha) {
      throw new Error('Stored review head is stale');
    }
    for (const [field, expected] of Object.entries(provenance)) {
      if (record.review.dispatch?.[field] !== expected) throw new Error(`Review dispatch.${field} mismatch`);
    }
    if (record.review.verification_complete !== true) throw new Error('Review verification is not complete');
    if (record.review.access_blocked !== false) throw new Error('Review access is blocked or unknown');
    if (record.review.writes_performed !== false) throw new Error('Review performed unauthorized content writes');
    required(record.review.verdict, 'review.verdict');
    required(record.review.reviewed_at, 'review.reviewed_at');
    for (const field of ['material_mr_body_evidence', 'unique_peer_findings', 'rejected_hypotheses',
      'verification', 'verification_gaps', 'draft_comments', 'draft_actions']) {
      if (!Array.isArray(record.review[field])) throw new Error(`Incomplete review.${field}`);
    }
    return { record, hash: digest(bytes) };
  };
  const completed = readCompletedRecord();
  return Object.freeze({ recordPath, reviewedHeadSha: headSha, dispatch: provenance,
    verifyCurrent({ mrUrl: currentMrUrl, headSha: currentHeadSha }) {
      if (currentMrUrl !== mrUrl) throw new Error('Current MR does not match dispatched MR');
      if (currentHeadSha !== headSha) throw new Error('Current MR head changed; dispatch another review');
      const current = readCompletedRecord();
      if (current.hash !== completed.hash) throw new Error('Stored review changed or was replaced after completion');
      return current.record;
    },
  });
}
