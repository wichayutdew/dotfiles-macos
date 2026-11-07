#!/usr/bin/env python3
"""Manage manifest repositories without force-removing work or shared Git stores."""
import argparse
import fcntl
import os
from pathlib import Path
import re
import shlex
import shutil
import subprocess
import sys


def git(directory, *args):
    return subprocess.run(['git', '-C', str(directory), *args], check=True,
                          capture_output=True, text=True).stdout.strip()


def workspace_root():
    configured = os.environ.get('ARCHITECTURE_WORKSPACE_ROOT')
    if configured:
        root = Path(configured).resolve(strict=True)
        if not (root / 'repos.conf').is_file():
            raise ValueError('ARCHITECTURE_WORKSPACE_ROOT must contain repos.conf')
        return root
    for start in (Path.cwd(), Path(__file__).resolve().parent):
        for root in (start, *start.parents):
            if (root / 'repos.conf').is_file():
                return root
    raise ValueError('Run from the workspace containing repos.conf or set ARCHITECTURE_WORKSPACE_ROOT')


def validate_name(name):
    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._-]*', name):
        raise ValueError('Repository name must be a single safe directory name')


def manifest(root):
    rows = []
    names = set()
    for line in (root / 'repos.conf').read_text().splitlines(keepends=True):
        fields = shlex.split(line, comments=True)
        if fields:
            if len(fields) not in (2, 3):
                raise ValueError('Malformed repos.conf row')
            validate_name(fields[0])
            if fields[0] in names:
                raise ValueError('Duplicate repository name in repos.conf')
            names.add(fields[0])
        rows.append((line, fields))
    return rows


def paths(root, name):
    validate_name(name)
    target = root / 'repos' / name
    cache = root / 'repo-cache' / (name + '.git')
    for path in (root / 'repos.conf', root / 'repos', root / 'repo-cache', target, cache):
        if path.is_symlink():
            raise ValueError(f'Refusing symlink at {path}')
    return target, cache


def verify_cache(cache, url):
    if git(cache, 'rev-parse', '--is-bare-repository') != 'true':
        raise ValueError('Expected a bare cache')
    if git(cache, 'remote', 'get-url', 'origin') != url:
        raise ValueError('Existing cache origin conflicts with requested URL')


def verify_worktree(target, cache):
    if not (target / '.git').is_file():
        raise ValueError('Expected a managed Git worktree; plain clones are preserved')
    common = Path(git(target, 'rev-parse', '--path-format=absolute', '--git-common-dir')).resolve()
    if common != cache.resolve():
        raise ValueError('Worktree belongs to another cache')


def add(root, url, name, branch=None):
    requested_branch = branch
    target, cache = paths(root, name)
    if not url or url.startswith('-') or any(c.isspace() or c in "#'\"" for c in url):
        raise ValueError('Invalid repository URL')
    if branch:
        git(root, 'check-ref-format', '--branch', branch)
    rows = manifest(root)
    existing = next((f for _, f in rows if f and f[0] == name), None)
    if existing and (existing[1] != url or (branch and existing[2:] != [branch])):
        raise ValueError('Requested repository conflicts with repos.conf')
    if existing and not branch and len(existing) == 3:
        branch = existing[2]
        git(root, 'check-ref-format', '--branch', branch)
    if target.exists() and not cache.exists():
        raise ValueError('Unmanaged target already exists')
    if cache.exists():
        verify_cache(cache, url)
    if target.exists():
        verify_worktree(target, cache)
        if branch and git(target, 'branch', '--show-current') != branch:
            raise ValueError('Existing worktree branch conflicts with request')
    (root / 'repos').mkdir(exist_ok=True)
    (root / 'repo-cache').mkdir(exist_ok=True)
    if not cache.exists():
        subprocess.run(['git', 'clone', '--bare', '--', url, str(cache)], check=True)
        git(cache, 'config', 'remote.origin.fetch', '+refs/heads/*:refs/remotes/origin/*')
    if not target.exists():
        git(cache, 'fetch', '--prune', 'origin')
        branch = branch or git(cache, 'symbolic-ref', '--short', 'HEAD')
        if git(cache, 'branch', '--list', branch):
            git(cache, 'worktree', 'add', str(target), branch)
        else:
            git(cache, 'worktree', 'add', '-b', branch, str(target), 'origin/' + branch)
        git(target, 'branch', '--set-upstream-to=origin/' + branch, branch)
    if not existing:
        with (root / 'repos.conf').open('a') as output:
            if rows and not rows[-1][0].endswith('\n'):
                output.write('\n')
            output.write(shlex.join([name, url] + ([requested_branch] if requested_branch else [])) + '\n')
    print(f'Ready: repos/{name}')


