#!/usr/bin/env python3
"""Behavioral tests with isolated local remotes; no hosted service access."""
import json
import os
from pathlib import Path
import subprocess
import shutil
import sys
import tempfile
import unittest

SCRIPT = Path(os.environ.get('TASK_WORKSPACE_SCRIPT', Path(__file__).with_name('task-workspace.py'))).resolve()

class WorkspaceTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='task-workspace-test-')
        self.addCleanup(self.temporary.cleanup)
        self.path = Path(self.temporary.name).resolve()
        self.launch = self.path / 'launch anywhere'
        self.launch.mkdir()
        self.ledger = self.path / 'ledger.json'
        self.env = dict(os.environ, ACT_MKT_CLEANUP_LEDGER=str(self.ledger), GIT_CONFIG_NOSYSTEM='1', GIT_CONFIG_GLOBAL='/dev/null', GIT_AUTHOR_NAME='Fixture', GIT_AUTHOR_EMAIL='fixture@example.test', GIT_COMMITTER_NAME='Fixture', GIT_COMMITTER_EMAIL='fixture@example.test')
        self.manifest = {'workspace': {'launchDirectory':str(self.launch), 'workId':'ACTB-3022', 'workIdSource':'tracker', 'root':str(self.launch / 'ACTB-3022')}, 'repositories':[]}
        self.file = self.path / 'manifest.json'

    def run_command(self, *args, cwd=None, check=True):
        return subprocess.run([str(x) for x in args], cwd=cwd or self.path, env=self.env, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=check)

    def git(self, path, *args):
        return self.run_command('git','-C',path,*args).stdout.strip()

    def repository(self, name, checkout=True, role='primary'):
        source = self.path / ('source-'+name)
        source.mkdir()
        self.git(source,'init','-b','main')
        (source/'file.txt').write_text(name+'\n')
        self.git(source,'add','file.txt'); self.git(source,'commit','-m','initial')
        remote = self.path / ('remote-'+name+'.git')
        self.run_command('git','clone','--bare',source,remote)
        self.git(source,'remote','add','origin',str(remote))
        head=self.git(source,'rev-parse','HEAD')
        root=Path(self.manifest['workspace']['root'])
        spec={'name':name, 'role':role, 'origin':str(remote), 'primaryCheckout':str(source) if checkout else None, 'cwd':str(root/name), 'baseBranch':'main','baseHead':head}
        if role=='reference': spec['rev']=head
        else: spec['sourceBranch']='feat/ACTB-3022'
        self.manifest['repositories'].append(spec)
        return source,spec

    def invoke(self, *args, success=True, cwd=None):
        self.file.write_text(json.dumps(self.manifest))
        result=self.run_command(sys.executable,SCRIPT,self.file,*args,cwd=cwd,check=False)
        if success:
            self.assertEqual(result.returncode,0,result.stderr)
            return json.loads(result.stdout)
        self.assertIn(result.returncode,(3,10),result.stderr)
        return result

    def test_multi_repo_from_other_cwd_and_missing_backing(self):
        source,one=self.repository('service')
        _,two=self.repository('client',checkout=False,role='editable')
        _,reference=self.repository('schema',checkout=False,role='reference')
        (source/'dirty.txt').write_text('preserve\n')
        result=self.invoke(cwd=SCRIPT.parent)
        self.assertEqual(result['workspace']['root'],str(self.launch/'ACTB-3022'))
        self.assertEqual(len(result['repositories']),3)
        for spec in (one,two,reference):
            target=Path(spec['cwd'])
            self.assertTrue((target/'.git').is_file())
            self.assertEqual(self.git(target,'rev-parse','HEAD'),spec['baseHead'])
        self.assertEqual(self.git(two['cwd'],'branch','--show-current'),two['sourceBranch'])
        self.assertEqual(self.git(reference['cwd'],'branch','--show-current'),'')
        self.assertEqual((source/'dirty.txt').read_text(),'preserve\n')
        self.assertEqual(self.git(source,'branch','--show-current'),'main')
        entries=json.loads(self.ledger.read_text())['resources']
        self.assertEqual(len(entries),5)
        self.assertNotIn(str(source),[x['path'] for x in entries])

    def test_repeat_and_check_preserve_progress_without_remote(self):
        _,spec=self.repository('service',checkout=False)
        self.invoke()
        cwd=Path(spec['cwd'])
        (cwd/'file.txt').write_text('progress\n'); self.git(cwd,'add','file.txt'); self.git(cwd,'commit','-m','progress')
        (cwd/'dirty.txt').write_text('pending\n')
        (cwd/'file.txt').write_text('unstaged edit\n')
        self.invoke()
        state=Path(self.manifest['workspace']['root'])/'.task-workspace.json'
        before=(state.read_bytes(),self.ledger.read_bytes())
        Path(spec['origin']).rename(self.path/'remote-offline.git')
        output=self.invoke('--check')
        self.assertEqual(before,(state.read_bytes(),self.ledger.read_bytes()))
        self.assertEqual(output['repositories'][0]['dirty'],self.run_command('git','-C',cwd,'status','--porcelain=v1','--untracked-files=all').stdout.rstrip('\n'))
        self.assertTrue(output['repositories'][0]['dirty'].startswith(' M '))
        self.assertEqual(output['repositories'][0]['head'],self.git(cwd,'rev-parse','HEAD'))

    def test_branch_in_use_preserves_source_and_creates_no_checkout(self):
        source,spec=self.repository('service')
        self.git(source,'switch','-c',spec['sourceBranch'])
        result=self.invoke(success=False)
        self.assertIn('branch',result.stderr.lower())
        self.assertFalse(Path(spec['cwd']).exists())
        self.assertEqual(self.git(source,'branch','--show-current'),spec['sourceBranch'])

    def test_preflight_duplicate_names_and_unsafe_paths(self):
        _,spec=self.repository('service')
        self.manifest['repositories'].append(dict(spec))
        self.invoke(success=False)
        self.assertFalse(Path(spec['cwd']).exists())
        self.manifest['repositories'].pop()
        spec['cwd']=str(self.launch/'escape')
        self.invoke(success=False)
        self.assertFalse((self.launch/'escape').exists())

    def test_origin_mismatch_and_symlink_collision(self):
        source,spec=self.repository('service')
        self.git(source,'remote','set-url','origin',str(self.path/'wrong.git'))
        self.invoke(success=False)
        self.git(source,'remote','set-url','origin',spec['origin'])
        root=Path(self.manifest['workspace']['root']); root.mkdir(exist_ok=True)
        Path(spec['cwd']).symlink_to(source,target_is_directory=True)
        self.invoke(success=False)
        self.assertEqual(self.git(source,'branch','--show-current'),'main')

    def test_check_reference_pin_and_base_mismatch(self):
        source,spec=self.repository('schema',role='reference')
        self.invoke()
        (source/'file.txt').write_text('other\n'); self.git(source,'add','file.txt'); self.git(source,'commit','-m','other')
        self.git(spec['cwd'],'checkout','--detach',self.git(source,'rev-parse','HEAD'))
        self.invoke('--check',success=False)

    def test_names_disambiguate_equal_remote_basenames_and_cleanup(self):
        _,one=self.repository('first',checkout=False)
        _,two=self.repository('second',checkout=False,role='editable')
        for index,spec in enumerate((one,two)):
            old=Path(spec['origin']); parent=self.path/str(index); parent.mkdir()
            target=parent/'same.git'; old.rename(target); spec['origin']=str(target)
        self.invoke()
        helper=SCRIPT.with_name('cleanup-workspaces.py')
        self.run_command(sys.executable,helper,'clean','--all','--apply')
        self.assertFalse(Path(one['cwd']).exists()); self.assertFalse(Path(two['cwd']).exists())
        self.assertFalse((Path(self.manifest['workspace']['root'])/'.sources'/'first').exists())

    def test_partial_failure_can_resume(self):
        _,one=self.repository('one',checkout=False)
        _,two=self.repository('two',checkout=False,role='editable')
        remote=Path(two['origin']); offline=remote.with_name('offline.git'); remote.rename(offline)
        self.invoke(success=False)
        self.assertTrue(Path(one['cwd']).exists())
        offline.rename(remote)
        self.invoke()
        self.assertTrue(Path(two['cwd']).exists())
        self.assertEqual(len(json.loads(self.ledger.read_text())['resources']),4)

    def test_output_manifest_can_be_reused_for_comment_handoff(self):
        _,spec=self.repository('service',checkout=False)
        output=self.invoke()
        self.manifest=output
        result=self.invoke('--check',cwd=SCRIPT.parent)
        self.assertEqual(result['workspace']['root'],output['workspace']['root'])
        self.assertEqual(result['repositories'][0]['cwd'],spec['cwd'])
        self.invoke()
        self.assertEqual(len(json.loads(self.ledger.read_text())['resources']),2)

    def test_fork_default_source_branch_gets_real_worktree(self):
        _,spec=self.repository('service',checkout=False)
        spec['sourceBranch']='main'
        self.invoke()
        self.assertTrue((Path(spec['cwd'])/'.git').is_file())
        self.assertEqual(self.git(spec['cwd'],'branch','--show-current'),'main')

    def test_check_on_missing_workspace_creates_nothing(self):
        _,spec=self.repository('service',checkout=False)
        self.invoke('--check',success=False)
        self.assertFalse(Path(self.manifest['workspace']['root']).exists())
        self.assertFalse(self.ledger.exists())

    def test_base_drift_returns_gaps_and_preserves_record(self):
        _,spec=self.repository('service')
        self.invoke()
        cwd=Path(spec['cwd'])
        tree=self.git(cwd,'rev-parse','HEAD^{tree}')
        unrelated=self.git(cwd,'commit-tree',tree,'-m','unrelated root')
        self.git(cwd,'update-ref','refs/heads/'+spec['sourceBranch'],unrelated)
        state=Path(self.manifest['workspace']['root'])/'.task-workspace.json'
        before=state.read_bytes()
        result=self.invoke('--check',success=False)
        self.assertEqual(result.returncode,10,result.stderr)
        self.assertEqual(before,state.read_bytes())

    def test_known_source_missing_base_fails_before_creating_task(self):
        _,spec=self.repository('service')
        spec['baseHead']='0'*40
        self.invoke(success=False)
        self.assertFalse(Path(self.manifest['workspace']['root']).exists())

    def test_ledger_survives_session_environment_change(self):
        _,spec=self.repository('service',checkout=False)
        self.manifest=self.invoke()
        del self.env['ACT_MKT_CLEANUP_LEDGER']
        self.assertEqual(self.invoke('--check')['cleanupLedger'],str(self.ledger))
        self.assertEqual(self.invoke()['cleanupLedger'],str(self.ledger))
        self.repository('added',checkout=False,role='editable')
        self.assertEqual(self.invoke()['cleanupLedger'],str(self.ledger))
        self.assertEqual(len(json.loads(self.ledger.read_text())['resources']),4)
        self.env['ACT_MKT_CLEANUP_LEDGER']=str(self.path/'other-ledger.json')
        self.invoke('--check',success=False)
        self.assertFalse((self.path/'other-ledger.json').exists())

    def test_ledger_cannot_live_in_owned_workspace(self):
        _,spec=self.repository('service',checkout=False)
        self.env['ACT_MKT_CLEANUP_LEDGER']=str(Path(self.manifest['workspace']['root'])/'ledger.json')
        self.invoke(success=False)
        self.assertFalse(Path(self.manifest['workspace']['root']).exists())

    def test_output_manifest_recovers_missing_owned_backing(self):
        _,spec=self.repository('service',checkout=False)
        self.manifest=self.invoke()
        self.run_command(sys.executable,SCRIPT.with_name('cleanup-workspaces.py'),'clean','--all','--apply')
        self.invoke()
        self.assertTrue((Path(spec['cwd'])/'.git').is_file())

    def test_missing_worktree_recovers_recorded_implementation_head(self):
        source,spec=self.repository('service')
        self.invoke()
        cwd=Path(spec['cwd'])
        (cwd/'file.txt').write_text('implemented change\n')
        self.git(cwd,'add','file.txt'); self.git(cwd,'commit','-m','implementation')
        self.manifest=self.invoke('--check')
        head=self.manifest['repositories'][0]['head']
        self.git(source,'worktree','remove',cwd)
        self.invoke()
        self.assertEqual(self.git(cwd,'rev-parse','HEAD'),head)
        self.assertEqual((cwd/'file.txt').read_text(),'implemented change\n')

    def test_stale_registration_does_not_steal_branch(self):
        source,spec=self.repository('service')
        self.invoke()
        shutil.rmtree(spec['cwd'])
        result=self.invoke(success=False)
        self.assertIn('branch already checked out',result.stderr)
        self.assertIn(spec['cwd'],self.git(source,'worktree','list','--porcelain'))
        self.assertFalse(Path(spec['cwd']).exists())

    def test_approved_addition_keeps_existing_repository(self):
        _,one=self.repository('one',checkout=False)
        self.invoke()
        _,two=self.repository('two',checkout=False,role='editable')
        self.invoke()
        self.assertTrue(Path(one['cwd']).exists()); self.assertTrue(Path(two['cwd']).exists())
        self.manifest['repositories'].pop(0)
        self.invoke(success=False)
        self.assertTrue(Path(one['cwd']).exists())

    def test_check_disables_lazy_fetch_for_every_git_read(self):
        self.repository('service',checkout=False)
        self.invoke()
        wrappers=self.path/'wrappers'; wrappers.mkdir()
        log=self.path/'git-reads.jsonl'
        real_git=shutil.which('git',path=self.env['PATH'])
        wrapper=wrappers/'git'
        wrapper.write_text('#!'+sys.executable+'\nimport json, os, sys\n'
                           +'with open('+repr(str(log))+',"a") as out: out.write(json.dumps([os.environ.get("GIT_NO_LAZY_FETCH"),sys.argv[1:]])+"\\n")\n'
                           +'os.execv('+repr(real_git)+', ["git"]+sys.argv[1:])\n')
        wrapper.chmod(0o755)
        self.env['PATH']=str(wrappers)+os.pathsep+self.env['PATH']
        self.invoke('--check')
        calls=[json.loads(line) for line in log.read_text().splitlines()]
        self.assertGreater(len(calls),3)
        self.assertTrue(all(value=='1' for value,args in calls))
        self.assertFalse(any('fetch' in args or 'clone' in args for value,args in calls))

    def test_summary_root_and_invalid_work_id(self):
        _,spec=self.repository('service')
        old=Path(self.manifest['workspace']['root'])
        self.manifest['workspace'].update(workId='repair-cache',workIdSource='summary',root=str(self.launch/'repair-cache'))
        spec['cwd']=str(self.launch/'repair-cache'/'service')
        self.invoke()
        self.assertFalse(old.exists())
        self.manifest['workspace']['workId']='../escape'
        self.invoke(success=False)

if __name__=='__main__': unittest.main()
