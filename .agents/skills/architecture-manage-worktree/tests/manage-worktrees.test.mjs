import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterEach, test } from 'node:test';

const script = resolve(dirname(fileURLToPath(import.meta.url)), '../manage-worktrees.sh');
const fixtures = [];
afterEach(() => {
  for (const path of fixtures.splice(0)) rmSync(path, { recursive: true, force: true });
});

function git(cwd, ...args) {
  return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'manage-worktrees-'));
  fixtures.push(root);
  const seed = join(root, 'seed');
  const workspace = join(root, 'workspace');
  mkdirSync(seed);
  mkdirSync(workspace);
  git(seed, 'init', '--initial-branch=main');
  git(seed, 'config', 'user.name', 'Worktree Test');
  git(seed, 'config', 'user.email', 'worktree-test@example.invalid');
  for (let n = 1; n <= 3; n++) {
    writeFileSync(join(seed, 'value'), `${n}\n`);
    git(seed, 'add', 'value');
    git(seed, 'commit', '--no-gpg-sign', '-m', `commit ${n}`);
    if (n === 2) git(seed, 'branch', 'feature');
  }
  const origin = join(root, 'origin.git');
  git(seed, 'clone', '--bare', seed, origin);
  // A file URL exercises transport depth; a plain local path ignores --depth.
  writeFileSync(join(workspace, 'repos.conf'), `fixture ${pathToFileURL(origin).href}\n`);
  return { workspace, cache: join(workspace, 'repo-cache/fixture.git'),
    main: git(seed, 'rev-parse', 'main'), feature: git(seed, 'rev-parse', 'feature'),
    tree: name => join(workspace, 'worktrees', name, 'fixture') };
}

function manage(f, name, args = [], expectedStatus = 0) {
  const result = spawnSync('bash', [script, '-n', name, '-r', 'fixture', ...args],
    { cwd: f.workspace, encoding: 'utf8', timeout: 15000 });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  if (expectedStatus === 0) assert.equal(result.status, 0, output);
  else assert.notEqual(result.status, 0, output);
  return output;
}

test('default acquisition retains full history', () => {
  const f = fixture();
  manage(f, 'first', ['-B', 'work/first']);
  assert.equal(git(f.cache, 'rev-parse', '--is-shallow-repository'), 'false');
  assert.equal(git(f.tree('first'), 'rev-list', '--count', 'HEAD'), '3');
});

test('depth one creates two worktrees sharing one shallow cache', () => {
  const f = fixture();
  manage(f, 'first', ['-B', 'work/first', '--depth', '1']);
  manage(f, 'second', ['-B', 'work/second', '--depth', '1']);
  assert.equal(git(f.cache, 'rev-parse', '--is-shallow-repository'), 'true');
  for (const name of ['first', 'second']) {
    assert.equal(git(f.tree(name), 'rev-parse', 'HEAD'), f.main);
    assert.equal(git(f.tree(name), 'rev-list', '--count', 'HEAD'), '1');
    assert.equal(resolve(f.tree(name), git(f.tree(name), 'rev-parse', '--git-common-dir')), f.cache);
  }
});

test('omitting depth on reuse keeps history shallow until explicit unshallow', () => {
  const f = fixture();
  manage(f, 'first', ['-B', 'work/first', '--depth', '1']);
  manage(f, 'second', ['-B', 'work/second']);
  assert.equal(git(f.cache, 'rev-parse', '--is-shallow-repository'), 'true');
  assert.equal(git(f.tree('second'), 'rev-list', '--count', 'HEAD'), '1');
  git(f.cache, 'fetch', '--unshallow', 'origin');
  assert.equal(git(f.cache, 'rev-parse', '--is-shallow-repository'), 'false');
  assert.equal(git(f.tree('first'), 'rev-list', '--count', 'HEAD'), '3');
  assert.equal(git(f.tree('second'), 'rev-list', '--count', 'HEAD'), '3');
});

test('new shallow cache honors the requested existing branch', () => {
  const f = fixture();
  manage(f, 'first', ['-b', 'feature', '--depth', '1']);
  assert.equal(git(f.tree('first'), 'rev-parse', 'HEAD'), f.feature);
  assert.equal(git(f.tree('first'), 'rev-list', '--count', 'HEAD'), '1');
});

test('shallow reuse fetches a requested branch absent from its single-branch cache', () => {
  const f = fixture();
  manage(f, 'first', ['-B', 'work/first', '--depth', '1']);
  manage(f, 'second', ['-b', 'feature', '--depth', '1']);
  assert.equal(git(f.tree('second'), 'rev-parse', 'HEAD'), f.feature);
  assert.equal(git(f.tree('second'), 'rev-list', '--count', 'HEAD'), '1');
  assert.equal(git(f.tree('first'), 'rev-parse', 'HEAD'), f.main);
});

test('depth does not truncate an existing full cache', () => {
  const f = fixture();
  manage(f, 'first', ['-B', 'work/first']);
  manage(f, 'second', ['-B', 'work/second', '--depth', '1']);
  assert.equal(git(f.cache, 'rev-parse', '--is-shallow-repository'), 'false');
  assert.equal(git(f.tree('first'), 'rev-list', '--count', 'HEAD'), '3');
  assert.equal(git(f.tree('second'), 'rev-list', '--count', 'HEAD'), '3');
});

test('missing requested branch fails instead of checking out a stale default', () => {
  const f = fixture();
  manage(f, 'first', ['-B', 'work/first', '--depth', '1']);
  manage(f, 'second', ['-b', 'missing', '--depth', '1'], 1);
  assert.equal(existsSync(join(f.tree('second'), '.git')), false);
  assert.equal(git(f.tree('first'), 'rev-parse', 'HEAD'), f.main);
});

test('invalid and missing depth fail before creating a cache', () => {
  const f = fixture();
  for (const args of [['0'], ['-1'], ['abc'], ['1.5'], [''], []]) {
    const output = manage(f, 'invalid', ['--depth', ...args], 1);
    assert.match(output, /positive integer/i);
    assert.equal(existsSync(f.cache), false);
  }
});
