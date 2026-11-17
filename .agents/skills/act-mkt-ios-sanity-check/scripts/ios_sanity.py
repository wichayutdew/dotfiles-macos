#!/usr/bin/env python3
"""iOS Simulator/device helpers and evidence-checked reporting; assertions belong to the agent."""
import argparse
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import os
import plistlib
import signal
import tempfile
import subprocess
import sys
from urllib.parse import quote, urlparse

SKILL = Path(__file__).resolve().parents[1]
STATUSES = {'PASS', 'FAIL', 'BLOCKED', 'SKIPPED', 'NOT_RUN'}
CHANNEL_SCHEMES = {'production-rc': 'agoda', 'beta': 'agoda4'}


def now():
    return datetime.now(timezone.utc).isoformat()


def resolved_link(url, app_channel):
    return CHANNEL_SCHEMES[app_channel] + url[5:] if url.startswith('agoda://') else url


def channel_diagnostic(case, app_channel):
    source = case.get('runbook_url', '')
    if app_channel not in CHANNEL_SCHEMES or case.get('suite') != 'links' or not isinstance(source, str) or not source.startswith('agoda://'):
        return False
    other = 'production-rc' if app_channel == 'beta' else 'beta'
    return case.get('url') == resolved_link(source, other)


def create_run(mr_url, app_channel='production-rc'):
    if app_channel not in CHANNEL_SCHEMES:
        raise ValueError('Select app channel production-rc or beta')
    parsed = urlparse(mr_url)
    if parsed.scheme != 'https' or parsed.hostname != 'gitlab.agodadev.io' or not re.fullmatch(r'/.+/-/merge_requests/[0-9]+', parsed.path) or parsed.query or parsed.fragment or parsed.username or parsed.password:
        raise ValueError('Expected an HTTPS Agoda GitLab merge-request URL without query or credentials')
    definitions = json.loads((SKILL / 'references/smoke-cases.json').read_text())
    cases = []
    for locale in ['en', 'th']:
        for launch in ['cold', 'warm']:
            for link in definitions['links']:
                cases.append({'id': f'{link["id"]}-{locale}-{launch}', 'suite': 'links', 'locale': locale, 'launch_state': launch, 'runbook_url': link['url'], 'url': resolved_link(link['url'], app_channel), 'expected': [link['destination'], 'No crash, blank screen or unexpected browser fallback'], 'assertion_source': 'proposed; reconcile with requirements'})
        cases.append({'id': f'FUNNEL-{locale}', 'suite': 'funnel', 'locale': locale, 'expected': ['App Home > Activities tile > Activities Home > search > detail > offer/date > booking form', 'Activity, offer, date and traveler selection remain consistent; stop before submission']})
    for variant in ['A', 'B']:
        cases.append({'id': f'FEATURE-{variant}', 'suite': 'feature', 'locale': 'en', 'expected': []})
    for case in cases:
        case.update({'attempt': 1, 'requirements': [], 'steps': [], 'actual': '', 'status': 'NOT_RUN', 'experiments': {}, 'variant_verified': False, 'evidence': [], 'blocker': ''})
    return {'schema_version': 2, 'started_at': now(), 'context': {'platform': 'ios', 'app_channel': app_channel, 'mr_url': mr_url, 'mr_sha': '', 'mr_type': '', 'environment': '', 'device': {}, 'app': {}, 'web': {}, 'runbook': definitions['source'], 'runbook_snapshot': definitions['source_snapshot']}, 'scope': {'experiments': None, 'requirements': [], 'required_combinations': [], 'exclusions': []}, 'required_case_ids': [c['id'] for c in cases], 'settings': {'before': '', 'restoration': 'pending', 'evidence': []}, 'cases': cases}


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
        return path
    return None


