#!/usr/bin/env python3
"""ADB capture and evidence-checked reporting; app assertions belong to the agent."""
import argparse
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys
from urllib.parse import quote, urlparse
import uuid

SKILL = Path(__file__).resolve().parents[1]
STATUSES = {'PASS', 'FAIL', 'BLOCKED', 'SKIPPED', 'NOT_RUN'}
FLAVORS = {'production_rc': 'agoda', 'beta': 'agoda4'}


def now():
    return datetime.now(timezone.utc).isoformat()


def select_device(output, serial=None):
    devices = {}
    for line in output.splitlines():
        parts = line.split()
        if len(parts) >= 2 and parts[1] in {'device', 'offline', 'unauthorized', 'recovery'}:
            devices[parts[0]] = parts[1]
    if serial:
        if devices.get(serial) != 'device':
            raise ValueError(f'Device {serial} is absent or not authorized/online')
        return serial
    ready = [key for key, value in devices.items() if value == 'device']
    if len(ready) != 1:
        raise ValueError('Select an online device with --serial; ready devices: ' + ', '.join(ready))
    return ready[0]


def create_run(mr_url=None, app_flavor=None, *, branch=None, release_candidate=None):
    if sum(value is not None for value in [mr_url, branch, release_candidate]) != 1:
        raise ValueError('Choose exactly one target: MR, branch or release candidate')
    if app_flavor is not None and app_flavor not in FLAVORS:
        raise ValueError('Choose production_rc or beta app flavor')
    if mr_url is not None:
        parsed = urlparse(mr_url)
        if parsed.scheme != 'https' or parsed.hostname != 'gitlab.agodadev.io' or not re.fullmatch(r'/.+/-/merge_requests/[0-9]+', parsed.path) or parsed.query or parsed.fragment or parsed.username or parsed.password:
            raise ValueError('Expected an HTTPS Agoda GitLab merge-request URL without query or credentials')
    else:
        ref = branch if branch is not None else release_candidate
        if not isinstance(ref, str) or not ref.strip() or re.search(r'[\x00-\x1f\x7f]', ref):
            raise ValueError('Branch or release candidate needs a nonempty reference without control characters')
    definitions = json.loads((SKILL / 'references/smoke-cases.json').read_text())
    cases = []
    for locale in ['en', 'th']:
        for launch in ['cold', 'warm']:
            for link in definitions['links']:
                url = link['url'].replace('agoda://', FLAVORS[app_flavor] + '://', 1) if app_flavor else link['url']
                cases.append({'id': f'{link["id"]}-{locale}-{launch}', 'suite': 'links', 'locale': locale, 'launch_state': launch, 'url': url, 'canonical_url': link['url'], 'expected': [link['destination'], 'No crash, blank screen or unexpected browser fallback'], 'assertion_source': 'proposed; reconcile with requirements'})
        cases.append({'id': f'FUNNEL-{locale}', 'suite': 'funnel', 'locale': locale, 'expected': ['App Home > Activities tile > Activities Home > search > detail > offer/date > booking form', 'Activity, offer, date and traveler selection remain consistent; stop before submission']})
    if mr_url is not None:
        for variant in ['A', 'B']:
            cases.append({'id': f'FEATURE-{variant}', 'suite': 'feature', 'locale': 'en', 'expected': []})
    for case in cases:
        case.update({'attempt': 1, 'requirements': [], 'steps': [], 'actual': '', 'status': 'NOT_RUN', 'experiments': {}, 'variant_verified': False, 'evidence': [], 'blocker': ''})
    context = {'environment': '', 'device': {}, 'app': {'flavor': app_flavor}, 'web': {}, 'runbook': definitions['source'], 'runbook_snapshot': definitions['source_snapshot']}
    scope = {'experiments': None, 'requirements': [], 'required_combinations': [], 'exclusions': []}
    if mr_url is not None:
        context.update({'mr_url': mr_url, 'mr_sha': '', 'mr_type': ''})
    else:
        context['target'] = {'kind': 'branch' if branch is not None else 'release_candidate', 'ref': ref.strip(), 'sha': '', 'type': ''}
        scope.update({'mode': 'smoke', 'experiments': [], 'feature_deferral_reason': 'Baseline smoke; no feature sign-off requested', 'no_experiment_reason': 'Baseline smoke; no experiment overrides requested'})
    return {'schema_version': 1, 'started_at': now(), 'context': context, 'scope': scope, 'required_case_ids': [c['id'] for c in cases], 'settings': {'before': '', 'restoration': 'pending', 'evidence': []}, 'cases': cases}


