#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {createHash, randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const hash = value => createHash('sha256').update(value).digest('hex');
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonempty = value => typeof value === 'string' && Boolean(value.trim());
// Prefix every untrusted line: even embedded GitLab quick actions remain prose.
const quote = value => String(value ?? '').split(/\r\n|\r|\n/).map(line => `> ${line}`).join('\n');
const printable = value => Array.isArray(value) ? value.map(printable).join('; ') :
  object(value) ? Object.entries(value).map(([key, item]) => `${key}: ${printable(item)}`).join('\n') : String(value ?? 'unavailable');
const confirmed = record => record.review.unique_peer_findings.filter(f => f?.status === 'confirmed');
const findingKey = f => hash(f.id);
const bindingFor = record => ({
  hostname: record.identity.hostname, project_path: record.identity.project_path,
  repository: record.identity.repository, iid: record.identity.iid, target: record.identity.target,
  username: record.reviewer.username, user_id: record.reviewer.user_id ?? null,
});
const marker = (kind, key) => `<!-- dev-peer-review:${kind}:${key} -->`;
const summaryKey = (record, sha) => hash(JSON.stringify([bindingFor(record), sha]));
const inlineBody = f => `${quote(`${f.title}\n\nProblem: ${f.problem}\nTrigger: ${f.trigger}\nEvidence: ${f.evidence.join('; ')}\nSmallest fix: ${f.fix}`)}\n\n${marker('finding', findingKey(f))}`;

function validateRecord(record) {
  const i = record?.identity, r = record?.review;
  if (record?.schema_version !== 1 || !object(i) || !object(r)) throw Error('Invalid version-1 review record');
  let target;
  try {target = new URL(i.target);} catch {throw Error('Invalid review identity URL');}
  if (/[\u0000-\u0020\u007f]/.test(i.target) || target.protocol !== 'https:' || target.host !== i.hostname || target.username || target.password ||
      target.search || target.hash || !Number.isSafeInteger(i.iid) || i.iid < 1 ||
      !nonempty(i.project_path) || i.project_path.split('/').some(p => !p || p === '.' || p === '..') ||
      decodeURIComponent(target.pathname) !== `/${i.project_path}/-/merge_requests/${i.iid}` ||
      i.repository !== i.project_path.split('/').at(-1)) throw Error('Review identity mismatch');
  if (!nonempty(record.reviewer?.username) || (record.reviewer.user_id != null &&
      (!Number.isSafeInteger(record.reviewer.user_id) || record.reviewer.user_id < 1))) throw Error('Invalid reviewer identity');
  if (!/^[a-f0-9]{8,64}$/i.test(r.head_sha) || r.head_sha !== record.mr?.head_sha ||
      typeof r.verification_complete !== 'boolean' || typeof r.access_blocked !== 'boolean' ||
      r.writes_performed !== false) throw Error('Invalid review head or collection verification');
  for (const field of ['unique_peer_findings', 'verification', 'verification_gaps', 'rejected_hypotheses']) {
    if (!Array.isArray(r[field])) throw Error(`Invalid review.${field}`);
  }
  const ids = new Set();
  for (const f of confirmed(record)) {
    if (!['id', 'title', 'problem', 'trigger', 'fix'].every(k => nonempty(f[k])) ||
        typeof f.blocking !== 'boolean' || !Array.isArray(f.evidence) || !f.evidence.length ||
        !f.evidence.every(nonempty) || ids.has(f.id)) throw Error('Invalid confirmed finding');
    ids.add(f.id);
  }
}

