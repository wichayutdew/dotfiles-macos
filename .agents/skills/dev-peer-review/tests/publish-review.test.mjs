import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { renderReview, publishReview } from '../scripts/publish-review.mjs';

const directory = path.dirname(fileURLToPath(import.meta.url));
const schema = fs.readFileSync(path.join(directory, '../references/review-record-schema.md'), 'utf8');
const fixture = () => JSON.parse(schema.match(/```json\n([\s\S]*?)\n```/)[1]);
const finding = () => ({ id: 'empty-result', status: 'confirmed', blocking: true,
  title: 'Empty result crashes', problem: 'Dereferences missing result.',
  trigger: 'Search returns no rows.', evidence: ['node repro.mjs: TypeError'],
  fix: 'Return early for empty rows.', location: {path: 'src/a.js', line: 2},
  position: {old_path: 'src/a.js', new_path: 'src/a.js', new_line: 2} });
function server(record) {
  const notes = [], discussions = [], effects = [], saved = [];
  let head = record.review.head_sha, next = 1;
  const native = body => ({id: next++, body, author: {username: 'reviewer', id: 456}, system: false});
  const hooks = {
    getContext: async () => ({headSha: head, actor: {username: 'reviewer', id: 456},
      refs: {base_sha: 'base', start_sha: 'start', head_sha: head},
      changes: [{old_path: 'src/a.js', new_path: 'src/a.js', diff: '@@ -1 +1,2 @@\n old\n+new'}]}),
    listNotes: async () => notes, listDiscussions: async () => discussions,
    save: async state => saved.push(structuredClone(state)),
    createSummary: async ({body}) => {const n = native(body); notes.push(n); effects.push('summary'); return n;},
    updateSummary: async ({id, body}) => {const n = notes.find(n => n.id === id); n.body = body; effects.push('update'); return n;},
    createInline: async ({body, position}) => {const n = {...native(body), position}; const d = {id: `d${n.id}`, notes: [n]}; discussions.push(d); effects.push('inline'); return d;},
  };
  return {hooks, notes, discussions, effects, saved, setHead: value => {head = value;}};
}

