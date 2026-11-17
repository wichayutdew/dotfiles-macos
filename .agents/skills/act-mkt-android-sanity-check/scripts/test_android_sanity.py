import base64
import copy
import json
import subprocess
import sys
import tempfile
import unittest
import shutil
from pathlib import Path

import android_sanity as sanity

PNG = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j7X8AAAAASUVORK5CYII=')
MR = 'https://gitlab.agodadev.io/example/android/-/merge_requests/123'


class AndroidSanityTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.run = sanity.create_run(MR)
        self.run['context'].update({'mr_sha': 'a' * 40, 'mr_type': 'cxp', 'environment': 'prelive', 'device': {'serial': 'emulator-5554'}, 'app': {'identity_verified': True}, 'web': {'identity_verified': True}})
        self.run['context']['app'].update({'package': 'test.package', 'version': '1', 'build': '1', 'sha256': 'b' * 64, 'source': 'fixture job', 'verification_evidence': ['identity.txt'], 'flavor': 'production_rc', 'schemes': ['agoda']})
        self.run['context']['web'].update({'branch': 'MR123', 'sha': 'a' * 40, 'verification_evidence': ['identity.txt']})
        (self.root / 'identity.txt').write_text('Fixture identity proof')
        self.run['scope'].update({'experiments': ['EXP-1'], 'requirements': ['AC-1']})
        self.run['settings'].update({'restoration': 'restored', 'evidence': ['cleanup.txt']})
        self.run['settings']['before'] = 'before.txt'
        (self.root / 'before.txt').write_text('Original settings')
        (self.root / 'cleanup.txt').write_text('Original settings restored')
        for case in self.run['cases']:
            case.update({'status': 'PASS', 'steps': ['Observed screen'], 'actual': 'Expected screen visible', 'expected': ['Expected screen'], 'experiments': {'EXP-1': 'A'}, 'variant_verified': True, 'requirements': ['AC-1']})
        self.run['cases'][-1]['experiments'] = {'EXP-1': 'B'}

    def test_create_run_preserves_exact_links_and_language_launch_matrix(self):
        run = sanity.create_run(MR)
        links = [c for c in run['cases'] if c['suite'] == 'links']
        self.assertEqual(32, len(links))
        self.assertEqual({('en', 'cold'), ('en', 'warm'), ('th', 'cold'), ('th', 'warm')}, {(c['locale'], c['launch_state']) for c in links})
        self.assertIn('https://www.agoda.com/th-th/activities/detail/th/pattaya/easykart-go-karting-pattaya-bali-hai-pier', {c['url'] for c in links})
        self.assertTrue(all(c['status'] == 'NOT_RUN' for c in run['cases']))

    def test_ambiguous_device_is_rejected_and_explicit_serial_selected(self):
        devices = 'List of devices attached\nemulator-5554 device product:sdk\nR123 device product:phone\n'
        with self.assertRaisesRegex(ValueError, 'serial'):
            sanity.select_device(devices)
        self.assertEqual('R123', sanity.select_device(devices, 'R123'))

    def test_offline_or_unauthorized_device_cannot_be_selected(self):
        for status in ['offline', 'unauthorized']:
            with self.subTest(status=status), self.assertRaises(ValueError):
                sanity.select_device('List of devices attached\nR123 ' + status + '\n', 'R123')

    def test_complete_run_passes(self):
        result = sanity.assess_run(self.run, self.root)
        self.assertEqual('PASS', result['verdict'])
        self.assertEqual([], result['issues'])

    def smoke_target(self, **selector):
        run = sanity.create_run(app_flavor='production_rc', **selector)
        target = run['context']['target']
        run['context'].update({k: copy.deepcopy(v) for k, v in self.run['context'].items() if not k.startswith('mr_')})
        target.update({'type': 'native'})
        if target['kind'] == 'branch':
            target['sha'] = 'a' * 40
        run['settings'] = copy.deepcopy(self.run['settings'])
        for case in run['cases']:
            case.update({'status': 'PASS', 'steps': ['Observed screen'], 'actual': 'Expected screen visible'})
        return run

    def test_canonical_smoke_cannot_be_removed_from_cases_and_required_ids(self):
        for target in ['mr', 'mr-smoke', 'branch', 'release_candidate']:
            with self.subTest(target=target):
                if target.startswith('mr'):
                    run = copy.deepcopy(self.run)
                    if target == 'mr-smoke':
                        run['scope'].update({'mode': 'smoke', 'experiments': [], 'requirements': [],
                                             'no_experiment_reason': 'Baseline smoke',
                                             'feature_deferral_reason': 'Feature checks deferred'})
                else:
                    run = self.smoke_target(**{target: 'main' if target == 'branch' else 'rc1'})
                run['cases'] = [run['cases'][0]] + [c for c in run['cases'] if c['suite'] == 'feature']
                run['required_case_ids'] = [c['id'] for c in run['cases']]
                result = sanity.assess_run(run, self.root)
                self.assertEqual('INCOMPLETE', result['verdict'])
                self.assertFalse(result['evidence_complete'])

    def test_canonical_smoke_ids_cannot_change_their_bindings(self):
        mutations = {'suite': 'feature', 'locale': 'en', 'launch_state': 'warm',
                     'canonical_url': 'agoda://activities', 'url': 'agoda://activities'}
        for field, value in mutations.items():
            with self.subTest(field=field):
                run = self.smoke_target(branch='main')
                case = next(c for c in run['cases'] if c['id'] == 'SEARCH-DL-th-cold')
                case[field] = value
                result = sanity.assess_run(run, self.root)
                self.assertEqual('INCOMPLETE', result['verdict'])
                self.assertFalse(result['evidence_complete'])
        for field, value in {'suite': 'links', 'locale': 'en', 'launch_state': 'cold',
                             'canonical_url': 'https://www.agoda.com/activities',
                             'url': 'https://www.agoda.com/activities'}.items():
            with self.subTest(funnel_field=field):
                run = self.smoke_target(branch='main')
                case = next(c for c in run['cases'] if c['id'] == 'FUNNEL-th')
                case[field] = value
                self.assertEqual('INCOMPLETE', sanity.assess_run(run, self.root)['verdict'])

    def test_rerun_cannot_hide_changed_canonical_smoke_binding(self):
        run = self.smoke_target(branch='main')
        original = next(c for c in run['cases'] if c['id'] == 'HOME-UL-en-cold')
        rerun = copy.deepcopy(original)
        rerun['attempt'] = 2
        run['cases'].append(rerun)
        original['url'] = 'https://www.agoda.com/activities/search'
        self.assertEqual('INCOMPLETE', sanity.assess_run(run, self.root)['verdict'])

    def test_beta_smoke_retains_unexecuted_template_history_and_alternate_app(self):
        run = self.smoke_target(branch='main')
        run['context']['app'].update({'flavor': 'beta', 'schemes': ['agoda4']})
        for case in run['cases']:
            if case.get('url', '').startswith('agoda://'):
                case['url'] = case['url'].replace('agoda://', 'agoda4://', 1)
        case = next(c for c in run['cases'] if c['id'] == 'HOME-DL-en-cold')
        rerun = copy.deepcopy(case)
        rerun['attempt'] = 2
        run['cases'].append(rerun)
        case.update({'status': 'SKIPPED', 'blocker': 'Production template before beta scheme selection',
                     'url': 'agoda://activities'})
        alternate = copy.deepcopy(self.run['context']['app'])
        alternate['package'] = 'release.package'
        run['context']['additional_apps'] = {'release.package': alternate}
        diagnostic = next(c for c in run['cases'] if c['id'] == 'HOME-DL-en-warm')
        diagnostic.update({'app_package': 'release.package', 'url': 'agoda://activities'})
        self.assertEqual('PASS', sanity.assess_run(run, self.root)['verdict'])

    def test_custom_feature_cases_remain_supported(self):
        run = copy.deepcopy(self.run)
        for case in run['cases']:
            if case['suite'] == 'feature':
                old_id = case['id']
                case['id'] = 'CUSTOM-' + old_id
                run['required_case_ids'][run['required_case_ids'].index(old_id)] = case['id']
        self.assertEqual('PASS', sanity.assess_run(run, self.root)['verdict'])

    def test_init_accepts_branch_and_release_targets_without_an_mr(self):
        for flag, ref, kind in [('--branch', 'main', 'branch'), ('--branch', 'master', 'branch'), ('--release-candidate', 'v1.2.3-rc2', 'release_candidate')]:
            with self.subTest(ref=ref):
                destination = self.root / ref
                result = subprocess.run([sys.executable, str(Path(sanity.__file__)), 'init', flag, ref, '--app-flavor', 'beta', '--out', str(destination)], capture_output=True, text=True)
                self.assertEqual(0, result.returncode, result.stderr)
                run = json.loads((destination / 'run.json').read_text())
                self.assertEqual((kind, ref), (run['context']['target']['kind'], run['context']['target']['ref']))
                self.assertNotIn('mr_url', run['context'])
                self.assertEqual('smoke', run['scope']['mode'])
                self.assertEqual(34, len(run['cases']))
                self.assertTrue(all(c['status'] == 'NOT_RUN' for c in run['cases']))
                self.assertTrue(all(not c['url'].startswith('agoda://') for c in run['cases'] if c['suite'] == 'links'))

    def test_exactly_one_nonempty_target_is_required(self):
        for selector in [{}, {'mr_url': MR, 'branch': 'main'}, {'branch': 'main', 'release_candidate': 'rc1'}, {'branch': ' '}, {'release_candidate': 'rc\n1'}]:
            with self.subTest(selector=selector), self.assertRaises(ValueError):
                sanity.create_run(**selector)

    def test_branch_report_requires_a_pinned_revision_and_build_type(self):
        run = self.smoke_target(branch='master')
        self.assertEqual('PASS', sanity.assess_run(run, self.root)['verdict'])
        report = sanity.render_report(run, self.root)
        self.assertIn('Target: branch `master`', report)
        self.assertNotIn('MR:', report)
        self.assertNotIn('MR feature sign-off', report)
        for field in ['sha', 'type']:
            value = run['context']['target'].pop(field)
            self.assertEqual('INCOMPLETE', sanity.assess_run(run, self.root)['verdict'])
            run['context']['target'][field] = value

    def test_release_candidate_uses_verified_artifact_identity_without_git_sha(self):
        run = self.smoke_target(release_candidate='2026.11-rc3')
        self.assertEqual('PASS', sanity.assess_run(run, self.root)['verdict'])
        self.assertIn('Target: release candidate `2026.11-rc3`', sanity.render_report(run, self.root))
        for field in ['source', 'sha256', 'verification_evidence', 'identity_verified']:
            value = run['context']['app'].pop(field)
            self.assertEqual('INCOMPLETE', sanity.assess_run(run, self.root)['verdict'])
            run['context']['app'][field] = value
        run['context']['target']['sha'] = 'not-a-git-sha'
        self.assertEqual('INCOMPLETE', sanity.assess_run(run, self.root)['verdict'])

    def test_non_mr_cxp_requires_matching_verified_served_revision(self):
        for selector in [{'branch': 'main'}, {'release_candidate': 'rc1'}]:
            with self.subTest(selector=selector):
                run = self.smoke_target(**selector)
                run['context']['target'].update({'type': 'cxp', 'sha': 'a' * 40})
                self.assertEqual('PASS', sanity.assess_run(run, self.root)['verdict'])
                run['context']['web']['sha'] = 'c' * 40
                self.assertEqual('INCOMPLETE', sanity.assess_run(run, self.root)['verdict'])
                run['context']['web']['sha'] = 'a' * 40
                run['context']['target'].pop('sha')
                self.assertEqual('INCOMPLETE', sanity.assess_run(run, self.root)['verdict'])

    def test_non_mr_targets_keep_flavor_and_failure_media_guards(self):
        run = self.smoke_target(release_candidate='rc1')
        run['context']['app']['flavor'] = 'beta'
        self.assertEqual('INCOMPLETE', sanity.assess_run(run, self.root)['verdict'])
        run['context']['app']['flavor'] = 'production_rc'
        run['cases'][0]['status'] = 'FAIL'
        result = sanity.assess_run(run, self.root)
        self.assertEqual('FAIL', result['verdict'])
        self.assertFalse(result['evidence_complete'])
        (self.root / 'failure.png').write_bytes(PNG)
        run['cases'][0]['evidence'] = ['failure.png']
        self.assertTrue(sanity.assess_run(run, self.root)['evidence_complete'])

    def test_missing_or_unknown_target_cannot_pass(self):
        run = self.smoke_target(branch='main')
        for target in [{}, {'kind': None}, {'kind': 'unknown', 'ref': 'main', 'sha': 'a' * 40, 'type': 'native'}]:
            run['context']['target'] = target
            self.assertEqual('INCOMPLETE', sanity.assess_run(run, self.root)['verdict'])
            self.assertIn('Result: INCOMPLETE', sanity.render_report(run, self.root))

    def test_flavor_selects_deeplink_scheme_and_retains_runbook_urls(self):
        for flavor, scheme in [('production_rc', 'agoda'), ('beta', 'agoda4')]:
            run = sanity.create_run(MR, flavor)
            links = [c for c in run['cases'] if c['suite'] == 'links']
            self.assertEqual(32, len(links))
            for case in links:
                original = case['canonical_url']
                self.assertEqual(original.replace('agoda://', scheme + '://', 1), case['url'])
            self.assertEqual(flavor, run['context']['app']['flavor'])
        self.run['context']['app']['flavor'] = 'beta'
        self.assertEqual('INCOMPLETE', sanity.assess_run(self.run, self.root)['verdict'])
        self.run['context']['app']['schemes'] = ['agoda4']
        self.assertEqual('INCOMPLETE', sanity.assess_run(self.run, self.root)['verdict'])
        for case in self.run['cases']:
            if case.get('url', '').startswith('agoda://'):
                case['url'] = case['url'].replace('agoda://', 'agoda4://', 1)
        self.assertEqual('PASS', sanity.assess_run(self.run, self.root)['verdict'])
        self.assertIn('Runbook URL:', sanity.render_report(self.run, self.root))
        self.run['context']['app'].pop('flavor')
        self.assertEqual('INCOMPLETE', sanity.assess_run(self.run, self.root)['verdict'])

    def test_failed_test_requires_existing_recognizable_media(self):
        case = self.run['cases'][0]
        case['status'] = 'FAIL'
        case['evidence'] = ['missing.png']
        result = sanity.assess_run(self.run, self.root)
        self.assertEqual('FAIL', result['verdict'])
        self.assertTrue(any('failure media' in issue for issue in result['issues']))
        (self.root / 'failure.png').write_bytes(PNG)
        case['evidence'] = ['failure.png']
        self.assertEqual([], sanity.assess_run(self.run, self.root)['issues'])
        (self.root / 'failure.png').write_text('not a screenshot')
        self.assertTrue(any('failure media' in issue for issue in sanity.assess_run(self.run, self.root)['issues']))

    def test_evidence_cannot_escape_run_directory_via_path_or_symlink(self):
        outside = self.root.parent / (self.root.name + '-outside.png')
        outside.write_bytes(PNG)
        self.addCleanup(outside.unlink)
        (self.root / 'alias.png').symlink_to(outside)
        for path in ['../' + outside.name, str(outside), 'alias.png']:
            with self.subTest(path=path):
                self.assertIsNone(sanity.media_path(self.root, path))

    @unittest.skipUnless(shutil.which('ffprobe'), 'Optional installed video probe unavailable')
    def test_header_only_mp4_cannot_satisfy_failure_media(self):
        path = self.root / 'empty.mp4'
        path.write_bytes(b'\x00\x00\x00\x18ftypmp42' + b'\x00' * 64)
        self.assertIsNone(sanity.media_path(self.root, path.name))

    def test_unverified_variant_build_or_web_revision_prevents_pass(self):
        self.run['cases'][0]['variant_verified'] = False
        self.assertEqual('INCOMPLETE', sanity.assess_run(self.run, self.root)['verdict'])
        self.run['cases'][0]['variant_verified'] = True
        for layer in ['app', 'web']:
            self.run['context'][layer]['identity_verified'] = False
            self.assertEqual('INCOMPLETE', sanity.assess_run(self.run, self.root)['verdict'])
            self.run['context'][layer]['identity_verified'] = True

    def test_baseline_smoke_does_not_claim_or_require_feature_overrides(self):
        for case in self.run['cases']:
            if case['suite'] != 'feature':
                case.update({'experiments': {}, 'variant_verified': False})
        self.assertEqual('PASS', sanity.assess_run(self.run, self.root)['verdict'])

    def test_explicit_smoke_scope_defers_features_without_implying_signoff(self):
        self.run['cases'] = [c for c in self.run['cases'] if c['suite'] != 'feature']
        self.run['required_case_ids'] = [c['id'] for c in self.run['cases']]
        self.run['scope'].update({'mode': 'smoke', 'experiments': [], 'requirements': [],
                                  'no_experiment_reason': 'Original API selections restored',
                                  'feature_deferral_reason': 'User deferred campaign checks'})
        for case in self.run['cases']:
            case.update({'experiments': {}, 'variant_verified': False, 'requirements': []})
        self.assertEqual('PASS', sanity.assess_run(self.run, self.root)['verdict'])
        self.assertIn('MR feature sign-off is deferred', sanity.render_report(self.run, self.root))
        self.run['scope']['feature_deferral_reason'] = ''
        self.assertEqual('INCOMPLETE', sanity.assess_run(self.run, self.root)['verdict'])
        del self.run['scope']['feature_deferral_reason']
        self.assertIn('Smoke scope needs', sanity.render_report(self.run, self.root))
        self.run['scope']['mode'] = 'full'
        self.assertIn('MR feature coverage is missing', sanity.assess_run(self.run, self.root)['issues'])

    def test_identity_boolean_without_package_or_revision_details_cannot_pass(self):
        self.run['context']['app'] = {'identity_verified': True}
        self.run['context']['web'] = {'identity_verified': True}
        self.assertEqual('INCOMPLETE', sanity.assess_run(self.run, self.root)['verdict'])

    def test_alternate_test_package_requires_its_own_verified_identity(self):
        self.run['cases'][0]['app_package'] = 'release.package'
        self.assertEqual('INCOMPLETE', sanity.assess_run(self.run, self.root)['verdict'])
        alternate = copy.deepcopy(self.run['context']['app'])
        alternate['package'] = 'release.package'
        self.run['context']['additional_apps'] = {'release.package': alternate}
        self.assertEqual('PASS', sanity.assess_run(self.run, self.root)['verdict'])

    def test_capture_never_overwrites_existing_evidence(self):
        path = self.root / 'existing.png'
        path.write_bytes(PNG)
        with self.assertRaisesRegex(ValueError, 'already exists'):
            sanity.capture('adb-must-not-run', 'serial', path)
        self.assertEqual(PNG, path.read_bytes())

    def test_untrusted_or_non_mr_urls_are_rejected(self):
        for value in ['http://gitlab.agodadev.io/a/-/merge_requests/1', 'https://evil.example/a/-/merge_requests/1', MR + '?token=secret', 'https://user:secret@gitlab.agodadev.io/a/-/merge_requests/1']:
            with self.subTest(value=value), self.assertRaises(ValueError):
                sanity.create_run(value)

    def test_unfinished_cleanup_and_missing_required_case_prevent_pass(self):
        self.run['settings']['restoration'] = 'pending'
        self.run['cases'].pop(0)
        issues = sanity.assess_run(self.run, self.root)['issues']
        self.assertTrue(any('cleanup' in issue for issue in issues))
        self.assertTrue(any('required case' in issue for issue in issues))

    def test_missing_before_state_prevents_cleanup_claim(self):
        self.run['settings']['before'] = ''
        self.assertEqual('INCOMPLETE', sanity.assess_run(self.run, self.root)['verdict'])

    def test_missing_B_or_required_combination_prevents_pass(self):
        self.run['cases'][-1]['experiments'] = {'EXP-1': 'A'}
        self.assertEqual('INCOMPLETE', sanity.assess_run(self.run, self.root)['verdict'])
        self.run['cases'][-1]['experiments'] = {'EXP-1': 'B'}
        self.run['scope']['required_combinations'] = [{'EXP-1': 'B', 'EXP-2': 'A'}]
        self.assertEqual('INCOMPLETE', sanity.assess_run(self.run, self.root)['verdict'])

    def test_rerun_does_not_erase_initial_failure_or_its_attachment(self):
        failed = self.run['cases'][0]
        failed.update({'status': 'FAIL', 'evidence': ['failure.png']})
        (self.root / 'failure.png').write_bytes(PNG)
        rerun = copy.deepcopy(failed)
        rerun.update({'attempt': 2, 'status': 'PASS', 'evidence': []})
        self.run['cases'].append(rerun)
        report = sanity.render_report(self.run, self.root)
        self.assertIn('FAIL', report)
        self.assertIn('failure.png', report)
        self.assertIn('attempt 2', report)
        self.assertEqual('FAIL', sanity.assess_run(self.run, self.root)['verdict'])

    def test_blocked_result_requires_reason_and_never_becomes_pass(self):
        case = self.run['cases'][0]
        case.update({'status': 'BLOCKED', 'blocker': ''})
        self.assertEqual('INCOMPLETE', sanity.assess_run(self.run, self.root)['verdict'])
        case['blocker'] = 'Matching artifact unavailable'
        self.assertIn('Matching artifact unavailable', sanity.render_report(self.run, self.root))

    def test_resolved_prerequisite_uses_latest_attempt_and_retains_history(self):
        blocked = self.run['cases'][0]
        rerun = copy.deepcopy(blocked)
        blocked.update({'status': 'BLOCKED', 'blocker': 'Test account sign-in required'})
        rerun['attempt'] = 2
        self.run['cases'].insert(0, rerun)
        result = sanity.assess_run(self.run, self.root)
        self.assertEqual('PASS', result['verdict'])
        self.assertEqual(0, result['counts'].get('BLOCKED', 0))
        self.assertIn('Test account sign-in required', sanity.render_report(self.run, self.root))
        rerun.update({'status': 'BLOCKED', 'blocker': 'Access expired'})
        self.assertEqual('INCOMPLETE', sanity.assess_run(self.run, self.root)['verdict'])

    def test_report_embeds_failure_image_and_preserves_expected_actual(self):
        case = self.run['cases'][0]
        case.update({'status': 'FAIL', 'actual': 'Blank screen | no activity', 'evidence': ['failure.png']})
        (self.root / 'failure.png').write_bytes(PNG)
        report = sanity.render_report(self.run, self.root)
        self.assertIn('![', report)
        self.assertIn('failure.png', report)
        self.assertIn('Blank screen', report)
        self.assertIn('Expected screen', report)
        self.assertIn(str(self.root.resolve() / 'failure.png'), report)


if __name__ == '__main__':
    unittest.main()
