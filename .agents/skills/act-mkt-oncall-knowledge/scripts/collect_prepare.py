#!/usr/bin/env python3
"""Render read-only StarRocks queries or normalize fully collected rows (stdlib only).

This helper has no network access. Execute rendered SQL through the authenticated
SQL connector, inspect its complete envelopes, and supply reconciled rows/counts.
"""
import argparse
import datetime as dt
import json
import math
from pathlib import Path
import re
import sys

PACKAGE = Path(__file__).resolve().parent.parent
FIELDS = ('esc_id', 'esc_name', 'esc_status', 'esc_start_at_str', 'rotation_name',
          'channel_id', 'mainthreadts', 'slack_thread_url')


def positive_id(value, label):
    if isinstance(value, bool) or not isinstance(value, (int, str)) or not re.fullmatch(r'[1-9][0-9]*', str(value)):
        raise ValueError(f'{label} must be a positive integer')
    return int(value)


def bounds(rotation, start, end):
    rotation = positive_id(rotation, 'rotation_id')
    if any(not isinstance(v,str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', v) for v in (start,end)):
        raise ValueError('dates must be YYYY-MM-DD')
    first, last = dt.date.fromisoformat(start), dt.date.fromisoformat(end)
    if first > last:
        raise ValueError('start must be on or before end')
    after = last + dt.timedelta(days=1)
    return rotation, f'{first} 00:00:00', f'{after} 00:00:00'


def nonnegative(value, label):
    if isinstance(value,bool) or not isinstance(value,int) or value < 0:
        raise ValueError(f'{label} must be a nonnegative integer')
    return value


def render(rotation, start, end, limit=None, offset=0):
    rotation, first, after = bounds(rotation, start, end)
    offset = nonnegative(offset,'offset')
    if limit is not None:
        limit = positive_id(limit,'limit')
    elif offset:
        raise ValueError('offset requires limit')
    base = (PACKAGE/'query.sql').read_text().format(rotation_id=rotation,start_at=first,end_exclusive=after).strip()
    # All DISTINCT output fields complete the order, including anomalous differing
    # metadata for one notification, so a static relation has no pagination ties.
    order = ('ORDER BY esc_start_at_str DESC, esc_id DESC, channel_id, mainthreadts, '
             'esc_name, esc_status, rotation_name, slack_thread_url')
    query = f'{base}\n{order}'
    if limit is not None:
        query += f'\nLIMIT {limit} OFFSET {offset}'
    return dict(rotationId=rotation, interval=dict(start=start,end=end,timeZone='Asia/Bangkok',
                startInclusive=first,endExclusive=after),baseQuery=base,query=query+';',
                countQuery=f'SELECT COUNT(*) AS row_count, COUNT(DISTINCT esc_id) AS escalation_count\nFROM (\n{base}\n) selected_rows;')


def optional(value):
    return None if value is None or (isinstance(value,float) and math.isnan(value)) else value


def normalize(rotation, start, end, data):
    rotation, first, after = bounds(rotation,start,end)
    if not isinstance(data,dict) or data.get('complete') is not True:
        raise ValueError('require complete=true after inspecting every connector page')
    if data.get('error') or data.get('truncated') or data.get('nextCursor') or data.get('next_cursor'):
        raise ValueError('connector error, truncation or unconsumed cursor')
    rows = data.get('rows')
    if not isinstance(rows,list):
        raise ValueError('rows must be the complete array, not a preview')
    expected_rows=nonnegative(data.get('expectedRowCount'),'expectedRowCount')
    expected_esc=nonnegative(data.get('expectedEscalationCount'),'expectedEscalationCount')
    groups, seen, threads = {}, set(), {}
    for raw in rows:
        if not isinstance(raw,dict) or any(f not in raw for f in FIELDS):
            raise ValueError('each row must contain all supplied SQL columns')
        row={key:optional(raw[key]) for key in FIELDS}
        esc=positive_id(row['esc_id'],'esc_id');row['esc_id']=esc
        stamp=row['esc_start_at_str']
        if not isinstance(stamp,str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}',stamp):
            raise ValueError('invalid esc_start_at_str')
        dt.datetime.strptime(stamp,'%Y-%m-%d %H:%M:%S')
        if not first <= stamp < after:
            raise ValueError('source row outside requested start-time interval')
        if not isinstance(row['esc_name'],str) or not row['esc_name'].strip():
            raise ValueError('esc_name must be nonempty text')
        if isinstance(row['esc_status'],bool) or not isinstance(row['esc_status'],int):
            raise ValueError('esc_status must preserve the raw integer status')
        if row['rotation_name'] is not None and not isinstance(row['rotation_name'],str):
            raise ValueError('rotation_name must be text or null')
        channel, ts, url = (row[k] for k in ('channel_id','mainthreadts','slack_thread_url'))
        thread=None
        if channel is None and ts is None:
            if url is not None:
                raise ValueError('Slack URL without coordinates')
        else:
            if not isinstance(channel,str) or not re.fullmatch(r'[A-Z0-9]+',channel) or not isinstance(ts,str) or not re.fullmatch(r'\d{10,}\.\d{6}',ts):
                raise ValueError('malformed nonempty Slack coordinates; timestamps must stay strings')
            canonical=f'https://agoda.slack.com/archives/{channel}/p{ts.replace(".", "")}'
            if url != canonical:
                raise ValueError('Slack URL does not match exact source coordinates')
            thread=dict(channelId=channel,messageTs=ts,slackUrl=canonical)
        key=json.dumps(row,sort_keys=True,ensure_ascii=False,allow_nan=False)
        if key in seen:
            continue
        seen.add(key)
        group=groups.setdefault(esc,dict(escId=esc,documentId=f'oncall:{rotation}:{esc}',
                                sourceTags=['oncall',f'rotation-id:{rotation}'],sourceRows=[],threads=[]))
        group['sourceRows'].append(row)
        if thread and thread not in group['threads']:
            group['threads'].append(thread);threads[(channel,ts)]=thread
    if len(seen)!=expected_rows or len(groups)!=expected_esc:
        raise ValueError('retrieved distinct rows/escalations do not match count query; reread/reconcile')
    for group in groups.values():
        group['evidenceStatus']='threads-required' if group['threads'] else 'metadata-only'
        group['metadataConflicts']=[field for field in ('esc_name','esc_status','esc_start_at_str','rotation_name')
                                   if len({json.dumps(r[field]) for r in group['sourceRows']})>1]
    return dict(rotationId=rotation,interval=dict(start=start,end=end,timeZone='Asia/Bangkok',startInclusive=first,endExclusive=after),
                counts=dict(receivedRows=len(rows),distinctRows=len(seen),duplicateRows=len(rows)-len(seen),
                            escalations=len(groups),uniqueThreads=len(threads),metadataOnly=sum(not g['threads'] for g in groups.values())),
                escalations=[groups[k] for k in sorted(groups)],threads=[threads[k] for k in sorted(threads)])


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command',choices=['render','normalize'])
    parser.add_argument('--rotation-id',required=True)
    parser.add_argument('--start',required=True);parser.add_argument('--end',required=True)
    parser.add_argument('--limit',type=int);parser.add_argument('--offset',type=int,default=0)
    args=parser.parse_args()
    try:
        result=(render(args.rotation_id,args.start,args.end,args.limit,args.offset) if args.command=='render'
                else normalize(args.rotation_id,args.start,args.end,json.load(sys.stdin)))
    except (ValueError,TypeError,OverflowError,OSError) as error:
        print(f'BLOCKED: {error}',file=sys.stderr);return 2
    print(json.dumps(result,ensure_ascii=False,indent=2,allow_nan=False));return 0

if __name__=='__main__':raise SystemExit(main())
