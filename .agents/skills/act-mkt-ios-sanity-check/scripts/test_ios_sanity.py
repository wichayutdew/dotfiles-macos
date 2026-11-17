import base64
import copy
import json
from pathlib import Path
import plistlib
import signal
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import Mock, patch

import ios_sanity as sanity

MR = 'https://gitlab.agodadev.io/full-stack/mobile/ios/client-ios/-/merge_requests/43169'
PNG = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j7X8AAAAASUVORK5CYII=')


class IOSSanityTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        for name in ['app-proof.txt', 'cleanup.txt', 'before.txt', 'variant.txt']:
            (self.root / name).write_text('Test fixture evidence')
        self.run = sanity.create_run(MR)
        self.run['context']['app_channel'] = 'production-rc'
        self.run['context'].update({'platform': 'ios', 'mr_sha': 'a' * 40, 'mr_type': 'native', 'environment': 'prelive', 'device': {'udid': 'SIM-1', 'target': 'simulator', 'model': 'iPhone 16 Pro', 'os_version': '26.5'}, 'app': {'bundle_id': 'com.example.test', 'version': '1.0', 'build': '42', 'source': 'https://gitlab.agodadev.io/project/-/jobs/123', 'sha256': 'b' * 64, 'built_sha': 'a' * 40, 'supported_platforms': ['iPhoneSimulator'], 'identity_verified': True, 'verification_evidence': ['app-proof.txt']}, 'variant_evidence': ['variant.txt']})
        self.run['scope'].update({'experiments': ['ACTB-2852-IOS'], 'requirements': ['AC-1']})
        self.run['context']['app'].update({'bundle_sha256': 'c' * 64, 'installed_bundle_sha256': 'c' * 64})
        self.run['context']['app']['url_schemes'] = ['agoda']
        self.run['settings'].update({'before': 'before.txt', 'restoration': 'restored', 'evidence': ['cleanup.txt']})
        for case in self.run['cases']:
            if case['suite'] == 'links':
                case['runbook_url'] = case['url']
            case.update({'status': 'PASS', 'steps': ['Observed relevant screen'], 'expected': ['Expected screen'], 'actual': 'Expected content visible', 'experiments': {'ACTB-2852-IOS': 'A'}, 'variant_verified': True, 'requirements': ['AC-1']})
            if case.get('url', '').startswith('https:'):
                case['entry_method'] = 'external_tap'
        self.run['cases'][-1]['experiments'] = {'ACTB-2852-IOS': 'B'}

    def test_report_requires_nonempty_device_model_and_os_version(self):
        for field in ['model', 'os_version']:
            for value in [None, '', ' \t\n']:
                with self.subTest(field=field, value=value):
                    run = copy.deepcopy(self.run)
                    if value is None:
                        run['context']['device'].pop(field)
                    else:
                        run['context']['device'][field] = value
                    result = sanity.assess_run(run, self.root)
                    self.assertEqual('INCOMPLETE', result['verdict'])
                    self.assertFalse(result['evidence_complete'])

    def test_report_cli_rejects_missing_device_details(self):
        self.run['context']['device'].pop('model')
        self.run['context']['device'].pop('os_version')
        manifest = self.root / 'run.json'
        manifest.write_text(json.dumps(self.run))
        result = subprocess.run([sys.executable, str(Path(sanity.__file__)), 'report', str(manifest)],
                                capture_output=True, text=True, timeout=10)
        self.assertEqual(2, result.returncode, result.stderr)
        assessment = json.loads(result.stdout)
        self.assertEqual('INCOMPLETE', assessment['verdict'])
        self.assertFalse(assessment['evidence_complete'])
        self.assertIn('INCOMPLETE', (self.root / 'report.md').read_text())

    def test_init_requires_explicit_app_channel(self):
        out = self.root / 'ambiguous'
        result = subprocess.run([sys.executable, str(Path(sanity.__file__)), 'init', '--mr', MR, '--out', str(out)], capture_output=True, text=True, timeout=10)
        self.assertNotEqual(0, result.returncode)
        self.assertFalse((out / 'run.json').exists())

    def test_init_selects_scheme_and_preserves_runbook_url_and_query(self):
        for channel, home in [('production-rc', 'agoda://activities'), ('beta', 'agoda4://activities')]:
            with self.subTest(channel=channel):
                out = self.root / channel
                result = subprocess.run([sys.executable, str(Path(sanity.__file__)), 'init', '--mr', MR, '--app-channel', channel, '--out', str(out)], capture_output=True, text=True, timeout=10)
                self.assertEqual(0, result.returncode, result.stderr)
                run = json.loads((out / 'run.json').read_text())
                self.assertEqual(channel, run['context']['app_channel'])
                cases = {c['id']: c for c in run['cases']}
                self.assertEqual(home, cases['HOME-DL-en-cold']['url'])
                self.assertEqual('agoda://activities', cases['HOME-DL-en-cold']['runbook_url'])
                self.assertEqual('https://www.agoda.com/activities', cases['HOME-UL-en-cold']['url'])
                if channel == 'beta':
                    self.assertEqual('agoda4://activities/search?cid=1909881&cityId=4064&selectedActivity=1044592&currency=THB&googleSrc=bm&gl=en-TH&gs=search&gf=nav&gacs&device=m&pslc=1', cases['SEARCH-DL-th-warm']['url'])

    def test_report_requires_channel_and_matching_installed_scheme(self):
        self.run['context'].pop('app_channel')
        self.assertEqual('INCOMPLETE', sanity.assess_run(self.run, self.root)['verdict'])
        self.run['context']['app_channel'] = 'production-rc'
        self.run['context']['app']['url_schemes'] = ['agoda4']
        self.assertEqual('INCOMPLETE', sanity.assess_run(self.run, self.root)['verdict'])

    def test_wrong_channel_failure_is_retained_as_diagnostic_history(self):
        self.run['context']['app_channel'] = 'beta'
        self.run['context']['app']['url_schemes'] = ['agoda4']
        for case in self.run['cases']:
            if case.get('url', '').startswith('agoda://'):
                case['url'] = 'agoda4' + case['url'][5:]
        selected = next(c for c in self.run['cases'] if c['id'] == 'HOME-DL-en-cold')
        historical = copy.deepcopy(selected)
        historical.update({'url': 'agoda://activities', 'status': 'FAIL', 'actual': 'Production scheme has no handler in the beta app', 'evidence': ['wrong-channel.png']})
        (self.root / 'wrong-channel.png').write_bytes(PNG)
        selected['attempt'] = 2
        self.run['cases'].append(historical)
        result = sanity.assess_run(self.run, self.root)
        self.assertEqual('PASS', result['verdict'], result['issues'])
        self.assertEqual(1, result.get('diagnostic_counts', {}).get('FAIL'))
        report = sanity.render_report(self.run, self.root)
        self.assertIn('Wrong-channel diagnostic', report)
        self.assertIn('agoda://activities', report)
        self.assertIn('wrong-channel.png', report)

    def test_wrong_channel_attempt_cannot_cover_selected_channel_case(self):
        self.run['context']['app_channel'] = 'beta'
        self.run['context']['app']['url_schemes'] = ['agoda4']
        for case in self.run['cases']:
            if case.get('url', '').startswith('agoda://'):
                case['url'] = 'agoda4' + case['url'][5:]
        case = next(c for c in self.run['cases'] if c['id'] == 'HOME-DL-en-cold')
        case['url'] = 'agoda://activities'
        result = sanity.assess_run(self.run, self.root)
        self.assertEqual('INCOMPLETE', result['verdict'])
        self.assertTrue(any('Missing required case' in issue and 'HOME-DL-en-cold' in issue for issue in result['issues']))

    def test_baseline_is_exact_32_link_cases_and_two_locales(self):
        run = sanity.create_run(MR)
        cases = [c for c in run['cases'] if c['suite'] == 'links']
        self.assertEqual(32, len(cases))
        self.assertEqual({('en', 'cold'), ('en', 'warm'), ('th', 'cold'), ('th', 'warm')}, {(c['locale'], c['launch_state']) for c in cases})
        self.assertTrue(all(c['status'] == 'NOT_RUN' for c in run['cases']))
        self.assertTrue(any(c['url'] == 'agoda://activities' for c in cases))
        self.assertEqual('ios', run['context']['platform'])

    def test_simulator_selection_rejects_ambiguity_shutdown_and_non_ios(self):
        payload = {'devices': {'com.apple.CoreSimulator.SimRuntime.iOS-26-5': [{'udid': 'SIM-1', 'state': 'Booted', 'isAvailable': True}, {'udid': 'SIM-2', 'state': 'Booted', 'isAvailable': True}], 'watchOS-26': [{'udid': 'WATCH', 'state': 'Booted', 'isAvailable': True}]}}
        with self.assertRaisesRegex(ValueError, 'UDID'):
            sanity.select_simulator(payload)
        self.assertEqual('SIM-1', sanity.select_simulator(payload, 'SIM-1')['udid'])
        payload['devices']['com.apple.CoreSimulator.SimRuntime.iOS-26-5'][0]['state'] = 'Shutdown'
        with self.assertRaises(ValueError):
            sanity.select_simulator(payload, 'SIM-1')
        with self.assertRaises(ValueError):
            sanity.select_simulator(payload, 'WATCH')

    def test_canonical_smoke_cases_cannot_be_silently_removed_or_rewritten(self):
        case = self.run['cases'].pop(0)
        self.run['required_case_ids'].remove(case['id'])
        self.assertEqual('INCOMPLETE', sanity.assess_run(self.run, self.root)['verdict'])
        self.run['cases'].append(case)
        self.run['required_case_ids'].append(case['id'])
        case['url'] = 'https://www.agoda.com/activities?replacement=true'
        self.assertEqual('INCOMPLETE', sanity.assess_run(self.run, self.root)['verdict'])

    def test_phone_developer_mode_is_a_real_prerequisite(self):
        phone = {'identifier': 'PHONE', 'hardwareProperties': {'platform': 'iOS', 'udid': 'HW-UDID'}, 'connectionProperties': {'pairingState': 'paired', 'transportType': 'wired'}, 'deviceProperties': {'developerModeStatus': 'disabled'}}
        payload = {'result': {'devices': [phone]}}
        with self.assertRaisesRegex(ValueError, 'Developer Mode'):
            sanity.select_phone(payload, 'PHONE')
        phone['deviceProperties']['developerModeStatus'] = 'enabled'
        self.assertEqual('PHONE', sanity.select_phone(payload, 'HW-UDID')['identifier'])

    def test_reconnecting_phone_does_not_report_cached_developer_mode_as_live(self):
        phone = {'identifier': 'PHONE', 'hardwareProperties': {'platform': 'iOS'}, 'connectionProperties': {'pairingState': 'paired'}, 'deviceProperties': {'developerModeStatus': 'disabled'}}
        with self.assertRaisesRegex(ValueError, 'reconnect'):
            sanity.select_phone({'result': {'devices': [phone]}}, 'PHONE')

    def test_phone_preflight_checks_live_access_when_list_has_cached_mode(self):
        phone = {'identifier': 'PHONE', 'hardwareProperties': {'platform': 'iOS', 'marketingName': 'iPhone'}, 'connectionProperties': {'pairingState': 'paired', 'transportType': 'wired'}, 'deviceProperties': {'developerModeStatus': 'disabled', 'osVersionNumber': '27.2'}}
        with patch.object(sanity, 'coredevice', side_effect=[{'result': {'devices': [phone]}}, {'result': {'apps': []}}]) as sdk:
            result = sanity.preflight({}, 'device', 'PHONE')
        self.assertEqual('enabled', result['developer_mode'])
        self.assertEqual('live app query', result['developer_mode_verification'])
        self.assertEqual(2, sdk.call_count)

    def test_simulator_and_device_arm64_are_not_interchangeable(self):
        self.assertEqual('simulator', sanity.bundle_target({'CFBundleSupportedPlatforms': ['iPhoneSimulator']}))
        self.assertEqual('device', sanity.bundle_target({'CFBundleSupportedPlatforms': ['iPhoneOS']}))
        with self.assertRaises(ValueError):
            sanity.bundle_target({'CFBundleSupportedPlatforms': ['MacOSX']})
        self.run['context']['device']['target'] = 'device'
        self.assertEqual('INCOMPLETE', sanity.assess_run(self.run, self.root)['verdict'])

    def test_bundle_fingerprint_covers_framework_changes_with_unchanged_launcher(self):
        bundle = self.root / 'Test.app'
        framework = bundle / 'Frameworks' / 'Feature.framework'
        framework.mkdir(parents=True)
        (bundle / 'Launcher').write_bytes(b'unchanged launcher')
        (framework / 'Feature').write_bytes(b'control implementation')
        first = sanity.bundle_fingerprint(bundle)
        (framework / 'Feature').write_bytes(b'treatment implementation')
        self.assertNotEqual(first, sanity.bundle_fingerprint(bundle))
        (bundle / 'escape').symlink_to('/etc/hosts')
        with self.assertRaises(ValueError):
            sanity.bundle_fingerprint(bundle)

    def test_unforced_baseline_is_independent_of_feature_variant_verification(self):
        for case in self.run['cases']:
            if case['suite'] != 'feature':
                case.update({'experiments': {}, 'variant_verified': False})
        result = sanity.assess_run(self.run, self.root)
        self.assertEqual('PASS', result['verdict'], result['issues'])

    def test_complete_manifest_passes(self):
        result = sanity.assess_run(self.run, self.root)
        self.assertEqual('PASS', result['verdict'], result['issues'])

    def test_old_or_unproven_build_cannot_pass(self):
        self.run['context']['app']['built_sha'] = 'c' * 40
        self.assertEqual('INCOMPLETE', sanity.assess_run(self.run, self.root)['verdict'])
        self.run['context']['merged_sha'] = 'c' * 40
        self.assertEqual('PASS', sanity.assess_run(self.run, self.root)['verdict'])
        self.run['context']['app']['verification_evidence'] = []
        self.assertEqual('INCOMPLETE', sanity.assess_run(self.run, self.root)['verdict'])

    def test_missing_or_malformed_built_revision_cannot_pass(self):
        for value in [None, '', 'not-a-commit']:
            with self.subTest(built_sha=value):
                self.run['context']['app']['built_sha'] = value
                self.assertEqual('INCOMPLETE', sanity.assess_run(self.run, self.root)['verdict'])
        self.run['context']['app'].pop('built_sha')
        self.assertEqual('INCOMPLETE', sanity.assess_run(self.run, self.root)['verdict'])

    def test_universal_link_payload_or_browser_address_is_diagnostic_only(self):
        case = next(c for c in self.run['cases'] if c.get('url', '').startswith('https:'))
        for method in ['simctl_openurl', 'payload_url', 'safari_address_bar']:
            case['entry_method'] = method
            self.assertEqual('INCOMPLETE', sanity.assess_run(self.run, self.root)['verdict'])

    def test_disabled_override_is_not_automatically_control_A(self):
        self.run['cases'][0]['variant_verified'] = False
        self.assertEqual('INCOMPLETE', sanity.assess_run(self.run, self.root)['verdict'])
        self.run['cases'][0]['variant_verified'] = True
        self.run['context']['variant_evidence'] = []
        self.assertEqual('INCOMPLETE', sanity.assess_run(self.run, self.root)['verdict'])

    def test_failed_case_needs_real_media_and_report_preserves_failure(self):
        failed = self.run['cases'][0]
        failed.update({'status': 'FAIL', 'evidence': ['failure.png'], 'actual': 'Blank Activities screen'})
        result = sanity.assess_run(self.run, self.root)
        self.assertEqual('FAIL', result['verdict'])
        self.assertTrue(any('failure media' in s for s in result['issues']))
        (self.root / 'failure.png').write_bytes(PNG)
        self.assertEqual([], sanity.assess_run(self.run, self.root)['issues'])
        retry = copy.deepcopy(failed)
        retry.update({'attempt': 2, 'status': 'PASS'})
        self.run['cases'].append(retry)
        report = sanity.render_report(self.run, self.root)
        self.assertIn('failure.png', report)
        self.assertIn('attempt 2', report)
        self.assertIn('Blank Activities screen', report)
        self.assertEqual('FAIL', sanity.assess_run(self.run, self.root)['verdict'])

    def test_corrupt_empty_and_escaping_evidence_does_not_count(self):
        (self.root / 'bad.png').write_text('not an image')
        (self.root / 'empty.mp4').touch()
        (self.root / 'outside.png').symlink_to('/etc/hosts')
        for name in ['bad.png', 'empty.mp4', '../outside.png', '/etc/hosts', 'outside.png']:
            self.assertIsNone(sanity.media_path(self.root, name))

    def test_missing_B_cleanup_or_required_case_prevents_pass(self):
        self.run['cases'][-1]['experiments'] = {'ACTB-2852-IOS': 'A'}
        self.run['settings']['restoration'] = 'pending'
        self.run['cases'].pop(0)
        issues = sanity.assess_run(self.run, self.root)['issues']
        self.assertTrue(any('A/B' in s for s in issues))
        self.assertTrue(any('cleanup' in s for s in issues))
        self.assertTrue(any('required case' in s for s in issues))

    def test_blocked_cases_are_reported_without_imaginary_execution(self):
        case = self.run['cases'][0]
        case.update({'status': 'BLOCKED', 'steps': [], 'actual': '', 'blocker': 'Matching simulator artifact unavailable'})
        report = sanity.render_report(self.run, self.root)
        self.assertIn('Matching simulator artifact unavailable', report)
        self.assertEqual('INCOMPLETE', sanity.assess_run(self.run, self.root)['verdict'])

    def test_recording_finalizes_with_sigint_without_killing_finished_recorder(self):
        process = Mock(returncode=0)
        process.wait.side_effect = subprocess.TimeoutExpired('recorder', 3)
        process.communicate.return_value = (b'', b'')
        process.poll.return_value = 0
        with patch.object(sanity.subprocess, 'Popen', return_value=process), patch.object(sanity, 'media_path', return_value=self.root / 'capture.mp4'):
            result = sanity.recording({}, 'SIM-1', self.root / 'capture.mp4', 3)
        process.send_signal.assert_called_once_with(signal.SIGINT)
        process.kill.assert_not_called()
        self.assertEqual('SIM-1', result['udid'])

    def test_recording_timeout_cleans_up_its_live_child(self):
        process = Mock()
        process.wait.side_effect = subprocess.TimeoutExpired('recorder', 3)
        process.communicate.side_effect = [subprocess.TimeoutExpired('recorder', 20), (b'', b'')]
        process.poll.return_value = None
        with patch.object(sanity.subprocess, 'Popen', return_value=process), self.assertRaises(subprocess.TimeoutExpired):
            sanity.recording({}, 'SIM-1', self.root / 'capture.mp4', 3)
        process.kill.assert_called_once_with()
        self.assertEqual(2, process.communicate.call_count)


if __name__ == '__main__':
    unittest.main()