def assess_run(run, root):
    issues = []
    if run.get('schema_version') != 2:
        raise ValueError('Unsupported run schema_version')
    cases = run.get('cases')
    if not isinstance(cases, list) or not cases:
        raise ValueError('Run needs a nonempty cases list')
    context = run.get('context', {})
    app_channel = context.get('app_channel')
    if app_channel not in CHANNEL_SCHEMES:
        issues.append('App channel is unresolved; select production-rc or beta')
    selected_cases = [c for c in cases if not channel_diagnostic(c, app_channel)]
    if not re.fullmatch(r'(?:[a-f0-9]{40}|[a-f0-9]{64})', context.get('mr_sha', '')):
        issues.append('MR revision identity is unverified')
    app = context.get('app', {})
    if app_channel in CHANNEL_SCHEMES and CHANNEL_SCHEMES[app_channel] not in app.get('url_schemes', []):
        issues.append('Selected app channel scheme is not registered by the verified installed bundle')
    if app.get('identity_verified') is not True:
        issues.append('iOS app build identity is unverified')
    if not all(app.get(key) for key in ['bundle_id', 'version', 'build', 'source']) or not re.fullmatch(r'[a-f0-9]{64}', app.get('sha256', '')) or not any(local_file(root, name) for name in app.get('verification_evidence', [])):
        issues.append('iOS app identity details or verification evidence are missing')
    if not re.fullmatch(r'[a-f0-9]{64}', app.get('bundle_sha256', '')) or app.get('installed_bundle_sha256') != app.get('bundle_sha256'):
        issues.append('Installed app bundle does not match the downloaded bundle fingerprint')
    device = context.get('device', {})
    if context.get('platform') != 'ios' or device.get('target') not in {'simulator', 'device'}:
        issues.append('iOS platform or target is unresolved')
    expected_platform = 'iPhoneSimulator' if device.get('target') == 'simulator' else 'iPhoneOS'
    if app.get('supported_platforms') != [expected_platform]:
        issues.append('App platform does not match simulator/device target')
    revisions = {sha for sha in [context.get('mr_sha'), context.get('merged_sha')] if isinstance(sha, str) and re.fullmatch(r'(?:[a-f0-9]{40}|[a-f0-9]{64})', sha)}
    if context.get('mr_type') == 'native' and app.get('built_sha') not in revisions:
        issues.append('Native app built revision does not match the MR source or verified merged result')
    if not local_file(root, run.get('settings', {}).get('before')):
        issues.append('Before-state settings evidence is missing')
    if context.get('mr_type') not in {'native', 'cxp'}:
        issues.append('MR type is unresolved')
    if context.get('mr_type') == 'cxp' and context.get('web', {}).get('identity_verified') is not True:
        issues.append('Served web revision identity is unverified')
    web = context.get('web', {})
    if context.get('mr_type') == 'cxp' and (not web.get('branch') or web.get('sha') != context.get('mr_sha') or not any(local_file(root, name) for name in web.get('verification_evidence', []))):
        issues.append('Web branch/revision details or verification evidence are missing')
    if not all(isinstance(device.get(key), str) and device[key].strip() for key in ['model', 'os_version']):
        issues.append('Device model or iOS version is missing')
    if not context.get('device', {}).get('udid') or not context.get('environment'):
        issues.append('Device or environment identity is missing')
    scope = run.get('scope', {})
    experiments = scope.get('experiments')
    if not isinstance(experiments, list):
        issues.append('Experiment scope is unresolved')
        experiments = []
    elif not experiments and not scope.get('no_experiment_reason'):
        issues.append('No-experiment scope needs a reason')
    if not scope.get('requirements'):
        issues.append('MR acceptance requirements have not been defined')
    if experiments and not any(local_file(root, name) for name in context.get('variant_evidence', [])):
        issues.append('Effective experiment variant evidence is missing')
    settings = run.get('settings', {})
    if settings.get('restoration') not in {'restored', 'not_changed'}:
        issues.append('Settings cleanup is unfinished')
    elif not any(local_file(root, name) for name in settings.get('evidence', [])):
        issues.append('Settings cleanup evidence is missing')
    required = run.get('required_case_ids', [])
    if not required:
        issues.append('Required coverage is undefined')
    missing = set(required) - {c.get('id') for c in selected_cases}
    if missing:
        issues.append('Missing required case: ' + ', '.join(sorted(missing)))
    baseline = create_run(context.get('mr_url', ''), app_channel if app_channel in CHANNEL_SCHEMES else 'production-rc')['cases']
    for original in baseline:
        if original['suite'] == 'feature':
            continue
        attempts = [case for case in cases if case.get('id') == original['id']]
        if not attempts or original['id'] not in required:
            issues.append('Missing canonical smoke case: ' + original['id'])
        elif any(any(case.get(field) != original.get(field) for field in ['suite', 'locale', 'launch_state', 'runbook_url']) or (case.get('url') != original.get('url') and not channel_diagnostic(case, app_channel)) for case in attempts):
            issues.append('Canonical smoke case changed: ' + original['id'])
    seen = set()
    for case in cases:
        key = (case.get('id'), case.get('attempt', 1))
        label = f'{key[0]} attempt {key[1]}'
        if key in seen:
            issues.append(f'{label}: duplicate attempt; append reruns with a new attempt number')
        seen.add(key)
        status = case.get('status')
        if status not in STATUSES:
            raise ValueError(f'{label}: invalid status {status!r}')
        if status in {'PASS', 'FAIL'}:
            if not case.get('steps') or not case.get('expected') or not case.get('actual'):
                issues.append(f'{label}: missing steps, expected or actual result')
            if experiments and (case.get('suite') == 'feature' or case.get('experiments')) and (case.get('variant_verified') is not True or any(case.get('experiments', {}).get(exp) not in {'A', 'B'} for exp in experiments)):
                issues.append(f'{label}: effective experiment variant is unverified')
        if status == 'PASS' and case.get('suite') == 'links' and case.get('url', '').startswith('https:') and case.get('entry_method') != 'external_tap':
            issues.append(f'{label}: universal link needs an external tap; direct opens are diagnostic only')
        if status == 'FAIL' and not any(media_path(root, name) for name in case.get('evidence', [])):
            issues.append(f'{label}: failure media is missing or invalid')
        if status in {'BLOCKED', 'SKIPPED'} and not case.get('blocker'):
            issues.append(f'{label}: missing blocker/skip reason')
        for name in case.get('evidence', []):
            if not local_file(root, name):
                issues.append(f'{label}: missing or unsafe attachment {name!r}')
    executed_features = [c for c in cases if c.get('suite') == 'feature' and c.get('status') in {'PASS', 'FAIL'}]
    if not any(c.get('suite') == 'feature' for c in cases):
        issues.append('MR feature coverage is missing')
    for exp in experiments:
        if not {'A', 'B'}.issubset({c.get('experiments', {}).get(exp) for c in executed_features if c.get('variant_verified') is True}):
            issues.append(f'{exp}: feature A/B coverage is incomplete')
    for combination in scope.get('required_combinations', []):
        if not any(c.get('variant_verified') is True and all(c.get('experiments', {}).get(k) == v for k, v in combination.items()) for c in executed_features):
            issues.append('Missing experiment combination: ' + json.dumps(combination, sort_keys=True))
    covered_requirements = {r for c in executed_features for r in c.get('requirements', [])}
    for requirement in scope.get('requirements', []):
        if requirement not in covered_requirements:
            issues.append('Uncovered MR requirement: ' + requirement)
    counts = dict(Counter(c['status'] for c in selected_cases))
    diagnostic_counts = dict(Counter(c['status'] for c in cases if channel_diagnostic(c, app_channel)))
    verdict = 'FAIL' if counts.get('FAIL') else 'INCOMPLETE' if issues or any(c['status'] != 'PASS' for c in selected_cases) else 'PASS'
    return {'verdict': verdict, 'evidence_complete': not issues, 'counts': counts, 'diagnostic_counts': diagnostic_counts, 'issues': issues}