def run_target(context):
    target = context.get('target', {'kind': 'mr', 'ref': context.get('mr_url', ''), 'sha': context.get('mr_sha', ''), 'type': context.get('mr_type', '')})
    if not isinstance(target, dict):
        raise ValueError('Run target must be an object')
    return target


def local_file(root, name):
    if not isinstance(name, str) or not name or Path(name).is_absolute():
        return None
    path = (Path(root) / name).resolve()
    if not path.is_relative_to(Path(root).resolve()) or not path.is_file() or path.stat().st_size == 0:
        return None
    return path


def media_path(root, name):
    path = local_file(root, name)
    if path is None:
        return None
    with path.open('rb') as source:
        head = source.read(32)
        source.seek(max(0, path.stat().st_size - 12))
        tail = source.read()
    suffix = path.suffix.lower()
    if suffix == '.png' and head.startswith(b'\x89PNG\r\n\x1a\n') and b'IHDR' in head and b'IEND' in tail:
        return path
    if suffix in {'.jpg', '.jpeg'} and head.startswith(b'\xff\xd8\xff') and tail.endswith(b'\xff\xd9'):
        return path
    if suffix in {'.mp4', '.mov'} and len(head) >= 12 and head[4:8] == b'ftyp' and path.stat().st_size > 32:
        probe = shutil.which('ffprobe')
        if probe:
            try:
                result = subprocess.run([probe, '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=duration', '-of', 'json', str(path)], check=True, capture_output=True, text=True, timeout=10)
                if not any(float(stream.get('duration', 0)) > 0 for stream in json.loads(result.stdout).get('streams', [])):
                    return None
            except (OSError, ValueError, subprocess.SubprocessError):
                return None
        return path
    return None


def app_details_present(app, root):
    return all(app.get(key) for key in ['package', 'version', 'build', 'source']) and bool(re.fullmatch(r'[a-f0-9]{64}', app.get('sha256', ''))) and any(local_file(root, name) for name in app.get('verification_evidence', []))


