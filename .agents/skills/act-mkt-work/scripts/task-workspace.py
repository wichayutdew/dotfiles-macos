#!/usr/bin/env python3
"""Prepare all approved repository worktrees from an absolute JSON task manifest.

Usage: task-workspace.py manifest.json [--check]
Exit 3: unsafe/missing identity; exit 10: recorded base is no longer an ancestor.
No tracker/review writes, checkout resets, branch stealing or implicit cleanup.
"""
import argparse
import fcntl
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
from urllib.parse import urlsplit

STATE = '.task-workspace.json'
SEGMENT = re.compile(r'[A-Za-z0-9][A-Za-z0-9._-]*\Z')
GIT_ENV = dict(os.environ)
SHA = re.compile(r'(?:[0-9a-fA-F]{40}|[0-9a-fA-F]{64})\Z')

class Unsafe(ValueError):
    pass

class Stale(Unsafe):
    pass


def command(*args):
    result = subprocess.run([str(x) for x in args], text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=GIT_ENV)
    if result.returncode:
        raise Unsafe(result.stderr.strip() or f'command failed: {args[0]}')
    return result.stdout.rstrip('\n')


def git(path, *args):
    # Avoid optional index writes, including in the read-only --check route.
    return command('git', '--no-optional-locks', '-c', 'core.fsmonitor=false', '-C', path, *args)


def absolute(value, label):
    if not isinstance(value, str) or not Path(value).is_absolute():
        raise Unsafe(f'{label} must be an absolute path')
    path = Path(value)
    if path != path.resolve():
        raise Unsafe(f'{label} contains a symlink or noncanonical path: {path}')
    return path


def origin_id(value):
    if value.startswith(('/', './', '../')) or value.startswith('file://'):
        return 'file:' + str(Path(value[7:] if value.startswith('file://') else value).resolve())
    if '://' in value:
        parsed = urlsplit(value)
        host = (parsed.hostname or '').lower()
        path = parsed.path
        if parsed.port:
            host += ':' + str(parsed.port)
    elif ':' in value:
        host, path = value.split(':', 1)
        host = host.rsplit('@', 1)[-1].lower()
    else:
        raise Unsafe(f'origin must be an absolute local path or clone URL: {value}')
    return host + '/' + path.strip('/').removesuffix('.git')


def validate_checkout(path, origin):
    if not path.exists() or path.is_symlink():
        raise Unsafe(f'missing or symlink checkout: {path}')
    if Path(git(path, 'rev-parse', '--show-toplevel')).resolve() != path:
        raise Unsafe(f'not a checkout root: {path}')
    if origin_id(git(path, 'remote', 'get-url', 'origin')) != origin_id(origin):
        raise Unsafe(f'origin mismatch: {path}')


def common_dir(path):
    common = Path(git(path, 'rev-parse', '--git-common-dir'))
    return (path / common).resolve() if not common.is_absolute() else common.resolve()


def branch(path):
    return git(path, 'rev-parse', '--abbrev-ref', 'HEAD')


