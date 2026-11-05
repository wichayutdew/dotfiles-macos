import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

SCRIPT = Path(os.environ.get('CLEANUP_SCRIPT', Path(__file__).with_name('cleanup-workspaces.py'))).resolve()

class CleanupRoots(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.base = Path(self.tmp.name).resolve()
        self.index = self.base / 'index.json'
        self.env = dict(os.environ, ACT_MKT_CLEANUP_INDEX=str(self.index), ACT_MKT_CLEANUP_LEGACY_LEDGER=str(self.base/'legacy.json'))
        self.env.pop('ACT_MKT_CLEANUP_LEDGER', None)
        self.env.pop('ACT_MKT_REGISTER_LEDGER', None)

    def run_helper(self, *args, success=True):
        result = subprocess.run([sys.executable, str(SCRIPT), *map(str,args)], env=self.env, text=True, capture_output=True)
        if success:
            self.assertEqual(result.returncode, 0, result.stderr)
            return json.loads(result.stdout)
        self.assertNotEqual(result.returncode, 0)
        return result

    def make_root(self, name):
        root = self.base / name
        root.mkdir()
        self.run_helper('register-root', root)
        (root/'notes.txt').write_text('task reference')
        return root

    def test_artifact_only_root_global_cleanup_and_preview(self):
        root = self.make_root('one')
        preview = self.run_helper('clean', '--all')
        self.assertIn(str(root), preview['wouldDeleteRoots'])
        self.assertTrue(root.exists())
        self.run_helper('clean', '--all', '--apply')
        self.assertFalse(root.exists())
        self.assertNotIn(str(root/'.artifacts/cleanup-ledger.json'), self.index.read_text())
        self.run_helper('clean', '--all', '--apply')

    def test_scoped_cleanup_keeps_other_root(self):
        one = self.make_root('one')
        two = self.make_root('two')
        self.run_helper('--ledger', one/'.artifacts/cleanup-ledger.json', 'clean', '--all', '--apply')
        self.assertFalse(one.exists())
        self.run_helper('--ledger', one/'.artifacts/cleanup-ledger.json', 'clean', '--all', '--apply')
        self.assertTrue(two.exists())
        self.run_helper('clean', '--all', '--apply')
        self.assertFalse(two.exists())

    def test_registered_git_resource_and_all_artifacts_are_deleted(self):
        root = self.make_root('one')
        checkout = root/'repository'
        checkout.mkdir()
        subprocess.run(['git', '-C', str(checkout), 'init'], capture_output=True, check=True)
        ledger = root/'.artifacts/cleanup-ledger.json'
        self.run_helper('--ledger', ledger, 'register', '--kind', 'clone', checkout)
        (root/'nested').mkdir()
        (root/'nested'/'report.md').write_text('report')
        self.run_helper('--ledger', ledger, 'clean', '--all', '--apply')
        self.assertFalse(root.exists())

    def test_previous_indexed_root_with_context_is_deleted(self):
        root = self.base/'legacy-task'
        (root/'.artifacts').mkdir(parents=True)
        ledger = root/'.artifacts/cleanup-ledger.json'
        ledger.write_text(json.dumps({'version':1, 'resources':[]}))
        (root/'.task-context.json').write_text(json.dumps({'workspace': {'root': str(root)}}))
        (root/'plan.md').write_text('legacy')
        self.index.write_text(json.dumps({'version':1, 'ledgers':[str(ledger)]}))
        self.run_helper('clean', '--all', '--apply')
        self.assertFalse(root.exists())
        self.assertNotIn(str(ledger), self.index.read_text())

    def test_ambiguous_legacy_root_is_not_deleted(self):
        root = self.base/'legacy-task'
        (root/'.artifacts').mkdir(parents=True)
        ledger = root/'.artifacts/cleanup-ledger.json'
        ledger.write_text(json.dumps({'version':1, 'resources':[]}))
        self.index.write_text(json.dumps({'version':1, 'ledgers':[str(ledger)]}))
        self.run_helper('clean', '--all', '--apply', success=False)
        self.assertTrue(root.exists())

    def test_untracked_nested_checkout_blocks_all_roots(self):
        one = self.make_root('one')
        two = self.make_root('two')
        nested = two / 'unowned'
        nested.mkdir()
        subprocess.run(['git', '-C', str(nested), 'init'], capture_output=True, check=True)
        self.run_helper('clean', '--all', '--apply', success=False)
        self.assertTrue(one.exists())
        self.assertTrue(two.exists())

    def test_missing_root_after_interruption_clears_tombstone(self):
        root = self.make_root('one')
        ledger = root/'.artifacts/cleanup-ledger.json'
        data = json.loads(self.index.read_text())
        data['roots'][str(ledger)]['deleting'] = True
        stat = root.stat()
        data['roots'][str(ledger)]['identity'] = [stat.st_dev, stat.st_ino]
        self.index.write_text(json.dumps(data))
        import shutil
        shutil.rmtree(root)
        self.run_helper('clean', '--all', '--apply')
        self.assertNotIn(str(ledger), self.index.read_text())

    def test_interrupted_partial_root_deletion_recovers_without_ledger(self):
        root = self.make_root('one')
        ledger = root/'.artifacts/cleanup-ledger.json'
        data = json.loads(self.index.read_text())
        stat = root.stat()
        data['roots'][str(ledger)].update(deleting=True, identity=[stat.st_dev, stat.st_ino])
        self.index.write_text(json.dumps(data))
        ledger.unlink()
        self.run_helper('clean', '--all', '--apply')
        self.assertFalse(root.exists())
        self.assertNotIn(str(ledger), self.index.read_text())

    def test_tombstone_cannot_delete_replaced_root(self):
        root = self.make_root('one')
        ledger = root/'.artifacts/cleanup-ledger.json'
        data = json.loads(self.index.read_text())
        data['roots'][str(ledger)]['deleting'] = True
        data['roots'][str(ledger)]['identity'] = [-1, -1]
        self.index.write_text(json.dumps(data))
        self.run_helper('clean', '--all', '--apply', success=False)
        self.assertTrue(root.exists())

    def test_replaced_marker_blocks_cleanup(self):
        root = self.make_root('one')
        (root/'.artifacts/.task-root-token').write_text('replaced')
        self.run_helper('clean', '--all', '--apply', success=False)
        self.assertTrue(root.exists())

if __name__ == '__main__':
    unittest.main()