def assess_run(run, root):
    issues = []
    if run.get('schema_version') != 1:
        raise ValueError('Unsupported run schema_version')
    cases = run.get('cases')
    if not isinstance(cases, list) or not cases:
        raise ValueError('Run needs a nonempty cases list')
    context = run.get('context', {})
    target = run_target(context)
    kind, ref, sha, build_type = (target.get(key, '') for key in ['kind', 'ref', 'sha', 'type'])
    if kind not in {'mr', 'branch', 'release_candidate'} or not isinstance(ref, str) or not ref.strip() or re.search(r'[\x00-\x1f\x7f]', ref):
        issues.append('Test target identity is missing or invalid')
    if (kind in {'mr', 'branch'} or build_type == 'cxp' or sha) and (not isinstance(sha, str) or not re.fullmatch(r'[a-f0-9]{40,64}', sha)):
        issues.append('MR revision identity is unverified' if kind == 'mr' else 'Target revision identity is unverified')
    app = context.get('app', {})
    if not FLAVORS.get(app.get('flavor')) or FLAVORS[app['flavor']] not in app.get('schemes', []):
        issues.append('App flavor or APK deep-link binding is unverified')
    if app.get('identity_verified') is not True:
        issues.append('Android app build identity is unverified')
    if not app_details_present(app, root):
        issues.append('Android app identity details or verification evidence are missing')
    if build_type not in {'native', 'cxp'}:
        issues.append('MR type is unresolved' if kind == 'mr' else 'Build type is unresolved')
    if build_type == 'cxp' and context.get('web', {}).get('identity_verified') is not True:
        issues.append('Served web revision identity is unverified')
    web = context.get('web', {})
    if build_type == 'cxp' and (not web.get('branch') or web.get('sha') != sha or not any(local_file(root, name) for name in web.get('verification_evidence', []))):
        issues.append('Web branch/revision details or verification evidence are missing')
    if not context.get('device', {}).get('serial') or not context.get('environment'):
        issues.append('Device or environment identity is missing')
    scope = run.get('scope', {})
    mode = scope.get('mode', 'full')
    smoke_only = mode == 'smoke'
    if mode not in {'full', 'smoke'}:
        issues.append('Unknown run scope mode')
    if smoke_only and not scope.get('feature_deferral_reason'):
        issues.append('Smoke scope needs an explicit feature deferral reason')
    if smoke_only and any(scope.get(key) for key in ['experiments', 'requirements', 'required_combinations']):
        issues.append('Smoke scope must not declare feature gates')
    experiments = scope.get('experiments')
    if not isinstance(experiments, list):
        issues.append('Experiment scope is unresolved')
        experiments = []
    elif not experiments and not scope.get('no_experiment_reason'):
        issues.append('No-experiment scope needs a reason')
    if not smoke_only and not scope.get('requirements'):
        issues.append('Feature acceptance requirements have not been defined')
    settings = run.get('settings', {})
    if not local_file(root, settings.get('before')):
        issues.append('Settings before-state evidence is missing')
    if settings.get('restoration') not in {'restored', 'not_changed'}:
        issues.append('Settings cleanup is unfinished')
    elif not any(local_file(root, name) for name in settings.get('evidence', [])):
        issues.append('Settings cleanup evidence is missing')
    required = run.get('required_case_ids', [])
    if not required:
        issues.append('Required coverage is undefined')
    missing = set(required) - {c.get('id') for c in cases}
    if missing:
        issues.append('Missing required case: ' + ', '.join(sorted(missing)))
    baseline = {case['id']: case for case in create_run(branch='main')['cases']}
    for case_id in baseline:
        if case_id not in required or not any(c.get('id') == case_id for c in cases):
            issues.append('Missing canonical smoke case: ' + case_id)
    seen = set()
    latest = {}
    for case in cases:
        key = (case.get('id'), case.get('attempt', 1))
        if type(key[1]) is not int or key[1] < 1:
            raise ValueError('Case attempt must be a positive integer')
        label = f'{key[0]} attempt {key[1]}'
        if key in seen:
            issues.append(f'{label}: duplicate attempt; append reruns with a new attempt number')
        seen.add(key)
        if key[0] not in latest or key[1] > latest[key[0]].get('attempt', 1):
            latest[key[0]] = case
        status = case.get('status')
        if status not in STATUSES:
            raise ValueError(f'{label}: invalid status {status!r}')
        package = case.get('app_package', app.get('package'))
        tested_app = app if package == app.get('package') else context.get('additional_apps', {}).get(package, {})
        scheme = FLAVORS.get(tested_app.get('flavor'))
        original = baseline.get(key[0])
        if original:
            expected_url = original.get('url')
            if expected_url and scheme:
                expected_url = expected_url.replace('agoda://', scheme + '://', 1)
            allowed_urls = {expected_url}
            if status in {'NOT_RUN', 'BLOCKED', 'SKIPPED'}:
                allowed_urls.add(original.get('url'))
            if any(case.get(field) != original.get(field) for field in ['suite', 'locale', 'launch_state', 'canonical_url']) or case.get('url') not in allowed_urls:
                issues.append(f'{label}: canonical smoke case binding changed')
        if status in {'PASS', 'FAIL'}:
            if case.get('suite') == 'links' and urlparse(case.get('url', '')).scheme in {'agoda', 'agoda4'} and (scheme not in tested_app.get('schemes', []) or urlparse(case['url']).scheme != scheme):
                issues.append(f'{label}: deep-link URL does not match verified app flavor')
            if package != app.get('package'):
                alternate = context.get('additional_apps', {}).get(package, {})
                if alternate.get('package') != package or alternate.get('identity_verified') is not True or not app_details_present(alternate, root):
                    issues.append(f'{label}: alternate app package identity is unverified')
            if not case.get('steps') or not case.get('expected') or not case.get('actual'):
                issues.append(f'{label}: missing steps, expected or actual result')
            relevant_experiments = experiments if case.get('suite') == 'feature' else list(case.get('experiments', {}))
            if relevant_experiments and (case.get('variant_verified') is not True or any(case.get('experiments', {}).get(exp) not in {'A', 'B'} for exp in relevant_experiments)):
                issues.append(f'{label}: effective experiment variant is unverified')
        if status == 'FAIL' and not any(media_path(root, name) for name in case.get('evidence', [])):
            issues.append(f'{label}: failure media is missing or invalid')
        if status in {'BLOCKED', 'SKIPPED'} and not case.get('blocker'):
            issues.append(f'{label}: missing blocker/skip reason')
        for name in case.get('evidence', []):
            if not local_file(root, name):
                issues.append(f'{label}: missing or unsafe attachment {name!r}')
    executed_features = [c for c in cases if c.get('suite') == 'feature' and c.get('status') in {'PASS', 'FAIL'}]
    if not smoke_only and not any(c.get('suite') == 'feature' for c in cases):
        issues.append('MR feature coverage is missing' if kind == 'mr' else 'Feature coverage is missing')
    for exp in experiments:
        if not {'A', 'B'}.issubset({c.get('experiments', {}).get(exp) for c in executed_features if c.get('variant_verified') is True}):
            issues.append(f'{exp}: feature A/B coverage is incomplete')
    for combination in scope.get('required_combinations', []):
        if not any(c.get('variant_verified') is True and all(c.get('experiments', {}).get(k) == v for k, v in combination.items()) for c in executed_features):
            issues.append('Missing experiment combination: ' + json.dumps(combination, sort_keys=True))
    covered_requirements = {r for c in executed_features for r in c.get('requirements', [])}
    for requirement in scope.get('requirements', []):
        if requirement not in covered_requirements:
            issues.append('Uncovered feature requirement: ' + requirement)
    counts = dict(Counter(c['status'] for c in latest.values()))
    attempt_counts = dict(Counter(c['status'] for c in cases))
    verdict = 'FAIL' if attempt_counts.get('FAIL') else 'INCOMPLETE' if issues or any(c['status'] != 'PASS' for c in latest.values()) else 'PASS'
    return {'verdict': verdict, 'evidence_complete': not issues, 'counts': counts, 'attempt_counts': attempt_counts, 'issues': issues}