def has_commit(path, sha):
    return subprocess.run(['git', '--no-optional-locks', '-C', str(path), 'cat-file', '-e', sha+'^{commit}'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, env=GIT_ENV).returncode == 0


def configuration(manifest):
    workspace = manifest.get('workspace', {})
    launch = absolute(workspace.get('launchDirectory'), 'launchDirectory')
    if not launch.is_dir():
        raise Unsafe(f'launchDirectory does not exist: {launch}')
    work_id = workspace.get('workId', '')
    if not isinstance(work_id, str) or not SEGMENT.fullmatch(work_id):
        raise Unsafe('workId must be a ticket ID or short summary without path separators')
    if workspace.get('workIdSource') not in ('tracker', 'summary'):
        raise Unsafe('workIdSource must be tracker or summary')
    root = absolute(workspace.get('root'), 'root')
    if root != launch / work_id:
        raise Unsafe('root must be launchDirectory/workId; retain the original launch directory on continuation')
    repos = manifest.get('repositories')
    if not isinstance(repos, list) or not repos:
        raise Unsafe('repositories must be a nonempty list')
    names = set()
    for spec in repos:
        name = spec.get('name', '')
        if not isinstance(name, str) or not SEGMENT.fullmatch(name) or name in names:
            raise Unsafe(f'invalid or duplicate repository name: {name}')
        names.add(name)
        if spec.get('role') not in ('primary', 'editable', 'reference'):
            raise Unsafe(f'invalid role: {name}')
        if absolute(spec.get('cwd'), 'cwd') != root / name:
            raise Unsafe(f'cwd must be root/name: {name}')
        origin = spec.get('origin')
        if not isinstance(origin, str) or not origin or origin.startswith('-'):
            raise Unsafe(f'invalid origin: {name}')
        origin_id(origin)
        sha = spec.get('rev') if spec['role']=='reference' else spec.get('baseHead')
        if not isinstance(sha, str) or not SHA.fullmatch(sha):
            raise Unsafe(f'pinned commit SHA required: {name}')
        if spec.get('head') and (not isinstance(spec['head'],str) or not SHA.fullmatch(spec['head'])):
            raise Unsafe(f'invalid recovery head SHA: {name}')
        if spec['role'] != 'reference':
            source = spec.get('sourceBranch', '')
            if not isinstance(source, str) or source.startswith('-') or source == 'HEAD':
                raise Unsafe(f'invalid source branch: {name}')
            command('git', 'check-ref-format', 'refs/heads/'+source)
        if spec.get('primaryCheckout'):
            absolute(spec['primaryCheckout'], 'primaryCheckout')
    return root, repos


def backing(root, spec):
    return Path(spec['primaryCheckout']) if spec.get('primaryCheckout') else root / '.sources' / spec['name']


def verify_target(root, spec):
    cwd = Path(spec['cwd'])
    validate_checkout(cwd, spec['origin'])
    source = backing(root, spec)
    validate_checkout(source, spec['origin'])
    if not (cwd / '.git').is_file() or common_dir(cwd) != common_dir(source) or cwd == source:
        raise Unsafe(f'expected linked worktree of {source}: {cwd}')
    current = branch(cwd)
    wanted = 'HEAD' if spec['role']=='reference' else spec['sourceBranch']
    if current != wanted:
        raise Unsafe(f'branch mismatch at {cwd}: {current}, expected {wanted}')
    head = git(cwd, 'rev-parse', 'HEAD')
    pinned = spec['rev'] if spec['role']=='reference' else spec['baseHead']
    if not has_commit(cwd, pinned):
        raise Unsafe(f'pinned commit unavailable: {pinned} at {cwd}')
    if spec['role']=='reference':
        if head != pinned:
            raise Unsafe(f'reference revision mismatch: {cwd}')
        ancestor = True
    else:
        ancestor = subprocess.run(['git','--no-optional-locks','-C',str(cwd),'merge-base','--is-ancestor',pinned,head], stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL, env=GIT_ENV).returncode == 0
        if not ancestor:
            raise Stale(f'baseHead is no longer an ancestor of {cwd} HEAD')
    return dict(spec, primaryCheckout=str(source), head=head, branch=current,
                dirty=git(cwd,'status','--porcelain=v1','--untracked-files=all'), baseIsAncestor=ancestor)


def register(path, kind):
    cleanup = Path(__file__).with_name('cleanup-workspaces.py')
    command(sys.executable, cleanup, 'register', '--kind', kind, path)


def save(path, value):
    descriptor, temporary = tempfile.mkstemp(prefix='.task-workspace-', dir=path.parent)
    try:
        with os.fdopen(descriptor, 'w') as output:
            json.dump(value, output, indent=2)
            output.write('\n')
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def reconcile_missing_entry(path, kind, ledger):
    """Forget only an owned resource whose path AND Git registration are gone.

    Never remove files or prune live/stale worktree registrations. This permits
    re-registration after a runtime removed its exact checkout without updating
    our shared ledger, while retaining the ledger's replacement-path guard.
    """
    if path.exists() or path.is_symlink() or not ledger.exists():
        return
    with ledger.with_suffix(ledger.suffix+'.lock').open('a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX)
        data=json.loads(ledger.read_text())
        if data.get('version') != 1 or not isinstance(data.get('resources'),list):
            raise Unsafe('unsupported cleanup ledger')
        entry=next((value for value in data['resources'] if value.get('path')==str(path)),None)
        if entry:
            if entry.get('kind') != kind or Path(entry['gitDir']).exists():
                raise Unsafe(f'missing resource retains a Git registration; targeted recovery required: {path}')
            data['resources']=[value for value in data['resources'] if value is not entry]
            save(ledger,data)


def preflight(root, repos, check):
    for spec in repos:
        cwd = Path(spec['cwd'])
        source = backing(root, spec)
        # Resolving both future paths also refuses symlinked parents.
        absolute(str(source), 'backing checkout')
        if source.exists():
            validate_checkout(source, spec['origin'])
            pinned = spec['rev'] if spec['role']=='reference' else spec['baseHead']
            if not has_commit(source,pinned):
                if check:
                    raise Unsafe(f'pinned commit unavailable: {pinned} at {source}')
                git(source,'fetch','--no-tags','origin',pinned)
        elif (spec.get('primaryCheckout') and source != root / '.sources' / spec['name']) or check:
            raise Unsafe(f'missing backing checkout: {source}')
        if cwd.exists() or cwd.is_symlink():
            verify_target(root, spec)
        elif check:
            raise Unsafe(f'missing worktree: {cwd}')
        elif source.exists() and spec['role'] != 'reference':
            occupied = git(source, 'worktree', 'list', '--porcelain')
            if 'branch refs/heads/'+spec['sourceBranch']+'\n' in occupied+'\n':
                raise Unsafe(f'branch already checked out: {spec["sourceBranch"]}')
            # A preexisting branch must start at the approved base, not silently adopt other work.
            ref = 'refs/heads/'+spec['sourceBranch']
            result = subprocess.run(['git','-C',str(source),'rev-parse','--verify',ref], text=True,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,env=GIT_ENV)
            if result.returncode == 0 and result.stdout.strip() != spec.get('head',spec['baseHead']):
                raise Unsafe(f'existing branch differs from approved baseHead: {spec["sourceBranch"]}')


def compatible(previous, current):
    if previous.get('workspace') != current['workspace']:
        return False
    bindings = {spec['name']:spec for spec in current['repositories']}
    return all(bindings.get(spec['name']) == spec for spec in previous.get('repositories',[]))


def prepare(manifest, check):
    if check:
        GIT_ENV['GIT_NO_LAZY_FETCH'] = '1'
    root, repos = configuration(manifest)
    state_path = root / STATE
    if state_path.is_symlink():
        raise Unsafe(f'symlink workspace record: {state_path}')
    known = json.loads(state_path.read_text()) if state_path.exists() else None
    if known is not None and (not isinstance(known,dict) or known.get('version') != 1):
        raise Unsafe('unsupported workspace record')
    # Accept both the approved input and our enriched output as restart manifests.
    fields = ('name', 'role', 'origin', 'cwd', 'baseBranch', 'baseHead', 'sourceBranch', 'rev')
    bindings = [dict({key:spec[key] for key in fields if key in spec},
                     primaryCheckout=str(backing(root,spec))) for spec in repos]
    config = {'workspace':manifest['workspace'], 'repositories':bindings}
    if known and not compatible(known.get('configuration',{}),config):
        raise Unsafe('workspace manifest changed; reconcile the recorded configuration before preparation')
    recorded_ledger = known.get('cleanupLedger') if known else None
    supplied_ledger = manifest.get('cleanupLedger')
    environment_ledger = os.environ.get('ACT_MKT_CLEANUP_LEDGER')
    candidates = [str(absolute(value, 'cleanupLedger')) for value in
                  (recorded_ledger, supplied_ledger, environment_ledger) if value]
    if len(set(candidates)) > 1:
        raise Unsafe('cleanup ledger conflicts with the recorded workspace; no implicit ledger migration')
    ledger = candidates[0] if candidates else str(Path.home()/'.local/state/act-mkt/workspaces.json')
    ledger_path = absolute(ledger,'cleanupLedger')
    resources = [root] + [backing(root,spec) for spec in repos]
    if any(ledger_path == resource or resource in ledger_path.parents for resource in resources):
        raise Unsafe('cleanup ledger must live outside task resources')
    GIT_ENV['ACT_MKT_CLEANUP_LEDGER'] = ledger
    preflight(root, repos, check)
    if check:
        result = dict(manifest, repositories=[verify_target(root,spec) for spec in repos], cleanupLedger=ledger)
        return result
    if root.exists() and not known:
        # Discovery clones are deliberately separated from final worktree paths.
        unexpected = {p.name for p in root.iterdir()} - {'.sources'}
        if unexpected:
            raise Unsafe(f'workspace directory already contains unbound paths: {root}')
    root.mkdir(exist_ok=True)
    lock_path = root / '.task-workspace.lock'
    if lock_path.is_symlink():
        raise Unsafe(f'symlink workspace lock: {lock_path}')
    with lock_path.open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        # Another preparer may have completed while this process waited.
        if state_path.exists():
            latest = json.loads(state_path.read_text())
            if not compatible(latest.get('configuration',{}),config):
                raise Unsafe('workspace configuration changed while waiting for preparation lock')
        preflight(root,repos,False)
        save(state_path, {'version':1, 'configuration':config, 'cleanupLedger':ledger})
        for spec in repos:
            source = backing(root,spec)
            cwd = Path(spec['cwd'])
            if cwd.exists():
                continue
            fresh = not source.exists()
            if fresh:
                reconcile_missing_entry(source,'clone',ledger_path)
                source.parent.mkdir(exist_ok=True)
                command('git','clone','--filter=blob:none','--no-checkout','--',spec['origin'],source)
                register(source,'clone')
            pinned = spec['rev'] if spec['role']=='reference' else spec['baseHead']
            if not has_commit(source,pinned):
                git(source,'fetch','--no-tags','origin',pinned)
            if not has_commit(source,pinned):
                raise Unsafe(f'cannot retrieve approved commit: {pinned}')
            start = pinned if spec['role']=='reference' else spec.get('head',pinned)
            if not has_commit(source,start):
                git(source,'fetch','--no-tags','origin',start)
            if spec['role'] != 'reference' and subprocess.run(
                    ['git','--no-optional-locks','-C',str(source),'merge-base','--is-ancestor',pinned,start],
                    stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,env=GIT_ENV).returncode:
                raise Stale(f'recovery head does not contain approved baseHead: {spec["name"]}')
            if fresh:
                # A freshly cloned default branch must not reserve a reviewed
                # source branch (for example a fork's main branch). Never detach
                # an existing or user-supplied backing checkout.
                git(source,'checkout','--detach',start)
            reconcile_missing_entry(cwd,'worktree',ledger_path)
            if spec['role']=='reference':
                git(source,'worktree','add','--detach',str(cwd),pinned)
            else:
                ref='refs/heads/'+spec['sourceBranch']
                present=subprocess.run(['git','-C',str(source),'show-ref','--verify','--quiet',ref],env=GIT_ENV).returncode == 0
                if present:
                    if git(source,'rev-parse',ref) != start:
                        raise Unsafe(f'existing branch differs from approved baseHead: {spec["sourceBranch"]}')
                    git(source,'worktree','add',str(cwd),spec['sourceBranch'])
                else:
                    git(source,'worktree','add','-b',spec['sourceBranch'],str(cwd),start)
            register(cwd,'worktree')
        result = dict(manifest, repositories=[verify_target(root,spec) for spec in repos], cleanupLedger=ledger)
        save(state_path, {'version':1,'configuration':config,'cleanupLedger':ledger,'result':result})
        return result


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('manifest',type=Path)
    parser.add_argument('--check',action='store_true')
    args=parser.parse_args()
    try:
        manifest=json.loads(args.manifest.read_text())
        print(json.dumps(prepare(manifest,args.check),indent=2))
    except (Unsafe, OSError, ValueError, KeyError, TypeError) as error:
        print(str(error),file=sys.stderr)
        return 10 if isinstance(error,Stale) else 3
    return 0

if __name__=='__main__':
    raise SystemExit(main())
