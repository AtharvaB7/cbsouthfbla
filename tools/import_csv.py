#!/usr/bin/env python3
"""Add questions from a CSV file (for example, exported from a Google Sheet).

    python3 tools/import_csv.py new_questions.csv

CSV columns (header row required):
    event, topic, question, A, B, C, D, E, answer, explanation, source

- event:  the event id, e.g. accounting, cybersecurity, data-science-ai
          (the file names in data/q/ without .json)
- topic:  a topic name exactly as shown on the site (leave blank for "General / mixed")
- A-E:    answer choices (E optional; leave blank if unused)
- answer: the letter of the correct choice (A, B, C, D or E)
- explanation, source: optional. Source defaults to "CB South practice set".
- Add a column named kind with the value "past" if the question came from a
  real past FBLA test; otherwise it is labeled as a practice question.

Questions already in the bank (same event and same wording) are skipped.
Run tools/build_index.py afterwards (this script does it for you).
"""
import csv, json, os, sys, hashlib, subprocess

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', 'q')
if len(sys.argv) != 2:
    sys.exit(__doc__)
added, skipped, errors = 0, 0, []
files = {}
with open(sys.argv[1], newline='', encoding='utf-8-sig') as f:
    for n, row in enumerate(csv.DictReader(f), start=2):
        row = {k.strip().lower(): (v or '').strip() for k, v in row.items() if k}
        ev = row.get('event', '')
        path = os.path.join(ROOT, ev + '.json')
        if not os.path.exists(path):
            errors.append(f'line {n}: unknown event "{ev}"'); continue
        if ev not in files:
            files[ev] = json.load(open(path, encoding='utf-8'))
        d = files[ev]
        opts = [row.get(x, '') for x in 'abcde' if row.get(x, '')]
        letter = row.get('answer', '').upper()[:1]
        if len(opts) < 2 or letter not in 'ABCDE' or 'ABCDE'.index(letter) >= len(opts):
            errors.append(f'line {n}: needs at least 2 choices and an answer letter that matches one'); continue
        q = row.get('question', '')
        if not q:
            errors.append(f'line {n}: empty question'); continue
        topic = row.get('topic', '')
        if topic in d['topics']:
            t = d['topics'].index(topic)
        else:
            if 'General / mixed' not in d['topics']:
                d['topics'].append('General / mixed')
            t = d['topics'].index('General / mixed')
            if topic:
                errors.append(f'line {n}: topic "{topic}" not found, filed under General / mixed')
        key = q.lower().strip()
        if any(x['q'].lower().strip() == key for x in d['questions']):
            skipped += 1; continue
        qid = hashlib.sha1((ev + '|' + q + '|' + '|'.join(opts)).encode()).hexdigest()[:8]
        rec = dict(id=qid, t=t, q=q, o=opts, a='ABCDE'.index(letter))
        if row.get('explanation'):
            rec['x'] = row['explanation']
        rec['s'] = row.get('source') or 'CB South practice set'
        rec['k'] = 'o' if row.get('kind', '').lower() == 'past' else 'p'
        d['questions'].append(rec)
        added += 1
for ev, d in files.items():
    json.dump(d, open(os.path.join(ROOT, ev + '.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(f'added {added}, skipped {skipped} duplicates')
for e in errors:
    print('  -', e)
subprocess.call([sys.executable, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'build_index.py')])