const receiptTitle = receipt => receipt.body.split(/\r\n|\r|\n/).find(nonempty)?.replace(/^(?:> |# )/, '') ?? 'Comment';
const linkLabel = value => value.replace(/\\/g, '\\\\').replace(/([\[\]<>])/g, '\\$1');

export function renderReview(record, publication = {}) {
  validateRecord(record);
  const r = record.review, findings = confirmed(record), count = findings.length;
  const uncertain = r.unique_peer_findings.length - count;
  const incomplete = !r.verification_complete || r.access_blocked || uncertain > 0;
  const heading = incomplete ? `Incomplete — ${count} confirmed issue${count === 1 ? '' : 's'}` :
    count ? `${count} issue${count === 1 ? '' : 's'} found` : 'No actionable issues found';
  const lines = [`# Peer review: ${heading}`, '', `MR: ${record.identity.target}`,
    `Reviewed SHA: ${r.head_sha}`, `Confirmed: ${count} | Blocking: ${findings.filter(f => f.blocking).length} | Unverified: ${uncertain}`,
    quote(`Review verification: ${incomplete ? 'incomplete' : 'complete'} | CI: ${record.mr.pipeline?.status ?? 'unavailable'}`), ''];
  for (const f of findings) {
    const receipt = publication.state?.findings?.[findingKey(f)];
    const location = f.location ? `${f.location.path}:${f.location.line ?? '?'}` :
      f.position ? `${f.position.new_path ?? f.position.old_path}:${f.position.new_line ?? f.position.old_line ?? '?'}` : 'location unavailable';
    lines.push(quote(`${f.blocking ? 'Blocking' : 'Non-blocking'}: ${f.title} (${location}). Fix: ${f.fix}`));
    if (publication.destination === 'mr') lines.push(receipt ?
      `  [Inline finding](${record.identity.target}#note_${receipt.id})` : '  Not posted inline; see location above.');
  }
  if (uncertain) lines.push(...r.unique_peer_findings.filter(f => f?.status !== 'confirmed')
    .map(f => quote(`Unverified: ${typeof f === 'string' ? f : f?.title ?? f?.id ?? 'Finding lacks confirmation'}`)));
  if (r.verification_gaps.length) lines.push('Gaps / label or publication limitations:', ...r.verification_gaps.map(v => quote(printable(v))));
  if (publication.destination !== 'mr') {
    lines.push('', '## Posted to MR', `Publication: ${publication.status ?? 'not run'}`);
    if (publication.reason) lines.push(quote(publication.reason));
    const summary = publication.state?.summaries?.[r.head_sha];
    const inline = findings.map(f => publication.state?.findings?.[findingKey(f)]).filter(Boolean);
    const pending = publication.state?.pending;
    if (summary) lines.push(`- Summary: [${linkLabel(receiptTitle(summary))}](${record.identity.target}#note_${summary.id})${pending?.kind === 'summary' && pending.headSha === r.head_sha ? ' (last confirmed; update unconfirmed)' : ''}`);
    else if (pending?.kind === 'summary' && pending.headSha === r.head_sha) lines.push('- Summary: unconfirmed.');
    else if (inline.length) lines.push('- Summary: not posted.');
    for (const receipt of inline) lines.push(`- Inline: [${linkLabel(receiptTitle(receipt))}](${record.identity.target}#note_${receipt.id})`);
    if (!summary && !inline.length) lines.push('Nothing confirmed posted for this review.');
    if (pending) lines.push('Unconfirmed effect remains; reconciliation required before retry.');
    if (publication.recordPath) lines.push('', `Stored record: ${publication.recordPath}`);
  }
  return lines.join('\n');
}

function validateState(state, binding) {
  if (!object(state) || state.schema_version !== 1 || !object(state.binding) ||
      Object.entries(binding).some(([key, value]) => state.binding[key] !== value) ||
      !object(state.summaries) || !object(state.findings) || !(state.pending === null || object(state.pending))) throw Error('Invalid publication state or binding');
  for (const [kind, entries] of [['summary', state.summaries], ['finding', state.findings]]) {
    for (const [key, receipt] of Object.entries(entries)) {
      if (!(kind === 'summary' ? /^[a-f0-9]{8,64}$/i : /^[a-f0-9]{64}$/).test(key) ||
          !object(receipt) || !Number.isSafeInteger(receipt.id) || receipt.id < 1 || !nonempty(receipt.body) ||
          receipt.author?.username !== binding.username ||
          (binding.user_id !== null && receipt.author?.id !== binding.user_id) ||
          (kind === 'finding' && !nonempty(receipt.discussionId))) throw Error('Invalid publication state receipt');
    }
  }
  const p = state.pending;
  if (p && (!['inline', 'summary'].includes(p.kind) ||
      !(p.kind === 'inline' ? /^[a-f0-9]{64}$/ : /^[a-f0-9]{8,64}$/i).test(p.key) || !nonempty(p.body) ||
      (p.kind === 'summary' && p.key !== p.headSha) ||
      !p.body.includes(marker(p.kind === 'inline' ? 'finding' : 'summary', p.kind === 'inline' ? p.key : hash(JSON.stringify([binding, p.headSha])))) ||
      !/^[a-f0-9]{8,64}$/i.test(p.headSha) || (p.kind === 'inline' && (!object(p.position) || p.position.position_type !== 'text' ||
        !['base_sha', 'start_sha', 'head_sha', 'old_path', 'new_path'].every(key => nonempty(p.position[key])) ||
        p.position.head_sha !== p.headSha ||
        (p.position.old_line === undefined && p.position.new_line === undefined) ||
        ['old_line', 'new_line'].some(key => p.position[key] !== undefined && (!Number.isSafeInteger(p.position[key]) || p.position[key] < 1)))) ||
      (p.id !== undefined && (!Number.isSafeInteger(p.id) || p.id < 1)))) throw Error('Invalid pending publication state');
}

// Match only real changed/context lines, preserving both sides of context lines.
function diffPosition(f, context) {
  const p = f.position, refs = context.refs;
  if (!object(p) || !refs || !['base_sha', 'start_sha', 'head_sha'].every(k => nonempty(refs[k])) ||
      refs.head_sha !== context.headSha || !nonempty(p.old_path) || !nonempty(p.new_path)) return null;
  for (const side of ['old_line', 'new_line']) if (p[side] !== undefined && (!Number.isSafeInteger(p[side]) || p[side] < 1)) return null;
  if (p.old_line === undefined && p.new_line === undefined) return null;
  const change = context.changes?.find(c => c.old_path === p.old_path && c.new_path === p.new_path);
  if (!change || typeof change.diff !== 'string' || change.collapsed || change.too_large) return null;
  let old, current;
  for (const line of change.diff.split('\n')) {
    const hunk = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) {[old, current] = hunk.slice(1).map(Number); continue;}
    if (old === undefined) continue;
    const sign = line[0];
    if (![' ', '+', '-'].includes(sign)) continue;
    const oldLine = sign === '+' ? undefined : old;
    const newLine = sign === '-' ? undefined : current;
    if (p.old_line === oldLine && p.new_line === newLine) return {position_type: 'text', ...refs,
      old_path: p.old_path, new_path: p.new_path,
      ...(oldLine === undefined ? {} : {old_line: oldLine}), ...(newLine === undefined ? {} : {new_line: newLine})};
    if (sign !== '+') old++;
    if (sign !== '-') current++;
  }
  return null;
}

export async function publishReview({record, state, hooks, restrictions = {}}) {
  validateRecord(record);
  const binding = bindingFor(record);
  const initial = state ?? {schema_version: 1, binding, summaries: {}, findings: {}, pending: null};
  validateState(initial, binding);
  state = structuredClone(initial);
  const output = (status, reason = null) => {
    const result = {status, reason, state};
    return {...result, markdown: renderReview(record, result)};
  };
  if (restrictions.offline || restrictions.readOnly || restrictions.draftOnly || restrictions.noWrites || restrictions.publish === false) return output('skipped', 'Explicit caller write restriction');
  const actorMatches = note => note?.author?.username === binding.username &&
    (binding.user_id === null || note.author.id === binding.user_id) && note.system !== true;
  const save = async () => hooks.save(structuredClone(state));
  const guard = async () => {
    const context = await hooks.getContext();
    if (context.headSha !== record.review.head_sha) throw Error('MR head changed; review current head before publication');
    if (context.actor?.username !== binding.username || (binding.user_id !== null && context.actor.id !== binding.user_id)) throw Error('Authenticated reviewer identity changed');
    if (context.state && context.state !== 'opened') throw Error('MR is no longer open');
    return context;
  };
  const guardEffect = async () => {
    try {await guard();}
    catch (error) {state.pending = null; await save(); throw error;}
  };
  const receipt = (native, body, discussionId) => {
    if (!Number.isSafeInteger(native?.id) || native.id < 1 || !actorMatches(native) || native.body !== body) throw Error('Native publication effect is unconfirmed');
    return {id: native.id, author: native.author, body: native.body,
      ...(discussionId ? {discussionId, position: native.position ?? null} : {})};
  };
  try {
    await guard();
    const notes = await hooks.listNotes(), discussions = await hooks.listDiscussions();
    if (!Array.isArray(notes) || !Array.isArray(discussions) || discussions.some(d => !Array.isArray(d.notes))) throw Error('Malformed native publication history');
    const inlineNotes = discussions.flatMap(d => d.notes.slice(0, 1).map(n => ({...n, discussionId: d.id})));
    const match = (items, tag, body) => {
      const found = items.filter(n => actorMatches(n) && n.body?.includes(tag) && (body === undefined || n.body === body));
      if (found.length > 1) throw Error('Ambiguous native publication receipts; reconcile manually');
      return found[0];
    };
    if (state.pending) {
      const p = state.pending;
      const found = match(p.kind === 'inline' ? inlineNotes : notes,
        marker(p.kind === 'inline' ? 'finding' : 'summary', p.kind === 'inline' ? p.key : summaryKey(record, p.headSha)), p.body);
      if (!found || (p.id !== undefined && found.id !== p.id)) throw Error('Unconfirmed effect: native reconciliation is uncertain; no retry performed');
      if (p.kind === 'inline' && Object.entries(p.position).some(([key, value]) => found.position?.[key] !== value)) throw Error('Unconfirmed native inline position');
      const observed = receipt(found, p.body, p.kind === 'inline' ? found.discussionId : undefined);
      (p.kind === 'inline' ? state.findings : state.summaries)[p.key] = observed;
      state.pending = null;
      await save();
    }
    for (const f of confirmed(record)) {
      const key = findingKey(f), body = inlineBody(f);
      const found = match(inlineNotes, marker('finding', key));
      if (found) {state.findings[key] = receipt(found, found.body, found.discussionId); continue;}
      // A deleted/stale local receipt is not proof of a current native comment.
      delete state.findings[key];
      const context = await guard(), position = diffPosition(f, context);
      if (!position) continue;
      state.pending = {kind: 'inline', key, headSha: record.review.head_sha, body, position};
      await save();
      await guardEffect();
      const discussion = await hooks.createInline({body, position: structuredClone(position)});
      const note = discussion?.notes?.[0];
      if (Object.entries(position).some(([key, value]) => note?.position?.[key] !== value)) throw Error('Unconfirmed native inline position');
      if (!nonempty(discussion?.id)) throw Error('Native discussion is unconfirmed');
      state.findings[key] = receipt(note, body, discussion.id);
      inlineNotes.push({...note, discussionId: discussion.id});
      state.pending = null;
      await save();
    }
    const sha = record.review.head_sha, tag = marker('summary', summaryKey(record, sha));
    const body = `${renderReview(record, {state, destination: 'mr'})}\n\n${tag}`;
    const previous = match(notes, tag);
    if (previous?.body === body) {
      state.summaries[sha] = receipt(previous, body);
      await save();
      await guard();
      return output('published');
    }
    await guard();
    state.pending = {kind: 'summary', key: sha, headSha: sha, body,
      ...(previous ? {id: previous.id} : {})};
    await save();
    await guardEffect();
    const native = previous ? await hooks.updateSummary({id: previous.id, body}) : await hooks.createSummary({body});
    if (previous && native?.id !== previous.id) throw Error('Summary update returned a different note');
    state.summaries[sha] = receipt(native, body);
    state.pending = null;
    await save();
    await guard();
    return output('published');
  } catch (error) {
    return output('blocked', error.message);
  }
}

// glab --paginate emits adjacent JSON arrays, rather than a single JSON value.
function parsePages(stdout) {
  const values = []; let start = 0, depth = 0, quoted = false, escaped = false;
  for (let n = 0; n < stdout.length; n++) {
    const c = stdout[n];
    if (quoted) {if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === '"') quoted = false; continue;}
    if (c === '"') quoted = true;
    else if (c === '[' || c === '{') {if (depth++ === 0) start = n;}
    else if (c === ']' || c === '}') {if (--depth === 0) values.push(JSON.parse(stdout.slice(start, n + 1)));}
    else if (depth === 0 && !/\s/.test(c)) throw Error('Invalid paginated API JSON');
  }
  if (depth || quoted || !values.length || values.some(v => !Array.isArray(v))) throw Error('Invalid paginated API response');
  return values.flat();
}

