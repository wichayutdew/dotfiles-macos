import json
from pathlib import Path
import subprocess
import sys
import tempfile
import math
import unittest
import collect_prepare as c


def row(esc=1, channel='C04SM1C4BNH', ts='1794405288.201679'):
    return dict(esc_id=esc, esc_name='Alert', esc_status=2,
                esc_start_at_str='2026-11-11 13:54:21', rotation_name=None,
                channel_id=channel, mainthreadts=ts,
                slack_thread_url=(f'https://agoda.slack.com/archives/{channel}/p{ts.replace(".", "")}' if channel and ts else None))


def normalize(rows, **kw):
    data=dict(rows=rows, expectedRowCount=len(rows), expectedEscalationCount=len({r['esc_id'] for r in rows}), complete=True)
    data.update(kw)
    return c.normalize('10189', '2026-11-01', '2026-11-11', data)


class QueryTests(unittest.TestCase):
    def test_parameterized_membership_and_distinct_counts(self):
        result=c.render('10189', '2026-11-01', '2026-11-11', limit=100, offset=200)
        sql=result['query']
        self.assertEqual(sql.count('rotation_id = 10189'), 2)
        self.assertIn("e.esc_start_at_str >= '2026-11-01 00:00:00'", sql)
        self.assertIn("e.esc_start_at_str < '2026-11-12 00:00:00'", sql)
        self.assertIn('LEFT JOIN it_opd.esc_notification', sql)
        self.assertIn("n.type = 'SLACK'", sql)
        self.assertNotIn('esc_status =', sql)
        self.assertNotIn('CURRENT_DATE', sql)
        self.assertIn('COUNT(DISTINCT esc_id)', result['countQuery'])
        self.assertIn(result['baseQuery'], result['countQuery'])
        self.assertIn('LIMIT 100 OFFSET 200', sql)
    def test_cli_from_unrelated_cwd(self):
        script=Path(c.__file__).resolve()
        result=subprocess.run([sys.executable,str(script),'render','--rotation-id','17','--start','2026-11-01','--end','2026-11-11','--limit','1'],cwd=tempfile.gettempdir(),capture_output=True,text=True)
        self.assertEqual(result.returncode,0,result.stderr)
        self.assertEqual(json.loads(result.stdout)['rotationId'],17)
        missing=subprocess.run([sys.executable,str(script),'render','--start','2026-11-01','--end','2026-11-11'],cwd=tempfile.gettempdir(),capture_output=True,text=True)
        self.assertEqual(missing.returncode,2)
    def test_invalid_rotation_dates_and_pagination(self):
        for args in [('0','2026-11-01','2026-11-11'), ('1 OR 1=1','2026-11-01','2026-11-11'),('1','2026-02-30','2026-11-11'),('1','2026-11-12','2026-11-11')]:
            with self.subTest(args=args), self.assertRaises(ValueError): c.render(*args)
        for val in [-1, True, '2;DROP TABLE x']:
            with self.assertRaises(ValueError): c.render('1','2026-11-01','2026-11-11',offset=val)


class NormalizationTests(unittest.TestCase):
    def test_multi_thread_and_shared_thread_preserve_precision(self):
        rows=[row(),row(ts='1794405288.201680'),row(esc=2)]
        result=normalize(rows)
        self.assertEqual(result['counts']['escalations'],2)
        self.assertEqual(len(result['threads']),2)
        self.assertEqual(result['escalations'][0]['documentId'],'oncall:10189:1')
        self.assertEqual(len(result['escalations'][0]['threads']),2)
        self.assertEqual(len(result['escalations'][0]['sourceRows']),2)
        self.assertEqual(result['threads'][0]['messageTs'],'1794405288.201679')
    def test_duplicates_reconcile_distinct_relation(self):
        result=normalize([row(),row()],expectedRowCount=1)
        self.assertEqual(result['counts']['duplicateRows'],1)
        self.assertEqual(result['counts']['distinctRows'],1)
    def test_optional_nan_and_metadata_only(self):
        r=row(channel=None,ts=None);r['rotation_name']=math.nan
        result=normalize([r])
        self.assertEqual(result['escalations'][0]['evidenceStatus'],'metadata-only')
        self.assertIsNone(result['escalations'][0]['sourceRows'][0]['rotation_name'])
    def test_missing_one_coordinate_invalid_url_or_float_timestamp_blocks(self):
        for r in [row(channel=None),row(ts='1.2'),dict(row(),mainthreadts=1794405288.201679),dict(row(),slack_thread_url='https://evil.test')]:
            with self.subTest(r=r),self.assertRaises(ValueError): normalize([r])
    def test_truncation_error_and_count_mismatch_block(self):
        for extra in [dict(complete=False),dict(truncated=True),dict(error='denied'),dict(nextCursor='next'),dict(expectedRowCount=3),dict(expectedEscalationCount=2)]:
            with self.subTest(extra=extra),self.assertRaises(ValueError):normalize([row()],**extra)
    def test_interval_boundaries_and_all_statuses(self):
        a=row();a['esc_start_at_str']='2026-11-01 00:00:00';a['esc_status']=999
        b=row(esc=2);b['esc_start_at_str']='2026-11-11 23:59:59'
        self.assertEqual(normalize([a,b])['counts']['escalations'],2)
        for date in ['2026-10-31 23:59:59','2026-11-12 00:00:00']:
            with self.assertRaises(ValueError):normalize([dict(row(),esc_start_at_str=date)])
    def test_conflicting_metadata_is_preserved(self):
        other=dict(row(ts='1794405288.201680'),esc_name='Other observed name',esc_status=3)
        result=normalize([row(),other])['escalations'][0]
        self.assertTrue(result['metadataConflicts'])
        self.assertEqual(result['sourceRows'][1]['esc_status'],3)
    def test_empty_collection(self):
        self.assertEqual(normalize([])['counts']['escalations'],0)

if __name__=='__main__':unittest.main()