def inline(value):
    return str(value).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('|', '&#124;').replace('\n', '<br>')


def render_report(run, root):
    result = assess_run(run, root)
    context = run['context']
    lines = ['# Activities iOS sanity report', '', f'**Result: {result["verdict"]}** · Evidence checks: {"complete" if result["evidence_complete"] else "incomplete"}', '', f'Generated: {now()}', f'Started: {run["started_at"]}', f'MR: {context["mr_url"]}', f'App channel: {inline(context.get("app_channel", "unresolved"))}', '', '## Run identity', '', '```json', json.dumps(context, indent=2, ensure_ascii=False), '```', '', '## Scope and restoration', '', '```json', json.dumps({'scope': run['scope'], 'settings': run['settings']}, indent=2, ensure_ascii=False), '```', '', '## Results for selected channel', '', ' | '.join(f'{status}: {result["counts"].get(status, 0)}' for status in ['PASS', 'FAIL', 'BLOCKED', 'SKIPPED', 'NOT_RUN']), '', 'Wrong-channel diagnostics retained: ' + json.dumps(result['diagnostic_counts'], sort_keys=True), '', '| Test / attempt | Suite | Scope | Locale / launch | Experiments | Result |', '|---|---|---|---|---|---|']
    for case in run['cases']:
        variants = ', '.join(f'{k}={v}' for k, v in case['experiments'].items()) or 'none recorded'
        channel_scope = 'Wrong-channel diagnostic' if channel_diagnostic(case, context.get('app_channel')) else context.get('app_channel', 'unresolved')
        lines.append(f'| {inline(case["id"])} / {case.get("attempt", 1)} | {inline(case["suite"])} | {inline(channel_scope)} | {inline(case["locale"])} / {inline(case.get("launch_state", "journey"))} | {inline(variants)} | {case["status"]} |')
    lines += ['', '## Completeness checks', '']
    lines += ['- ' + inline(issue) for issue in result['issues']] or ['All required checks satisfied.']
    lines += ['', '## Test details and evidence', '']
    for case in run['cases']:
        lines += [f'### {inline(case["id"])} — attempt {case.get("attempt", 1)} — {case["status"]}', '', f'Expected: {inline("; ".join(case["expected"]))}', f'Actual: {inline(case["actual"]) or "Not executed"}', f'Requirements: {inline(", ".join(case.get("requirements", [])))}', '']
        if case.get('url'):
            lines += [f'Tested URL: `{case["url"]}`', '']
        if case.get('runbook_url'):
            lines += [f'Runbook source URL: `{case["runbook_url"]}`', '']
        if channel_diagnostic(case, context.get('app_channel')):
            lines += ['Wrong-channel diagnostic; retained as history and excluded from selected-channel coverage.', '']
        lines += [f'{index}. {inline(step)}' for index, step in enumerate(case['steps'], 1)]
        if case.get('blocker'):
            lines += ['', 'Blocker / skip reason: ' + inline(case['blocker'])]
        for name in case['evidence']:
            path = local_file(root, name)
            if path:
                label = inline(Path(name).name)
                target = quote(name, safe='/')
                lines += ['', f'![{label}]({target})' if media_path(root, name) and path.suffix.lower() in {'.png', '.jpg', '.jpeg'} else f'[{label}]({target})']
        lines.append('')
    return '\n'.join(lines)