export function glabHooks(record, save) {
  const base = `projects/${encodeURIComponent(record.identity.project_path)}/merge_requests/${record.identity.iid}`;
  const api = (endpoint, {method = 'GET', data, paginate = false} = {}) => {
    const args = ['api', endpoint, '--hostname', record.identity.hostname, '--method', method];
    if (paginate) args.push('--paginate');
    if (data !== undefined) args.push('--input', '-');
    const result = spawnSync('glab', args, {encoding: 'utf8', input: data === undefined ? '' : JSON.stringify(data), maxBuffer: 64 * 1024 * 1024});
    if (result.error || result.status !== 0) throw Error(`glab API failed: ${result.error?.message ?? result.stderr.trim() ?? result.status}`);
    return paginate ? parsePages(result.stdout) : JSON.parse(result.stdout);
  };
  return {
    save,
    getContext: async () => {
      const actor = api('user'), changes = api(`${base}/diffs`, {paginate: true}), mr = api(base);
      return {actor, headSha: mr.sha, state: mr.state, refs: mr.diff_refs, changes};
    },
    listNotes: async () => api(`${base}/notes`, {paginate: true}),
    listDiscussions: async () => api(`${base}/discussions`, {paginate: true}),
    createSummary: async data => api(`${base}/notes`, {method: 'POST', data}),
    updateSummary: async ({id, body}) => api(`${base}/notes/${id}`, {method: 'PUT', data: {body}}),
    createInline: async data => api(`${base}/discussions`, {method: 'POST', data}),
  };
}

