#!/usr/bin/env python3
"""Validate every question file and rebuild data/events.json counts.

Run this after editing anything in data/q/:
    python3 tools/build_index.py

It checks each question has a stem, 2-5 unique options, a valid answer index,
a valid topic index and a unique id, then rewrites the counts in data/events.json.
Exit code is 1 if any problem is found (the GitHub Action uses this).
"""
import json, os, sys, collections, datetime

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data')
cat_path = os.path.join(ROOT, 'events.json')
cat = json.load(open(cat_path, encoding='utf-8'))
problems = []
total = 0
for ev in cat['events']:
    path = os.path.join(ROOT, 'q', ev['id'] + '.json')
    if not os.path.exists(path):
        problems.append(f"{ev['id']}: missing file data/q/{ev['id']}.json")
        continue
    d = json.load(open(path, encoding='utf-8'))
    topics = d['topics']
    seen = set()
    for i, q in enumerate(d['questions']):
        where = f"{ev['id']} #{i} ({q.get('id', '?')})"
        if not q.get('q', '').strip():
            problems.append(f'{where}: empty question text')
        o = q.get('o', [])
        if not (2 <= len(o) <= 5):
            problems.append(f'{where}: needs 2-5 options, has {len(o)}')
        if len(set(x.strip().lower() for x in o)) != len(o):
            problems.append(f'{where}: duplicate options')
        if not isinstance(q.get('a'), int) or not (0 <= q['a'] < len(o)):
            problems.append(f'{where}: answer index out of range')
        if not isinstance(q.get('t'), int) or not (0 <= q['t'] < len(topics)):
            problems.append(f'{where}: topic index out of range')
        if q.get('id') in seen:
            problems.append(f'{where}: duplicate id')
        seen.add(q.get('id'))
        if q.get('k') not in ('o', 'p'):
            problems.append(f"{where}: k must be 'o' (past test) or 'p' (practice)")
    tcount = collections.Counter(q['t'] for q in d['questions'])
    # keep official item weights already in the catalog
    old = {t['name']: t.get('items', 0) for t in ev.get('topics', [])}
    ev['topics'] = [dict(name=n, items=old.get(n, 0), count=tcount.get(j, 0)) for j, n in enumerate(topics)]
    ev['count'] = len(d['questions'])
    ev['past'] = sum(1 for q in d['questions'] if q.get('k') == 'o')
    ev['practice'] = sum(1 for q in d['questions'] if q.get('k') == 'p')
    total += ev['count']

cat['updated'] = datetime.date.today().isoformat()
json.dump(cat, open(cat_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f'{len(cat["events"])} events, {total} questions')
if problems:
    print(f'{len(problems)} problem(s):')
    for p in problems[:200]:
        print('  -', p)
    sys.exit(1)
print('All question files are valid.')