test('readable status distinguishes clean, confirmed, incomplete and CI', () => {
  const r = fixture(); r.mr.pipeline.status = 'failed'; r.review.verification_gaps = ['Label attachment denied'];
  assert.match(renderReview(r), /^# Peer review: No actionable issues found/);
  r.review.unique_peer_findings = [finding(), {...finding(), id: 'maybe', status: 'unverified'}];
  let text = renderReview(r);
  assert.match(text, /Incomplete — 1 confirmed issue/); assert.match(text, /Blocking: 1/);
  assert.match(text, /0123456789abcdef/); assert.doesNotMatch(text, /schema_version|```json/);
  r.review.unique_peer_findings.pop(); assert.match(renderReview(r), /Peer review: 1 issue found/);
  r.review.verification_complete = false; r.review.verification_gaps = ['Cannot run focused proof'];
  assert.match(renderReview(r), /Incomplete — 1 confirmed issue/);
  assert.match(renderReview(r), /Cannot run focused proof/);
  r.review.unique_peer_findings = []; assert.match(renderReview(r), /Incomplete — 0 confirmed issues/);
});

test('rendered untrusted text cannot execute GitLab quick actions', async () => {
  const r = fixture(); r.mr.pipeline.status = 'success\n/merge'; const f = finding(); f.problem += '\n/merge\n /label ~secret';
  r.review.unique_peer_findings = [f];
  const s = server(r); const result = await publishReview({record: r, hooks: s.hooks});
  for (const body of [result.markdown, ...s.notes.map(n => n.body), ...s.discussions.flatMap(d => d.notes.map(n => n.body))]) {
    assert.doesNotMatch(body, /^\s*\/(?:merge|label)\b/m);
    assert.match(body, /merge/);
  }
});

test('same SHA reuses summary, incomplete completion updates it; new SHA preserves history and inline', async () => {
  const r = fixture(); r.review.unique_peer_findings = [finding()]; r.review.verification_complete = false;
  const s = server(r); const first = await publishReview({record: r, hooks: s.hooks});
  assert.equal(first.status, 'published'); assert.deepEqual(s.effects, ['inline', 'summary']);
  assert.match(s.notes[0].body, /#note_1/);
  const retry = await publishReview({record: r, state: first.state, hooks: s.hooks});
  assert.equal(retry.status, 'published'); assert.deepEqual(s.effects, ['inline', 'summary']);
  r.review.verification_complete = true;
  const complete = await publishReview({record: r, state: retry.state, hooks: s.hooks});
  assert.deepEqual(s.effects, ['inline', 'summary', 'update']);
  r.review.head_sha = r.mr.head_sha = 'fedcba9876543210'; s.setHead(r.review.head_sha);
  const second = await publishReview({record: r, state: complete.state, hooks: s.hooks});
  assert.equal(second.status, 'published'); assert.equal(s.notes.length, 2); assert.equal(s.discussions.length, 1);
  assert.match(s.notes[0].body, /0123456789abcdef/);
});

for (const restriction of ['offline', 'readOnly', 'draftOnly', 'noWrites']) {
  test(`${restriction} prevents even network reads and receipt writes`, async () => {
    const r = fixture(); let calls = 0;
    const hooks = new Proxy({}, {get() {return () => {calls++; throw Error('forbidden');};}});
    const result = await publishReview({record: r, hooks, restrictions: {[restriction]: true}});
    assert.equal(result.status, 'skipped'); assert.equal(calls, 0);
  });
}

test('head drift between inline and summary stops further effects', async () => {
  const r = fixture(); r.review.unique_peer_findings = [finding()]; const s = server(r);
  const post = s.hooks.createInline; s.hooks.createInline = async args => {const d = await post(args); s.setHead('new-head'); return d;};
  const result = await publishReview({record: r, hooks: s.hooks});
  assert.equal(result.status, 'blocked'); assert.match(result.reason, /head/i);
  assert.deepEqual(s.effects, ['inline']); assert.equal(Object.keys(result.state.findings).length, 1);
});

test('invalid or absent diff positions remain located summary findings', async () => {
  const r = fixture(); const f = finding(); f.position.new_line = 999; r.review.unique_peer_findings = [f];
  const s = server(r); const result = await publishReview({record: r, hooks: s.hooks});
  assert.equal(result.status, 'published'); assert.deepEqual(s.effects, ['summary']);
  assert.match(s.notes[0].body, /src\/a.js:2/); assert.match(s.notes[0].body, /not posted inline/i);
});

test('lost inline response reconciles native receipt before retrying', async () => {
  const r = fixture(); r.review.unique_peer_findings = [finding()]; const s = server(r);
  const post = s.hooks.createInline; s.hooks.createInline = async args => {await post(args); throw Error('connection lost');};
  const first = await publishReview({record: r, hooks: s.hooks});
  assert.equal(first.status, 'blocked'); assert.equal(first.state.pending.kind, 'inline');
  s.hooks.createInline = post;
  const retry = await publishReview({record: r, state: first.state, hooks: s.hooks});
  assert.equal(retry.status, 'published'); assert.deepEqual(s.effects, ['inline', 'summary']);
});

test('uncertain missing effect blocks retries and does not claim success', async () => {
  const r = fixture(); const s = server(r); s.hooks.createSummary = async () => {throw Error('timeout');};
  const first = await publishReview({record: r, hooks: s.hooks});
  assert.equal(first.status, 'blocked'); assert.equal(first.state.pending.kind, 'summary');
  s.hooks.createSummary = async () => assert.fail('must reconcile before retry');
  const retry = await publishReview({record: r, state: first.state, hooks: s.hooks});
  assert.equal(retry.status, 'blocked'); assert.match(retry.reason, /unconfirmed|uncertain/i);
});

test('malformed identity or saved state fails before effects and leaves inputs intact', async () => {
  const r = fixture(); const original = JSON.stringify(r); const s = server(r);
  for (const state of [{schema_version: 999}, {schema_version: 1, binding: {}, summaries: {}, findings: {}, pending: null}]) {
    await assert.rejects(publishReview({record: r, state, hooks: s.hooks}), /state|binding/i);
  }
  const bad = structuredClone(r); bad.identity.target = 'https://other.example/group/project/-/merge_requests/123';
  await assert.rejects(publishReview({record: bad, hooks: s.hooks}), /identity/i);
  assert.deepEqual(s.effects, []); assert.equal(JSON.stringify(r), original);
});

// Run the actual adapter and CLI against a process boundary, never live GitLab.
import os from 'node:os';
import {spawnSync} from 'node:child_process';
function cliFixture(t, mode = '') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'publish cli '));
  t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
  const r = fixture(); r.review.unique_peer_findings = [finding()];
  const recordPath = path.join(dir, 'review.json'), statePath = path.join(dir, 'publication.json');
  fs.writeFileSync(recordPath, JSON.stringify(r));
  const fake = path.join(dir, 'glab');
  fs.writeFileSync(fake, `#!${process.execPath}
import fs from 'node:fs';
const args=process.argv.slice(2), endpoint=args[1], input=fs.readFileSync(0,'utf8');
const log=process.env.FAKE_LOG, dbFile=process.env.FAKE_DB;
fs.appendFileSync(log, JSON.stringify({args,input})+'\\n');
const db=fs.existsSync(dbFile)?JSON.parse(fs.readFileSync(dbFile)):{notes:[],discussions:[],next:1};
let result;
const method=args.includes('--method')?args[args.indexOf('--method')+1]:'GET';
const author={username:'reviewer',id:456};
if(process.env.FAKE_MODE==='denied' && method!=='GET'){console.error('403 forbidden');process.exit(1);}
if(endpoint==='user') result=author;
else if(endpoint.endsWith('/diffs')) {process.stdout.write('[]\\n'+JSON.stringify([{old_path:'src/a.js',new_path:'src/a.js',diff:'@@ -1 +1,2 @@\\n old\\n+new'}])+'\\n');process.exit(0);}
else if(endpoint.endsWith('/discussions') && method==='GET') result=db.discussions;
else if(endpoint.endsWith('/notes') && method==='GET') {process.stdout.write('[]\\n'+JSON.stringify(db.notes)+'\\n');process.exit(0);}
else if(method==='GET') result={sha:'0123456789abcdef',state:'opened',diff_refs:{base_sha:'base',start_sha:'start',head_sha:'0123456789abcdef'}};
else {
 const data=JSON.parse(input); const note={id:db.next++,body:data.body,author,system:false};
 if(endpoint.endsWith('/discussions')) {note.position=data.position;result={id:'discussion-'+note.id,notes:[note]};db.discussions.push(result);}
 else if(method==='PUT') {result=db.notes.find(n=>String(n.id)===endpoint.split('/').at(-1)); result.body=data.body;}
 else {result=note;db.notes.push(note);}
 fs.writeFileSync(dbFile,JSON.stringify(db));
 if(process.env.FAKE_MODE==='lost'){console.error('lost response');process.exit(1);}
}
console.log(JSON.stringify(result));
`, {mode: 0o755});
  // The extensionless executable must run as ESM independently of package.json.
  fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
  const env = {...process.env, PATH: `${dir}${path.delimiter}${process.env.PATH}`,
    FAKE_LOG: path.join(dir, 'calls.jsonl'), FAKE_DB: path.join(dir, 'db.json'), FAKE_MODE: mode};
  const run = (...args) => spawnSync(process.execPath,
    [path.join(directory, '../scripts/publish-review.mjs'), recordPath, statePath, ...args],
    {cwd: dir, env, encoding: 'utf8'});
  return {dir, env, run, recordPath, statePath, record: r,
    calls: () => fs.existsSync(env.FAKE_LOG) ? fs.readFileSync(env.FAKE_LOG, 'utf8').trim().split('\n').map(JSON.parse) : []};
}

test('CLI sends argv and stdin JSON, paginates and leaves review bytes immutable', t => {
  const f = cliFixture(t); const before = fs.readFileSync(f.recordPath, 'utf8');
  const first = f.run(); assert.equal(first.status, 0, first.stderr + first.stdout);
  assert.match(first.stdout, /Publication: published/);
  assert.equal(fs.readFileSync(f.recordPath, 'utf8'), before);
  const calls = f.calls(), writes = calls.filter(c => c.args.includes('--input'));
  assert.equal(writes.length, 2);
  for (const call of calls) {
    assert.equal(call.args[0], 'api'); assert.ok(call.args.includes('--hostname'));
    assert.equal(call.args[call.args.indexOf('--hostname')+1], 'gitlab.example.com');
    if (call.args[1] !== 'user') assert.match(call.args[1], /^projects\/group%2Fproject\/merge_requests\/123/);
    if (/\/(?:notes|discussions|diffs)$/.test(call.args[1]) && !call.input) assert.ok(call.args.includes('--paginate'));
  }
  assert.equal(writes[0].args.at(-1), '-');
  assert.deepEqual(JSON.parse(writes[0].input).position, {position_type:'text',base_sha:'base',start_sha:'start',head_sha:'0123456789abcdef',old_path:'src/a.js',new_path:'src/a.js',new_line:2});
  const retry = f.run(); assert.equal(retry.status, 0, retry.stderr);
  assert.equal(f.calls().filter(c => c.args.includes('--input')).length, 2);
  const state = JSON.parse(fs.readFileSync(f.statePath));
  assert.equal(state.summaries['0123456789abcdef'].author.username, 'reviewer');
});

test('CLI render-only ignores network and state, while failed effects persist uncertainty', t => {
  const f = cliFixture(t, 'denied');
  const render = f.run('--render-only'); assert.equal(render.status, 0, render.stderr);
  assert.deepEqual(f.calls(), []); assert.equal(fs.existsSync(f.statePath), false);
  const denied = f.run(); assert.notEqual(denied.status, 0);
  assert.match(denied.stdout, /blocked/); assert.match(denied.stdout, /403 forbidden/);
  const before = fs.readFileSync(f.statePath, 'utf8');
  const second = f.run(); assert.notEqual(second.status, 0);
  assert.equal(f.calls().filter(c => c.args.includes('--input')).length, 1);
  assert.equal(fs.readFileSync(f.statePath, 'utf8'), before);
});

test('CLI reconciles a lost native response from paginated discussions', t => {
  const f = cliFixture(t, 'lost'); const first = f.run(); assert.notEqual(first.status, 0);
  f.env.FAKE_MODE = ''; const second = f.run(); assert.equal(second.status, 0, second.stderr + second.stdout);
  assert.equal(f.calls().filter(c => c.args.includes('--input')).length, 2);
});

test('CLI rejects shared record/state files and corrupt state without clobbering evidence', t => {
  const f = cliFixture(t), before = fs.readFileSync(f.recordPath, 'utf8');
  const same = spawnSync(process.execPath, [path.join(directory, '../scripts/publish-review.mjs'), f.recordPath, f.recordPath], {env:f.env,encoding:'utf8'});
  assert.notEqual(same.status, 0); assert.equal(fs.readFileSync(f.recordPath, 'utf8'), before);
  fs.writeFileSync(f.statePath, '{broken'); const broken = f.run(); assert.notEqual(broken.status, 0);
  assert.equal(fs.readFileSync(f.statePath, 'utf8'), '{broken'); assert.deepEqual(f.calls(), []);
});

for (const kind of ['create', 'update']) {
  test(`lost summary ${kind} response reconciles without another write`, async () => {
    const r = fixture(), s = server(r);
    let state;
    if (kind === 'update') {state = (await publishReview({record:r,hooks:s.hooks})).state; r.review.verification_complete = false;}
    const hook = kind === 'create' ? 'createSummary' : 'updateSummary', post = s.hooks[hook];
    s.hooks[hook] = async args => {await post(args); throw Error('lost summary response');};
    const first = await publishReview({record:r,state,hooks:s.hooks});
    assert.equal(first.status, 'blocked'); assert.equal(first.state.pending.kind, 'summary');
    s.hooks[hook] = post;
    const retry = await publishReview({record:r,state:first.state,hooks:s.hooks});
    assert.equal(retry.status, 'published'); assert.equal(s.notes.length, 1);
    assert.deepEqual(s.effects, kind === 'create' ? ['summary'] : ['summary','update']);
  });
}

test('review actor mismatch and stale starting head block before writes', async () => {
  const r = fixture();
  for (const change of [c => {c.actor.id = 99;}, c => {c.headSha = 'old-head';}]) {
    const s = server(r), context = s.hooks.getContext;
    s.hooks.getContext = async () => {const c = await context(); change(c); return c;};
    const result = await publishReview({record:r,hooks:s.hooks});
    assert.equal(result.status,'blocked'); assert.deepEqual(s.effects, []); assert.deepEqual(s.saved, []);
  }
});

test('wrong native author or body never becomes a successful receipt', async () => {
  const r = fixture();
  for (const corrupt of [n => {n.author.id = 999;}, n => {n.body = 'server transformed body';}]) {
    const s = server(r), post = s.hooks.createSummary;
    s.hooks.createSummary = async args => {const n = await post(args); corrupt(n); return n;};
    const result = await publishReview({record:r,hooks:s.hooks});
    assert.equal(result.status,'blocked'); assert.equal(result.state.pending.kind,'summary');
    assert.deepEqual(result.state.summaries, {});
  }
});

test('deleted, renamed and context lines use correct old/new position sides', async () => {
  for (const [diff, position] of [
    ['@@ -1,2 +1 @@\n keep\n-deleted', {old_path:'src/old.js',new_path:'src/new.js',old_line:2}],
    ['@@ -1 +1 @@\n keep', {old_path:'src/old.js',new_path:'src/new.js',old_line:1,new_line:1}],
  ]) {
    const r = fixture(), f = finding(); f.position = position; r.review.unique_peer_findings = [f];
    const s = server(r), context = s.hooks.getContext;
    s.hooks.getContext = async () => ({...await context(),changes:[{old_path:'src/old.js',new_path:'src/new.js',diff}]});
    const result = await publishReview({record:r,hooks:s.hooks});
    assert.equal(result.status,'published'); assert.deepEqual(s.discussions[0].notes[0].position,
      {position_type:'text',base_sha:'base',start_sha:'start',head_sha:r.review.head_sha,...position});
  }
});

test('legacy findings stay readable and incomplete without invented confirmed evidence', () => {
  const r = fixture(); r.review.unique_peer_findings = ['Legacy finding without proof'];
  const text = renderReview(r); assert.match(text, /Incomplete — 0 confirmed issues/);
  assert.match(text, /Legacy finding without proof/);
});

test('malformed pending state is rejected before fetching native history', async () => {
  const r = fixture(), s = server(r), good = (await publishReview({record:r,hooks:s.hooks})).state;
  for (const pending of [
    {kind:'summary',key:'__proto__',headSha:r.review.head_sha,body:'not marked'},
    {kind:'summary',key:'fedcba9876543210',headSha:r.review.head_sha,body:'not marked'},
    {kind:'inline',key:'x',headSha:r.review.head_sha,body:'not marked',position:{}},
  ]) {
    await assert.rejects(publishReview({record:r,state:{...good,pending},hooks:{}}), /pending|state/i);
  }
});

test('lost inline response with mismatched native position remains unconfirmed', async () => {
  const r = fixture(); r.review.unique_peer_findings = [finding()]; const s = server(r);
  const post = s.hooks.createInline;
  s.hooks.createInline = async args => {const d = await post(args); d.notes[0].position.new_line = 999; throw Error('lost');};
  const first = await publishReview({record:r,hooks:s.hooks});
  const retry = await publishReview({record:r,state:first.state,hooks:s.hooks});
  assert.equal(retry.status,'blocked'); assert.match(retry.reason,/position|unconfirmed/i);
  assert.deepEqual(s.effects,['inline']);
});

test('reconfirmed same issue reuses historical inline when current proof changes', async () => {
  const r = fixture(), f = finding(); r.review.unique_peer_findings = [f]; const s = server(r);
  const first = await publishReview({record:r,hooks:s.hooks});
  r.review.head_sha = r.mr.head_sha = 'fedcba9876543210'; s.setHead(r.review.head_sha);
  f.evidence = ['node repro.mjs at new head still raises TypeError']; f.location.line = 3;
  const second = await publishReview({record:r,state:first.state,hooks:s.hooks});
  assert.equal(second.status,'published'); assert.equal(s.discussions.length,1); assert.equal(s.notes.length,2);
  assert.match(s.notes[1].body,/src\/a.js:3/); assert.match(s.notes[1].body,/#note_1/);
});

test('head guard after saved intent clears a request known never to have been sent', async () => {
  const r = fixture(), s = server(r), save = s.hooks.save;
  s.hooks.save = async state => {await save(state); if(state.pending) s.setHead('changed-head');};
  const result = await publishReview({record:r,hooks:s.hooks});
  assert.equal(result.status,'blocked'); assert.deepEqual(s.effects,[]);
  assert.equal(result.state.pending,null); assert.equal(s.saved.at(-1).pending,null);
});

test('identity URLs reject raw control lines that URL parsing would normalize', async () => {
  const r = fixture(); r.identity.project_path = 'group/merge'; r.identity.repository = 'merge';
  r.identity.target = 'https://gitlab.example.com/group\n/merge\n/-/merge_requests/123';
  await assert.rejects(publishReview({record:r,hooks:{}}), /identity/i);
});

test('corrupt pending position fails before any native lookup', async () => {
  const r = fixture(); r.review.unique_peer_findings = [finding()]; const s = server(r);
  s.hooks.createInline = async () => {throw Error('uncertain');};
  const first = await publishReview({record:r,hooks:s.hooks}); first.state.pending.position = {};
  await assert.rejects(publishReview({record:r,state:first.state,hooks:{}}), /pending|position|state/i);
});

test('record identity key order does not block same-SHA retry', async () => {
  const r = fixture(), s = server(r);
  const first = await publishReview({record:r,hooks:s.hooks});
  r.identity = Object.fromEntries(Object.entries(r.identity).reverse());
  const retry = await publishReview({record:r,state:first.state,hooks:s.hooks});
  assert.equal(retry.status,'published'); assert.deepEqual(s.effects,['summary']);
  assert.equal(s.notes.length,1);
});

test('saved binding key order does not block same-SHA retry', async () => {
  const r = fixture(), s = server(r);
  const first = await publishReview({record:r,hooks:s.hooks});
  first.state.binding = Object.fromEntries(Object.entries(first.state.binding).reverse());
  const retry = await publishReview({record:r,state:first.state,hooks:s.hooks});
  assert.equal(retry.status,'published'); assert.deepEqual(s.effects,['summary']);
  assert.equal(s.notes.length,1);
});

test('fresh-state retry reconciles native summary despite reordered record identity', async () => {
  const r = fixture(), s = server(r);
  await publishReview({record:r,hooks:s.hooks});
  r.identity = Object.fromEntries(Object.entries(r.identity).reverse());
  const retry = await publishReview({record:r,hooks:s.hooks});
  assert.equal(retry.status,'published'); assert.equal(s.notes.length,1);
  assert.deepEqual(s.effects,['summary']);
  assert.equal(retry.state.summaries[r.review.head_sha].id,1);
});

test('true identity changes still reject saved binding before native lookup', async () => {
  const r = fixture(), s = server(r);
  const first = await publishReview({record:r,hooks:s.hooks});
  const changedMr = structuredClone(r); changedMr.identity.iid = 124;
  changedMr.identity.target = 'https://gitlab.example.com/group/project/-/merge_requests/124';
  await assert.rejects(publishReview({record:changedMr,state:first.state,hooks:{}}), /binding/i);
  const changedActor = structuredClone(r); changedActor.reviewer.user_id = 999;
  await assert.rejects(publishReview({record:changedActor,state:first.state,hooks:{}}), /binding/i);
  assert.deepEqual(s.effects,['summary']);
});

test('default chat and MR summary keep short actions and gaps without proof dumps', async () => {
  const r = fixture(), f = finding();
  f.problem = 'DETAILED_PROBLEM'; f.trigger = 'DETAILED_TRIGGER'; f.evidence = ['DETAILED_PROOF'];
  r.review.unique_peer_findings = [f]; r.review.verification = ['SUCCESSFUL_COMMAND_LIST'];
  r.review.rejected_hypotheses = ['REJECTED_HYPOTHESIS'];
  r.review.verification_gaps = ['Required environment unavailable']; r.review.verification_complete = false;
  const before = JSON.stringify(r), s = server(r), result = await publishReview({record:r,hooks:s.hooks});
  for (const text of [result.markdown,s.notes[0].body]) {
    assert.match(text,/Incomplete — 1 confirmed issue/); assert.match(text,/0123456789abcdef/);
    assert.match(text,/Blocking: 1/); assert.match(text,/Empty result crashes/); assert.match(text,/src\/a.js:2/);
    assert.match(text,/Return early for empty rows/); assert.match(text,/Required environment unavailable/);
    assert.doesNotMatch(text,/DETAILED_PROBLEM|DETAILED_TRIGGER|DETAILED_PROOF|SUCCESSFUL_COMMAND_LIST|REJECTED_HYPOTHESIS/);
  }
  assert.match(s.discussions[0].notes[0].body,/DETAILED_PROBLEM[\s\S]*DETAILED_TRIGGER[\s\S]*DETAILED_PROOF/);
  assert.equal(JSON.stringify(r),before);
  assert.match(result.markdown,/## Posted to MR/); assert.doesNotMatch(s.notes[0].body,/Posted to MR|Publication:/);
});

test('Posted to MR shows actual receipt titles and native links, excluding unrelated history', async () => {
  const r = fixture(), f = finding(); f.title = 'Old ](https://evil.example) [title\\';
  r.review.unique_peer_findings = [f,{...finding(),id:'historical-only',title:'Unrelated historical finding'}];
  const s = server(r), first = await publishReview({record:r,hooks:s.hooks});
  r.review.unique_peer_findings = [f]; r.review.head_sha = r.mr.head_sha = 'fedcba9876543210'; s.setHead(r.review.head_sha);
  f.title = 'Current draft title differs'; f.evidence = ['Fresh proof'];
  const next = await publishReview({record:r,state:first.state,hooks:s.hooks});
  const posted = next.markdown.split('## Posted to MR')[1]; assert.ok(posted);
  assert.match(posted,/Peer review: 1 issue found/); assert.match(posted,/#note_4/); assert.match(posted,/#note_1/);
  assert.ok(posted.includes(String.raw`Old \](https://evil.example) \[title\\`));
  assert.doesNotMatch(posted,/Current draft title differs|Unrelated historical finding|Fresh proof/);
  assert.doesNotMatch(posted,/(?<!\\)\]\(https:\/\/evil/);
});

test('Posted to MR uses last confirmed summary content when an update is unconfirmed', async () => {
  const r = fixture(); r.review.verification_complete = false; const s = server(r);
  const first = await publishReview({record:r,hooks:s.hooks}); r.review.verification_complete = true;
  s.hooks.updateSummary = async () => {throw Error('summary update timed out');};
  const result = await publishReview({record:r,state:first.state,hooks:s.hooks});
  const posted = result.markdown.split('## Posted to MR')[1]; assert.ok(posted);
  assert.match(posted,/Incomplete — 0 confirmed issues/); assert.doesNotMatch(posted,/No actionable issues found/);
  assert.match(posted,/#note_1/); assert.match(posted,/unconfirmed/i); assert.match(posted,/summary update timed out/);
});

test('Posted to MR distinguishes confirmed inline from unconfirmed summary on partial failure', async () => {
  const r = fixture(); r.review.unique_peer_findings = [finding()]; const s = server(r);
  s.hooks.createSummary = async () => {throw Error('summary denied');};
  const result = await publishReview({record:r,hooks:s.hooks});
  const posted = result.markdown.split('## Posted to MR')[1]; assert.ok(posted);
  assert.match(posted,/Publication: blocked/); assert.match(posted,/Empty result crashes/); assert.match(posted,/#note_1/);
  assert.match(posted,/Summary: unconfirmed/); assert.match(posted,/summary denied/);
  assert.doesNotMatch(posted,/Nothing confirmed posted|\[Peer review:/);
});

test('Posted to MR explicitly reports skipped, failed-before-post and not-run outcomes', async () => {
  const r = fixture();
  const skipped = await publishReview({record:r,hooks:{},restrictions:{readOnly:true}});
  const s = server(r); s.setHead('changed-head'); const blocked = await publishReview({record:r,hooks:s.hooks});
  for (const [text,status] of [[renderReview(r),'not run'],[skipped.markdown,'skipped'],[blocked.markdown,'blocked']]) {
    const posted = text.split('## Posted to MR')[1]; assert.ok(posted);
    assert.ok(posted.includes(`Publication: ${status}`)); assert.match(posted,/Nothing confirmed posted/);
    assert.doesNotMatch(posted,/#note_/);
  }
  assert.match(blocked.markdown,/MR head changed/);
});