function atomicWrite(file, state) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(state, null, 2)}\n`, {mode: 0o600, flag: 'wx'});
    fs.renameSync(temporary, file);
  } finally {if (fs.existsSync(temporary)) fs.unlinkSync(temporary);}
}

async function cli() {
  const [recordPath, statePath, ...flags] = process.argv.slice(2);
  const allowed = ['--render-only', '--offline', '--read-only', '--draft-only', '--no-writes'];
  if (!recordPath || !statePath || !path.isAbsolute(recordPath) || !path.isAbsolute(statePath) || flags.some(f => !allowed.includes(f))) throw Error('Usage: publish-review.mjs <absolute-record.json> <absolute-publication-state.json> [--render-only|--offline|--read-only|--draft-only|--no-writes]');
  const bytes = fs.readFileSync(recordPath, 'utf8'), record = JSON.parse(bytes);
  validateRecord(record);
  // Check physical identities too, including hardlinks and symlinked parent paths.
  const physicalRecord = fs.realpathSync(recordPath);
  const physicalState = fs.existsSync(statePath) ? fs.realpathSync(statePath) : path.join(fs.realpathSync(path.dirname(statePath)), path.basename(statePath));
  if (physicalRecord === physicalState || (fs.existsSync(statePath) && fs.statSync(recordPath).ino === fs.statSync(statePath).ino && fs.statSync(recordPath).dev === fs.statSync(statePath).dev)) throw Error('Publication state must be separate from immutable review record');
  if (flags.length) {
    console.log(renderReview(record, {status: 'skipped', reason: 'Explicit render-only / caller write restriction', recordPath}));
    return;
  }
  let lock;
  try {
    lock = fs.openSync(`${statePath}.lock`, 'wx', 0o600);
    const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8')) : undefined;
    const hooks = glabHooks(record, async value => {
      if (fs.readFileSync(recordPath, 'utf8') !== bytes) throw Error('Immutable review record changed during publication');
      atomicWrite(statePath, value);
    });
    const result = await publishReview({record, state, hooks});
    console.log(renderReview(record, {...result, recordPath}));
    if (result.status === 'blocked') process.exitCode = 1;
  } finally {
    if (lock !== undefined) {fs.closeSync(lock); fs.unlinkSync(`${statePath}.lock`);}
  }
}
function isMain() {
  try {return Boolean(process.argv[1]) && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));}
  catch {return false;}
}
if (isMain()) cli().catch(error => {console.error(error.message); process.exitCode = 1;});