def remove(root, name, remove_cache=False):
    target, cache = paths(root, name)
    rows = manifest(root)
    existing = next((f for _, f in rows if f and f[0] == name), None)
    if not existing:
        raise ValueError('Repository is not listed in repos.conf')
    if not cache.exists():
        raise ValueError('Cache missing; reconcile repository state before removal')
    verify_cache(cache, existing[1])
    details = git(cache, 'worktree', 'list', '--porcelain')
    worktrees = [Path(line[9:]).resolve() for line in details.splitlines()
                 if line.startswith('worktree ') and Path(line[9:]).resolve() != cache.resolve()]
    if any(path != target.resolve() for path in worktrees):
        raise ValueError('Other worktrees use this cache; stop and remove their tasks first')
    if '\nlocked' in details or '\nprunable' in details:
        raise ValueError('Worktree is locked or requires reconciliation')
    if target.exists():
        verify_worktree(target, cache)
        if git(target, 'status', '--porcelain', '--untracked-files=all', '--ignored'):
            raise ValueError('Worktree contains local or ignored files; preserve them before removal')
        # Git status omits local edits behind assume-unchanged or skip-worktree flags.
        entries = git(target, 'ls-files', '-v', '-z').split('\0')
        if any(entry and (entry[0].islower() or entry[0] == 'S') for entry in entries):
            raise ValueError('Worktree has hidden index flags; reconcile them before removal')
    # Fresh remote evidence is required before destroying a checkout or cache.
    git(cache, 'fetch', '--prune', 'origin')
    remote_tips = git(cache, 'for-each-ref', '--format=%(objectname)', 'refs/remotes/origin').splitlines()
    tips = git(cache, 'for-each-ref', '--format=%(objectname)', 'refs/heads', 'refs/tags', 'refs/stash', 'refs/notes').splitlines() if remove_cache else []
    if target.exists():
        tips.append(git(target, 'rev-parse', 'HEAD'))
    for tip in set(tips):
        if not any(subprocess.run(['git', '-C', str(cache), 'merge-base', '--is-ancestor', tip, remote],
                                  capture_output=True).returncode == 0 for remote in remote_tips):
            raise ValueError('Unpushed commits would lose their checkout or cache; preserve them first')
    if target.exists():
        git(cache, 'worktree', 'remove', str(target))
    if remove_cache:
        shutil.rmtree(cache)
    (root / 'repos.conf').write_text(''.join(line for line, fields in rows if not fields or fields[0] != name))
    print(f'Removed: {name}' + (' (cache removed)' if remove_cache else ' (cache retained)'))


def initialize(root, mode, no_check):
    if mode == '--clean':
        raise ValueError('Bulk --clean is disabled; use remove-repo.sh <name> [--remove-cache] after preserving work')
    for _, fields in manifest(root):
        if not fields:
            continue
        name, url, *branch = fields
        target, cache = paths(root, name)
        if mode == '--status':
            status = ('branch=' + git(target, 'branch', '--show-current') +
                      ' changes=' + str(len(git(target, 'status', '--short').splitlines()))) if target.exists() else 'not set up'
            print(f'{name}: {status}')
        else:
            add(root, url, name, branch[0] if branch else None)
            if mode == '--pull':
                if git(target, 'status', '--porcelain'):
                    raise ValueError(f'{name} has local changes; pull refused')
                git(cache, 'fetch', '--prune', 'origin')
                git(target, 'pull', '--ff-only')
    if mode == '--pull' and not no_check:
        post_pull()


def post_pull():
    # Keep the legacy hook output in the shared implementation.
    print('\n=== Post-pull checks ===')
    print('No post-pull checks are currently configured.')
    print('=== Post-pull checks complete ===')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    add_parser = commands.add_parser('add')
    add_parser.add_argument('url')
    add_parser.add_argument('name', nargs='?')
    add_parser.add_argument('branch', nargs='?')
    remove_parser = commands.add_parser('remove')
    remove_parser.add_argument('name')
    remove_parser.add_argument('--remove-cache', action='store_true')
    init_parser = commands.add_parser('init')
    mode = init_parser.add_mutually_exclusive_group()
    for flag in ('--pull', '--status', '--clean'):
        mode.add_argument(flag, dest='mode', action='store_const', const=flag)
    init_parser.add_argument('--no-check', action='store_true')
    commands.add_parser('post-pull')
    args = parser.parse_args()
    if args.command == 'post-pull':
        post_pull()
        return
    root = workspace_root()
    # Serialize manifest and Git changes without touching delegation or profile state.
    with (root / '.architecture-repos.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        if args.command == 'add':
            add(root, args.url, args.name or args.url.rstrip('/').split('/')[-1].removesuffix('.git'), args.branch)
        elif args.command == 'remove':
            remove(root, args.name, args.remove_cache)
        else:
            initialize(root, args.mode, args.no_check)


if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        print(f'Error: {error}', file=sys.stderr)
        sys.exit(1)
