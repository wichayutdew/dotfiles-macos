import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));
const schema = fs.readFileSync(path.join(root, 'references/review-record-schema.md'), 'utf8');
const fixture = () => JSON.parse(schema.match(/\x60\x60\x60json\n([\s\S]*?)\n\x60\x60\x60/)[1]);
const store = (record, directory) => {
  const input = path.join(directory, 'incoming.json');
  fs.writeFileSync(input, JSON.stringify(record));
  return spawnSync(process.execPath,
    [path.join(root, 'scripts/store-review.mjs'), input, directory],
    {encoding: 'utf8'});
};
const withStore = run => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'peer-review-record-'));
  try { run(directory); } finally { fs.rmSync(directory, {recursive: true, force: true}); }
};
const readStored = result => {
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(fs.readFileSync(JSON.parse(result.stdout).output, 'utf8'));
};

test('persist model and effort independently of labeling', () => withStore(directory => {
  const record = fixture();
  record.review.verification_gaps = ['Label attachment denied'];
  const saved = readStored(store(record, directory));
  assert.equal(saved.review.model, 'gpt-6.1 sol');
  assert.equal(saved.review.thinking_effort, 'High');
  assert.deepEqual(saved.review.verification_gaps, ['Label attachment denied']);
}));

test('accept old records and replace metadata on re-review', () => withStore(directory => {
  const record = fixture();
  delete record.review.model;
  delete record.review.thinking_effort;
  const first = store(record, directory);
  const saved = readStored(first);
  assert.equal(saved.review.model, null);
  assert.equal(saved.review.thinking_effort, null);
  // Simulate a pre-change record already present in the store.
  fs.writeFileSync(JSON.parse(first.stdout).output, JSON.stringify(record));
  record.review.model = 'another model';
  record.review.thinking_effort = 'Low';
  const updated = readStored(store(record, directory));
  assert.equal(updated.review.model, 'another model');
  assert.equal(updated.review.thinking_effort, 'Low');
  record.review.model = null;
  record.review.thinking_effort = null;
  const unknown = readStored(store(record, directory));
  assert.equal(unknown.review.model, null);
  assert.equal(unknown.review.thinking_effort, null);
}));

test('reject invalid metadata without replacing a stored record', () => withStore(directory => {
  const record = fixture();
  const first = store(record, directory);
  readStored(first);
  const output = JSON.parse(first.stdout).output;
  const before = fs.readFileSync(output, 'utf8');
  for (const field of ['model', 'thinking_effort']) {
    for (const invalid of ['', '  ', 123, false, {}, []]) {
      const candidate = fixture();
      candidate.review[field] = invalid;
      const result = store(candidate, directory);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, new RegExp('review\\.' + field));
      assert.equal(fs.readFileSync(output, 'utf8'), before);
    }
  }
}));

test('optional dispatch provenance round trips without changing standalone records', () => withStore(directory => {
  const record = fixture();
  const standalone = readStored(store(record, directory));
  assert.equal(standalone.review.dispatch, undefined);
  record.review.dispatch = {
    dispatch_id: 'parent-created-dispatch', parent_session_id: 'parent',
    child_session_id: 'child', run_id: 'native-run',
  };
  assert.deepEqual(readStored(store(record, directory)).review.dispatch, record.review.dispatch);
}));

test('invalid or inline dispatch metadata cannot replace an existing review', () => withStore(directory => {
  const record = fixture();
  const first = store(record, directory);
  readStored(first);
  const output = JSON.parse(first.stdout).output;
  const before = fs.readFileSync(output, 'utf8');
  for (const dispatch of [
    {}, null, { dispatch_id: 'dispatch', parent_session_id: 'same', child_session_id: 'same', run_id: 'run' },
    { dispatch_id: 42, parent_session_id: 'parent', child_session_id: 'child', run_id: 'run' },
  ]) {
    const result = store({ ...record, review: { ...record.review, dispatch } }, directory);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /dispatch/);
    assert.equal(fs.readFileSync(output, 'utf8'), before);
  }
}));