def inline(value):
    return str(value).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('|', '&#124;').replace('\n', '<br>')


def render_report(run, root):
    result = assess_run(run, root)
    context = run['context']
    target = run_target(context)
    target_line = f'MR: {target.get("ref", "unresolved")}' if target.get('kind') == 'mr' else f'Target: {inline(target.get("kind") or "unresolved").replace("_", " ")} `{inline(target.get("ref", "unresolved"))}`'
    lines = ['# Activities Android sanity report', '', f'**Result: {result["verdict"]}** · Completeness checks: {"complete" if result["evidence_complete"] else "incomplete"}', '', f'Generated: {now()}', f'Started: {run["started_at"]}', target_line, '', '## Run identity', '', '```json', json.dumps(context, indent=2, ensure_ascii=False), '```', '', '## Scope and restoration', '', '```json', json.dumps({'scope': run['scope'], 'settings': run['settings']}, indent=2, ensure_ascii=False), '```', '', '## Results', '', ' | '.join(f'{status}: {result["counts"].get(status, 0)}' for status in ['PASS', 'FAIL', 'BLOCKED', 'SKIPPED', 'NOT_RUN']), '', '| Test / attempt | App package | Suite | Locale / launch | Experiments | Result |', '|---|---|---|---|---|---|']
    lines.insert(lines.index('## Results') + 2, 'Counts use the latest attempt per test; all attempts and evidence are retained below. Any recorded FAIL keeps the overall result FAIL.')
    if run['scope'].get('mode') == 'smoke':
        feature_label = 'MR feature sign-off' if target.get('kind') == 'mr' else 'Feature sign-off'
        lines.insert(3, 'Scope: link and booking-form smoke journeys only. ' + feature_label + ' is deferred: ' + inline(run['scope'].get('feature_deferral_reason', 'reason missing')))
    for case in run['cases']:
        variants = ', '.join(f'{k}={v}' for k, v in case['experiments'].items()) or 'none recorded'
        lines.append(f'| {inline(case["id"])} / {case.get("attempt", 1)} | {inline(case.get("app_package", context["app"].get("package", "unverified")))} | {inline(case["suite"])} | {inline(case["locale"])} / {inline(case.get("launch_state", "journey"))} | {inline(variants)} | {case["status"]} |')
    lines += ['', '## Completeness checks', '']
    lines += ['- ' + inline(issue) for issue in result['issues']] or ['All required checks satisfied.']
    lines += ['', '## Test details and evidence', '']
    for case in run['cases']:
        lines += [f'### {inline(case["id"])} — attempt {case.get("attempt", 1)} — {case["status"]}', '', f'Expected: {inline("; ".join(case["expected"]))}', f'Actual: {inline(case["actual"]) or "Not executed"}', f'Requirements: {inline(", ".join(case.get("requirements", [])))}', '']
        if case.get('url'):
            lines += [f'URL: `{case["url"]}`', '']
            if case.get('canonical_url') and case['canonical_url'] != case['url']:
                lines += [f'Runbook URL: `{case["canonical_url"]}` (scheme mapped for {inline(context["app"].get("flavor", "unverified"))})', '']
        lines += [f'{index}. {inline(step)}' for index, step in enumerate(case['steps'], 1)]
        if case.get('blocker'):
            lines += ['', 'Blocker / skip reason: ' + inline(case['blocker'])]
        for name in case['evidence']:
            path = local_file(root, name)
            if path:
                label = inline(Path(name).name)
                target = quote(str(path), safe='/')
                lines += ['', f'![{label}]({target})' if media_path(root, name) and path.suffix.lower() in {'.png', '.jpg', '.jpeg'} else f'[{label}]({target})']
        lines.append('')
    return '\n'.join(lines)