def select_simulator(payload, udid=None):
    available = [dict(device, runtime=runtime) for runtime, devices in payload.get('devices', {}).items() if '.iOS-' in runtime for device in devices if device.get('isAvailable') is True]
    matches = [device for device in available if device.get('udid') == udid] if udid else [device for device in available if device.get('state') == 'Booted']
    if len(matches) != 1:
        raise ValueError('Select exactly one available iOS Simulator with --udid UDID')
    if matches[0].get('state') != 'Booted':
        raise ValueError('Selected simulator is not booted; boot the explicit UDID first')
    return matches[0]


def select_phone(payload, udid=None, *, check_cached_mode=True):
    phones = [d for d in payload.get('result', {}).get('devices', []) if d.get('hardwareProperties', {}).get('platform') == 'iOS' and d.get('connectionProperties', {}).get('pairingState') == 'paired']
    matches = [d for d in phones if udid in {d.get('identifier'), d.get('hardwareProperties', {}).get('udid')}] if udid else phones
    if len(matches) != 1:
        raise ValueError('Select exactly one paired iPhone with --udid UDID')
    if not matches[0].get('connectionProperties', {}).get('transportType'):
        raise ValueError('Selected iPhone is unavailable/reconnecting; unlock and reconnect it before checking Developer Mode')
    if check_cached_mode and matches[0].get('deviceProperties', {}).get('developerModeStatus') != 'enabled':
        raise ValueError('Developer Mode must be enabled and confirmed after restart on the selected iPhone')
    return matches[0]


def bundle_target(info):
    platforms = info.get('CFBundleSupportedPlatforms')
    if platforms == ['iPhoneSimulator']:
        return 'simulator'
    if platforms == ['iPhoneOS']:
        return 'device'
    raise ValueError('Bundle must explicitly target iPhoneSimulator or iPhoneOS')


def developer_environment(directory=None):
    env = os.environ.copy()
    selected = directory or env.get('DEVELOPER_DIR')
    if not selected:
        selected = subprocess.run(['xcode-select', '-p'], check=True, capture_output=True, text=True, timeout=10).stdout.strip()
        if not (Path(selected) / 'usr/bin/simctl').exists():
            choices = sorted(Path('/Applications').glob('*Xcode*.app/Contents/Developer'))
            if len(choices) != 1:
                raise ValueError('Set --developer-dir to the intended full Xcode Contents/Developer path')
            selected = str(choices[0])
    if not (Path(selected) / 'usr/bin/simctl').is_file():
        raise ValueError('Full Xcode with simctl is required; CommandLineTools is insufficient')
    env['DEVELOPER_DIR'] = selected
    return env


