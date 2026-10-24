#!/usr/bin/env python3
"""Night 2, Part 1: TurtleBot3 motion, REAL Night 1 (gz-sim 8.10) vs REAL Night 2 (gz-sim 8.15.0 after the apt upgrade,
Fast DDS) vs the SITE (parity/compare/site_tb3_motion.mjs), with the rows and tolerances of tb3_motion_report.py.
The verdict is SITE against REAL Night 2 (the reference now); the "N1 -> N2" column says whether the real behaviour moved.
Usage: tb3_motion_report_n2.py <real_n1.json | TB3_MOTION_NIGHT1.md (its REAL column)> <real_n2.json> <site.json> <site_strip.json> [--out parity/reports/TB3_MOTION_NIGHT2.md]"""
import json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from tb3_motion_report import ROWS, S, val, fmt, verdict  # noqa: E402

a = [x for x in sys.argv[1:] if not x.startswith('--')]
out = sys.argv[sys.argv.index('--out') + 1] if '--out' in sys.argv else 'parity/reports/TB3_MOTION_NIGHT2.md'
if '--out' in sys.argv: a.remove(out)
def from_md(f):   # the REAL column of a tb3_motion_report.py table (TB3_MOTION_NIGHT1.md): {case: {key: {'mean': x}}}
    rows = {(c, w): k for c, k, w, _, _ in ROWS}; M = {}
    for l in open(f):
        c = [x.strip() for x in l.strip().strip('|').split('|')]
        if len(c) >= 3 and (c[0], c[1]) in rows:
            try: M.setdefault(c[0], {})[rows[(c[0], c[1])]] = {'mean': float(c[2].split()[0])}
            except ValueError: pass
    return M


N1 = from_md(a[0]) if a[0].endswith('.md') else S(json.load(open(a[0])))
N2, SI, SS = (S(json.load(open(f))) for f in a[1:4])
L = ['# TurtleBot3 motion: real Gazebo Night 1 vs Night 2 vs the site (Night 2, Part 1)', '',
     'REAL N1: the REAL column of `parity/reports/TB3_MOTION_NIGHT1.md` (Night 1 captures, gz-sim 8.10, Cyclone DDS). REAL N2:',
     '`parity/fixtures/tb3_jazzy_v3/physics/<case>/` re-captured on Night 2 after the owner\'s apt upgrade (gz-sim 8.15.0, gz-physics',
     'vendor 0.0.9, Fast DDS; `bash parity/scripts/tb3_v3/run_physics.sh`, 3 runs each, mean shown). SITE: `parity/compare/site_tb3_motion.mjs`',
     'on the site as committed (the TurtleBot3 motion model `public/js/tb3-motion.js` is unchanged since Night 1). All three are',
     'measured by `parity/compare/tb3_motion_fit.py`. Tolerances as in `tests/tb3-motion.test.mjs`. The verdict compares SITE',
     'with REAL N2; rows outside the tolerance are **APPROXIMATED** with the difference. "N1 -> N2" applies the same tolerance to',
     'the two real captures.', '',
     '| Case | Quantity | REAL N1 | REAL N2 | N1 -> N2 | SITE | tolerance | SITE vs REAL N2 |', '|---|---|---|---|---|---|---|---|']
cnt, moved = {}, 0
for c, k, what, ab, rl in ROWS:
    si = SS if c == 'tb3_push' else SI
    r1, r2, s = val(N1, c, k), val(N2, c, k), val(si, c, k)
    rr = N2.get(c, {}).get(k)
    r2s = 'n/a' if rr is None else (fmt(rr['mean']) + (f" [{rr['min']:.4f}..{rr['max']:.4f}]" if rr['min'] != rr['max'] else ''))
    ch = verdict(r1, r2, ab, rl).replace('MATCH', 'same').replace('DIFFERS', 'moved')
    moved += ch.startswith('moved')
    v = verdict(r2, s, ab, rl).replace('DIFFERS', 'APPROXIMATED')
    cnt[v.split(' ')[0]] = cnt.get(v.split(' ')[0], 0) + 1
    tol = f'±{ab}' + (f' + {int(rl * 100)} %' if rl else '') if ab else f'±{int(rl * 100)} %'
    L.append(f'| {c} | {what} | {fmt(r1)} | {r2s} | {ch} | {fmt(s)} | {tol} | {v} |')
L += ['', f'Totals (SITE vs REAL N2): ' + ', '.join(f'{k} {v}' for k, v in sorted(cnt.items())) + f'. Real rows that moved between Night 1 and Night 2: {moved} of {len(ROWS)}.', '',
      'tb3_push rows use the world\'s box without its PosePublisher plugin on the site side (`STRIP_POSEPUB=1`), as on Night 1.']
open(out, 'w').write('\n'.join(L) + '\n')
print('wrote', out, cnt, 'moved', moved)