def adb_command(adb, serial, *args, timeout=30):
    return subprocess.run([adb, '-s', serial, *args], check=True, capture_output=True, timeout=timeout)


def resolve_device(adb, serial):
    output = subprocess.run([adb, 'devices', '-l'], check=True, capture_output=True, text=True, timeout=15).stdout
    return select_device(output, serial)


def capture(adb, serial, destination):
    destination = Path(destination)
    if destination.suffix.lower() != '.png':
        raise ValueError('Screenshot destination must end in .png')
    if destination.exists():
        raise ValueError('Evidence already exists; use a new attempt filename')
    destination.parent.mkdir(parents=True, exist_ok=True)
    data = adb_command(adb, serial, 'exec-out', 'screencap', '-p').stdout
    with destination.open('xb') as output:
        output.write(data)
    if not media_path(destination.parent, destination.name):
        raise ValueError('Captured screenshot is not recognizable PNG; preserve it for diagnosis')
    return {'serial': serial, 'path': str(destination.resolve()), 'captured_at': now()}


def record(adb, serial, destination, seconds):
    destination = Path(destination)
    if destination.suffix.lower() != '.mp4' or not 1 <= seconds <= 60:
        raise ValueError('Recording needs an .mp4 destination and 1..60 seconds')
    if destination.exists():
        raise ValueError('Evidence already exists; use a new attempt filename')
    destination.parent.mkdir(parents=True, exist_ok=True)
    remote = f'/sdcard/android-sanity-{uuid.uuid4().hex}.mp4'
    try:
        adb_command(adb, serial, 'shell', 'screenrecord', '--time-limit', str(seconds), remote, timeout=seconds + 15)
        adb_command(adb, serial, 'pull', remote, str(destination))
        if not media_path(destination.parent, destination.name):
            raise ValueError('Recording is not recognizable MP4')
    finally:
        adb_command(adb, serial, 'shell', 'rm', '-f', remote)
    return {'serial': serial, 'path': str(destination.resolve()), 'captured_at': now(), 'seconds': seconds}