def xcrun(env, *arguments, timeout=30):
    return subprocess.run(['xcrun', *arguments], env=env, check=True, capture_output=True, timeout=timeout)


def coredevice(env, *arguments):
    # devicectl documents JSON files as its only supported machine-readable interface.
    with tempfile.TemporaryDirectory(prefix='ios-sanity-') as directory:
        output = Path(directory) / 'result.json'
        xcrun(env, 'devicectl', *arguments, '--json-output', str(output), '--timeout', '25', timeout=30)
        return json.loads(output.read_text())


def preflight(env, target, udid):
    if target == 'simulator':
        device = select_simulator(json.loads(xcrun(env, 'simctl', 'list', 'devices', 'available', '--json').stdout), udid)
        raw_apps = xcrun(env, 'simctl', 'listapps', device['udid']).stdout
        apps = json.loads(subprocess.run(['plutil', '-convert', 'json', '-o', '-', '-'], input=raw_apps, check=True, capture_output=True, timeout=10).stdout)
        installed = [{'bundle_id': key, 'build': value.get('CFBundleVersion'), 'path': value.get('Path')} for key, value in apps.items() if 'agoda' in key.lower()]
        return {'target': target, 'udid': device['udid'], 'model': device.get('name'), 'os_version': device['runtime'].rsplit('.iOS-', 1)[-1].replace('-', '.'), 'state': device['state'], 'agoda_apps': installed, 'checked_at': now()}
    device = select_phone(coredevice(env, 'list', 'devices'), udid, check_cached_mode=False)
    properties = device['deviceProperties']
    # The live query enforces Developer Mode and refreshes stale post-restart list data.
    apps = coredevice(env, 'device', 'info', 'apps', '--device', device['identifier'], '--filter', 'bundleIdentifier CONTAINS[c] "agoda"')
    installed = [{'bundle_id': a.get('bundleIdentifier'), 'version': a.get('version'), 'build': a.get('bundleVersion')} for a in apps.get('result', {}).get('apps', [])]
    return {'target': target, 'udid': device['identifier'], 'model': device.get('hardwareProperties', {}).get('marketingName'), 'os_version': properties.get('osVersionNumber'), 'developer_mode': 'enabled', 'developer_mode_verification': 'live app query', 'agoda_apps': installed, 'checked_at': now()}


def file_sha256(source):
    digest = hashlib.sha256()
    for chunk in iter(lambda: source.read(1024 * 1024), b''):
        digest.update(chunk)
    return digest


def bundle_fingerprint(path):
    root = Path(path).resolve(strict=True)
    digest = hashlib.sha256()
    for entry in sorted(root.rglob('*')):
        name = entry.relative_to(root).as_posix().encode()
        if entry.is_symlink():
            if not entry.resolve().is_relative_to(root):
                raise ValueError('Bundle symlink escapes .app')
            digest.update(b'L\0' + name + b'\0' + os.readlink(entry).encode())
        elif entry.is_file():
            with entry.open('rb') as source:
                digest.update(b'F\0' + name + b'\0' + file_sha256(source).digest())
    return digest.hexdigest()


def bundle_info(path, env):
    bundle = Path(path).resolve(strict=True)
    if bundle.suffix != '.app' or not bundle.is_dir():
        raise ValueError('Pass an extracted .app bundle; a device .ipa is not a simulator package')
    with (bundle / 'Info.plist').open('rb') as source:
        info = plistlib.load(source)
    target = bundle_target(info)
    executable_name = info.get('CFBundleExecutable')
    if not isinstance(executable_name, str) or Path(executable_name).name != executable_name:
        raise ValueError('Invalid bundle executable name')
    executable = (bundle / executable_name).resolve(strict=True)
    if not executable.is_relative_to(bundle):
        raise ValueError('Bundle executable escapes .app')
    with executable.open('rb') as source:
        checksum = file_sha256(source).hexdigest()
    build = xcrun(env, 'vtool', '-show-build', str(executable)).stdout.decode()
    declared = set(re.findall(r'platform\s+(\w+)', build))
    expected = 'IOSSIMULATOR' if target == 'simulator' else 'IOS'
    if not declared or declared != {expected}:
        raise ValueError('Mach-O build platform does not match Info.plist; do not install this bundle')
    schemes = sorted({scheme for entry in info.get('CFBundleURLTypes', []) for scheme in entry.get('CFBundleURLSchemes', []) if 'agoda' in scheme.lower()})
    return {'path': str(bundle), 'bundle_id': info.get('CFBundleIdentifier'), 'version': info.get('CFBundleShortVersionString'), 'build': info.get('CFBundleVersion'), 'minimum_os': info.get('MinimumOSVersion'), 'supported_platforms': info['CFBundleSupportedPlatforms'], 'url_schemes': schemes, 'target': target, 'executable_sha256': checksum, 'bundle_sha256': bundle_fingerprint(bundle), 'mach_o_platforms': sorted(declared), 'identity_verified': False}


