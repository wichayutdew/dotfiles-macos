#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const [inputPath, storeRoot] = process.argv.slice(2);
if (!inputPath || !storeRoot || !path.isAbsolute(storeRoot)) {
  console.error('Usage: store-review.mjs <record.json> <absolute-store-root>');
  process.exit(2);
}

const requiredString = (value, field) => {
  const result = String(value ?? '').trim();
  if (!result) throw new Error(`${field} is required`);
  return result;
};
const requiredArray = (value, field) => {
  if (!Array.isArray(value)) throw new Error(`${field} must be an array`);
  return value;
};
const validate = record => {
  if (record?.schema_version !== 1) throw new Error('schema_version must be 1');
  const identity = record.identity ?? {};
  requiredString(identity.hostname, 'identity.hostname');
  requiredString(identity.project_path, 'identity.project_path');
  requiredString(identity.repository, 'identity.repository');
  requiredString(identity.target, 'identity.target');
  if (!Number.isInteger(identity.iid) || identity.iid <= 0) {
    throw new Error('identity.iid must be a positive integer');
  }
  requiredString(record.reviewer?.username, 'reviewer.username');
  const mr = record.mr ?? {};
  requiredString(mr.title, 'mr.title');
  requiredString(mr.state, 'mr.state');
  requiredString(mr.head_sha, 'mr.head_sha');
  if (typeof mr.draft !== 'boolean') throw new Error('mr.draft must be boolean');
  if (typeof mr.approved_by_reviewer !== 'boolean') {
    throw new Error('mr.approved_by_reviewer must be boolean');
  }
  requiredArray(mr.assignees, 'mr.assignees');
  const review = record.review ?? {};
  requiredString(review.reviewed_at, 'review.reviewed_at');
  requiredString(review.head_sha, 'review.head_sha');
  requiredString(review.verdict, 'review.verdict');
  for (const field of ['material_mr_body_evidence', 'unique_peer_findings',
    'rejected_hypotheses', 'verification', 'verification_gaps', 'draft_comments',
    'draft_actions']) requiredArray(review[field], `review.${field}`);
  if (typeof review.verification_complete !== 'boolean') {
    throw new Error('review.verification_complete must be boolean');
  }
  if (typeof review.access_blocked !== 'boolean') {
    throw new Error('review.access_blocked must be boolean');
  }
  if (review.writes_performed !== false) {
    throw new Error('review.writes_performed must be false');
  }
  if (record.sources !== undefined) requiredArray(record.sources, 'sources');
};
const encodedProject = identity => encodeURIComponent(
  `${identity.hostname.toLowerCase()}/${identity.project_path}`
).replace(/[!'()*]/g, character =>
  `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
const sourceKey = source => JSON.stringify([
  source?.conversation_url ?? '', source?.message_url ?? '', source?.thread_url ?? ''
]);
const atomicWrite = (filePath, value) => {
  fs.mkdirSync(path.dirname(filePath), {recursive: true});
  const temporary = path.join(path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {mode: 0o600});
    fs.renameSync(temporary, filePath);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
};

const incoming = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
validate(incoming);
const output = path.join(storeRoot, encodedProject(incoming.identity),
  `${incoming.identity.iid}.json`);
let previous = null;
if (fs.existsSync(output)) {
  previous = JSON.parse(fs.readFileSync(output, 'utf8'));
  validate(previous);
  const previousIdentity = previous.identity;
  if (previousIdentity.hostname !== incoming.identity.hostname ||
      previousIdentity.project_path !== incoming.identity.project_path ||
      previousIdentity.iid !== incoming.identity.iid) {
    throw new Error('Existing record identity does not match output identity');
  }
  if (previous.reviewer.username !== incoming.reviewer.username) {
    throw new Error('Existing record belongs to a different reviewer');
  }
}
const sources = [...(previous?.sources ?? []), ...(incoming.sources ?? [])];
const uniqueSources = [...new Map(sources.map(source => [sourceKey(source), source])).values()];
const record = {...incoming, sources: uniqueSources};
atomicWrite(output, record);
console.log(JSON.stringify({output, created: previous === null,
  replaced: previous !== null, sources: uniqueSources.length}));