def apk_info(path, aapt):
    path = Path(path).resolve(strict=True)
    result = subprocess.run([aapt, 'dump', 'badging', str(path)], check=True, capture_output=True, text=True, timeout=60).stdout
    package = re.search(r"package: name='([^']+)' versionCode='([^']+)' versionName='([^']*)'", result)
    if not package:
        raise ValueError('Cannot read APK package/version identity')
    with path.open('rb') as source:
        checksum = hashlib.file_digest(source, 'sha256').hexdigest()
    manifest = subprocess.run([aapt, 'dump', 'xmltree', str(path), 'AndroidManifest.xml'], check=True, capture_output=True, text=True, timeout=60).stdout
    schemes = sorted(set(re.findall(r'android:scheme[^=]*="([^"]+)"', manifest)))
    return {'path': str(path), 'sha256': checksum, 'package': package[1], 'build': package[2], 'version': package[3], 'debuggable': 'application-debuggable' in result, 'native_code': re.findall(r"native-code: (.*)", result), 'schemes': schemes, 'identity_verified': False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--adb', default=shutil.which('adb') or str(Path.home() / 'Library/Android/sdk/platform-tools/adb'))
    parser.add_argument('--serial', help='Required when more than one device is online')
    commands = parser.add_subparsers(dest='command', required=True)
    init = commands.add_parser('init', help='Create a planned run; no tests are marked executed')
    targets = init.add_mutually_exclusive_group(required=True)
    targets.add_argument('--mr', help='Optional MR target; cannot be combined with branch or release candidate')
    targets.add_argument('--branch', help='Branch name, including the repository default main/master branch')
    targets.add_argument('--release-candidate', help='Release tag, version or distribution build reference')
    init.add_argument('--out', required=True, help='New run directory')
    init.add_argument('--app-flavor', choices=FLAVORS, help='Select after APK inspection; unresolved flavor prevents a complete report')
    commands.add_parser('preflight', help='Select online device and inspect Android/app readiness')
    apk = commands.add_parser('apk-info', help='Read APK checksum and package metadata; provenance still needs verification')
    apk.add_argument('apk')
    apk.add_argument('--aapt', required=True)
    for name in ['capture', 'record']:
        command = commands.add_parser(name)
        command.add_argument('--out', required=True)
        if name == 'record':
            command.add_argument('--seconds', type=int, default=30)
    report = commands.add_parser('report', help='Generate report.md; exit 2 for FAIL or INCOMPLETE')
    report.add_argument('run', help='Path to run.json')
    args = parser.parse_args()
    try:
        if args.command == 'init':
            root = Path(args.out)
            root.mkdir(parents=True, exist_ok=True)
            run = create_run(args.mr, args.app_flavor, branch=args.branch, release_candidate=args.release_candidate)
            with (root / 'run.json').open('x') as output:
                json.dump(run, output, indent=2, ensure_ascii=False)
            result = {'run': str((root / 'run.json').resolve()), 'planned_cases': len(run['cases'])}
        elif args.command == 'report':
            path = Path(args.run).resolve(strict=True)
            run = json.loads(path.read_text())
            result = assess_run(run, path.parent)
            (path.parent / 'report.md').write_text(render_report(run, path.parent))
            print(json.dumps(result, indent=2))
            return 0 if result['verdict'] == 'PASS' else 2
        elif args.command == 'apk-info':
            result = apk_info(args.apk, args.aapt)
        else:
            serial = resolve_device(args.adb, args.serial)
            if args.command == 'preflight':
                props = {key: adb_command(args.adb, serial, 'shell', 'getprop', value).stdout.decode().strip() for key, value in {'model': 'ro.product.model', 'android': 'ro.build.version.release', 'api': 'ro.build.version.sdk', 'abi': 'ro.product.cpu.abi', 'boot_completed': 'sys.boot_completed'}.items()}
                packages = adb_command(args.adb, serial, 'shell', 'pm', 'list', 'packages', 'agoda').stdout.decode().splitlines()
                result = {'serial': serial, 'checked_at': now(), **props, 'agoda_packages': packages}
            elif args.command == 'capture':
                result = capture(args.adb, serial, args.out)
            else:
                result = record(args.adb, serial, args.out, args.seconds)
        print(json.dumps(result, indent=2))
        return 0
    except (ValueError, OSError, subprocess.SubprocessError, KeyError, TypeError) as error:
        print(f'BLOCKED: {error}', file=sys.stderr)
        return 2


if __name__ == '__main__':
    sys.exit(main())