def screenshot(env, udid, output):
    path = Path(output)
    if path.suffix.lower() != '.png' or path.exists():
        raise ValueError('Use a new .png evidence filename')
    path.parent.mkdir(parents=True, exist_ok=True)
    xcrun(env, 'simctl', 'io', udid, 'screenshot', '--type=png', str(path))
    if not media_path(path.parent, path.name):
        raise ValueError('Screenshot is not recognizable PNG')
    return {'udid': udid, 'path': str(path.resolve()), 'captured_at': now()}


def recording(env, udid, output, seconds):
    path = Path(output)
    if path.suffix.lower() not in {'.mp4', '.mov'} or path.exists() or not 1 <= seconds <= 60:
        raise ValueError('Use a new .mp4/.mov filename and 1..60 seconds')
    path.parent.mkdir(parents=True, exist_ok=True)
    process = subprocess.Popen(['xcrun', 'simctl', 'io', udid, 'recordVideo', '--codec=h264', str(path)], env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    try:
        try:
            process.wait(timeout=seconds)
        except subprocess.TimeoutExpired:
            process.send_signal(signal.SIGINT)
        stdout, stderr = process.communicate(timeout=20)
        if process.returncode != 0 or not media_path(path.parent, path.name):
            raise ValueError('Recording did not finalize as usable media: ' + stderr.decode(errors='replace')[-500:])
    finally:
        if process.poll() is None:
            process.kill()
            process.communicate(timeout=10)
    return {'udid': udid, 'path': str(path.resolve()), 'captured_at': now(), 'requested_seconds': seconds}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--developer-dir')
    parser.add_argument('--target', choices=['simulator', 'device'], default='simulator')
    parser.add_argument('--udid')
    commands = parser.add_subparsers(dest='command', required=True)
    init = commands.add_parser('init')
    init.add_argument('--mr', required=True)
    init.add_argument('--app-channel', choices=CHANNEL_SCHEMES, required=True)
    init.add_argument('--out', required=True)
    commands.add_parser('preflight')
    bundle = commands.add_parser('bundle-info')
    bundle.add_argument('app')
    for name in ['capture', 'record']:
        command = commands.add_parser(name)
        command.add_argument('--out', required=True)
        if name == 'record':
            command.add_argument('--seconds', type=int, default=15)
    report = commands.add_parser('report')
    report.add_argument('run')
    args = parser.parse_args()
    try:
        if args.command == 'init':
            run = create_run(args.mr, args.app_channel)
            root = Path(args.out)
            root.mkdir(parents=True, exist_ok=True)
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
        else:
            env = developer_environment(args.developer_dir)
            if args.command == 'bundle-info':
                result = bundle_info(args.app, env)
            else:
                device = preflight(env, args.target, args.udid)
                if args.command == 'preflight':
                    result = device
                elif args.target != 'simulator':
                    raise ValueError('This Xcode supports simulator capture only. Capture the selected iPhone through Xcode Devices, QuickTime or a verified device UI driver and attach its media; never substitute simulator media.')
                elif args.command == 'capture':
                    result = screenshot(env, device['udid'], args.out)
                else:
                    result = recording(env, device['udid'], args.out, args.seconds)
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return 0
    except (ValueError, OSError, subprocess.SubprocessError, KeyError, TypeError, plistlib.InvalidFileException) as error:
        detail = error.stderr.decode(errors='replace')[-800:] if isinstance(error, subprocess.CalledProcessError) and isinstance(error.stderr, bytes) else str(error)
        print('BLOCKED: ' + detail, file=sys.stderr)
        return 2


if __name__ == '__main__':
    sys.exit(main())
