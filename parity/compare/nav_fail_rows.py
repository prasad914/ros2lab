#!/usr/bin/env python3
"""Night 2: print the FAIL rows of a nav_robotis.json (parity/e2e/fixtures/nav_robotis.spec.ts) as
item | missing on site | extra on site, and the FAIL count.
Usage: nav_fail_rows.py [<fixture_parity dir>] [robot ...]   (default dir parity/browser_out/fixture_parity)"""
import json, os, sys
args = sys.argv[1:]
d = args.pop(0) if args and os.path.isdir(args[0]) else 'parity/browser_out/fixture_parity'
for robot in args or ['tb3_burger', 'tb3_waffle', 'tb3_waffle_pi']:
    f = os.path.join(d, robot, 'nav_robotis.json')
    if not os.path.exists(f): print(f'{robot}: no {f}'); continue
    rows = json.load(open(f)); rows = rows if isinstance(rows, list) else rows.get('rows', [])
    fails = [r for r in rows if r.get('status') == 'FAIL']
    print(f'== {robot}: {len(fails)} FAIL of {len(rows)} rows')
    for r in fails:
        e, a = r.get('expected'), r.get('actual')
        if isinstance(e, list) or isinstance(a, list):
            se, sa = set(e or []), set(a or [])
            print(f"{r['item']} | missing: {sorted(se - sa)} | extra: {sorted(sa - se)}")
        else: print(f"{r['item']} | expected {str(e)[:200]} | actual {str(a)[:200]}")
