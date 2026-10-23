#!/usr/bin/env python3
"""Night 1, Part 2.E: classify every AUDIT_V2 Nav2 graph FAIL (fixture_parity nav_robotis: tb3_burger 56, tb3_waffle
49, tb3_waffle_pi 42) item by item.

Inputs
  FAIL rows  parity/browser_out/fixture_parity/<robot>/nav_robotis.json, written by parity/e2e/fixtures/nav_robotis.spec.ts
             in the Night-1 baseline run (docs/tb3/tests/before.txt): the AUDIT_V2 checks re-run on today's site. Each
             row has "expected" (the OLD fixture, parity/fixtures/<robot>/nav_robotis/) and "actual" (SITE-NOW).
  REAL-NEW   parity/fixtures/tb3_jazzy_v3/<robot>/nav_pose/after_pose/ (this PC, capture_nav.sh <robot> 61 pose).
Items: one per topic of the "topics + types" row (missing / extra on site), one per endpoint of a "QoS /topic" row
where OLD, REAL-NEW and SITE-NOW do not all agree. Endpoint key = lib.ts compareGraph: "KIND ns/node REL/DUR",
transform_listener_impl_<id>, launch_ros_<pid>, ros2cli tool nodes dropped.
Classes
  site-missing   REAL-NEW has it, SITE-NOW not (the old fixture agrees with REAL-NEW)
  site-extra     SITE-NOW has it, REAL-NEW not (the old fixture agrees with REAL-NEW)
  wrong type     the same node / topic is on both sides with another type or reliability / durability
  stale fixture  the OLD fixture and REAL-NEW disagree (the old FAIL came from the fixture or from the version change)
  fixed          REAL-NEW and SITE-NOW agree (cannot happen for a FAIL item unless the fixture was stale; kept for completeness)
Usage: tb3_graph_triage.py [--out parity/reports/TB3_GRAPH_TRIAGE.md]
"""
import collections, json, os, re, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
ROBOTS = ['tb3_burger', 'tb3_waffle', 'tb3_waffle_pi']
TOOL = re.compile(r'^_?ros2cli|^_NODE_NAME_UNKNOWN_|^rosbag2_recorder|^ros2lab_night1_probe')
KEYS = ['site-missing', 'site-extra', 'wrong type', 'stale fixture', 'fixed']


def p(*a): return os.path.join(ROOT, *a)


def role(n): return re.sub(r'^transform_listener_impl_[0-9a-f]+$', 'transform_listener_impl_<id>', re.sub(r'^launch_ros_\d+$', 'launch_ros_<pid>', n))


def topic_list(f):
    d = {}
    if os.path.exists(f):
        for l in open(f):
            m = re.match(r'^(/\S*) \[(.+)\]$', l.rstrip('\n'))
            if m: d[m.group(1)] = m.group(2)
    return d


def info(f):
    """`ros2 topic info -v` file -> (type, {endpoint keys}) ; None if missing / unknown topic"""
    if not os.path.exists(f): return None
    t = open(f).read()
    if 'Unknown topic' in t: return None
    ty = (re.search(r'^Type: (.+)$', t, re.M) or [0, ''])[1]
    eps = set()
    for blk in re.split(r'\n(?=Node name: )', t)[1:]:
        g = lambda r: (re.search(r, blk, re.M) or [0, ''])[1]
        ns = g(r'^Node namespace: (.+)$').strip('/')
        node = (ns + '/' if ns else '') + g(r'^Node name: (.+)$')
        if TOOL.match(node.lstrip('/')): continue
        eps.add(f"{g(r'^Endpoint type: (.+)$')} {role(node)} {g(r'^\s+Reliability: (.+)$')}/{g(r'^\s+Durability: (.+)$')}")
    return ty, eps


def node_of(e): return ' '.join(e.split()[:2])


def main():
    out = sys.argv[sys.argv.index('--out') + 1] if '--out' in sys.argv else p('parity/reports/TB3_GRAPH_TRIAGE.md')
    rows, tot, per = [], collections.Counter(), {}
    fam = collections.defaultdict(collections.Counter)
    for robot in ROBOTS:
        J = json.load(open(p('parity/browser_out/fixture_parity', robot, 'nav_robotis.json')))
        fails = [r for r in J['rows'] if r['status'] == 'FAIL']
        base = p('parity/fixtures/tb3_jazzy_v3', robot, 'nav_pose', 'after_pose')
        real = topic_list(os.path.join(base, 'topic_list_t.txt'))
        cnt = collections.Counter()
        def add(item, c, ev, family):
            rows.append((robot, item, c, ev)); cnt[c] += 1; fam[family][c] += 1
        for f in fails:
            if f['item'] == 'topics + types':
                old = topic_list(p(f['fixture']))
                note = f.get('note', '')
                miss = re.findall(r'(/[^\s,\[]+) \[([^\]]+)\]', note.split('; extra on site:')[0])
                extra = re.findall(r'(/[^\s,\[]+) \[([^\]]+)\]', note.split('; extra on site:')[1]) if '; extra on site:' in note else []
                site = {t: ty for t, ty in old.items() if (t, ty) not in miss}
                site.update({t: ty for t, ty in extra})
                for t, ty in miss + extra:
                    o, r_, s = old.get(t), real.get(t), site.get(t)
                    if o != r_: c = 'stale fixture'
                    elif r_ and not s: c = 'site-missing'
                    elif s and not r_: c = 'site-extra'
                    elif r_ != s: c = 'wrong type'
                    else: c = 'fixed'
                    add(f'topic {t}', c, f'old fixture: {o or "absent"}; real-new: {r_ or "absent"}; site-now: {s or "absent"}', family(t))
                continue
            m = re.match(r'QoS (/\S+)$', f['item'])
            if not m:
                add(f['item'], 'not a graph item', f"expected {f['expected']} / actual {f['actual']}", 'other'); continue
            t = m.group(1)
            O, S = set(f['expected'] or []), set(f['actual'] or [])
            ri = info(os.path.join(base, 'qos', t.lstrip('/').replace('/', '__') + '.txt'))
            R = ri[1] if ri else set()
            items = sorted((O ^ R) | (R ^ S) | (O ^ S))
            for e in items:
                if (e in O) != (e in R): c = 'stale fixture'
                elif e in R and e not in S: c = 'wrong type' if any(node_of(x) == node_of(e) for x in S) else 'site-missing'
                elif e not in R and e in S: c = 'wrong type' if any(node_of(x) == node_of(e) for x in R) else 'site-extra'
                else: c = 'fixed'
                h = lambda X: 'yes' if e in X else 'no'
                add(f'QoS {t}: {e}', c, f"old fixture: {h(O)}; real-new: {h(R) if ri else 'topic absent'}; site-now: {h(S)}", family(t, e))
        per[robot] = (len(fails), cnt)
        tot.update(cnt)
    L = ['# TurtleBot3 Nav2 graph triage (Night 1, Part 2.E)', '',
         'Generated by `python3 parity/compare/tb3_graph_triage.py` on ' + __import__('datetime').date.today().isoformat() + '.', '',
         'The AUDIT_V2 Nav2 graph FAILs are the `nav_robotis` rows of `parity/reports/fixture_parity.md` (tb3_burger 56,',
         'tb3_waffle 49, tb3_waffle_pi 42). The Night-1 baseline run of `parity/e2e/fixtures/nav_robotis.spec.ts` re-ran them on',
         "today's site with the same result (56 / 49 / 42 FAIL, `parity/browser_out/fixture_parity/<robot>/nav_robotis.json`,",
         'gitignored); its "expected" side is the OLD fixture and its "actual" side is SITE-NOW. REAL-NEW is a fresh real capture',
         'on this PC of the same graph moment (both lifecycle managers active after the initial pose):',
         '`parity/fixtures/tb3_jazzy_v3/<robot>/nav_pose/after_pose/` (topic list and `ros2 topic info -v` of every topic).', '',
         'Each FAIL row is split into items: one per topic of the "topics + types" row, and one per endpoint of a "QoS /topic"',
         'row where OLD, REAL-NEW and SITE-NOW do not all agree. Endpoints are written like the spec writes them',
         '("KIND namespace/node RELIABILITY/DURABILITY").', '',
         'The old fixtures were captured with Nav2 1.3.13, ros_gz 1.0.24 and gz-sim 8.15; REAL-NEW with Nav2 1.3.10 (nav2_bringup,',
         'nav2_route and opennav_docking 1.3.13), ros_gz 1.0.16/18 and gz-sim 8.10 (`parity/fixtures/tb3_jazzy_v3/README.md`). A',
         '"stale fixture" item may therefore be a version difference; the evidence column shows what each capture has.', '',
         '## Summary', '', '| Robot | FAIL rows | items | ' + ' | '.join(KEYS) + ' | other |', '|---|---|---|' + '---|' * (len(KEYS) + 1)]
    for r, (n, c) in per.items():
        L.append(f"| {r} | {n} | {sum(c.values())} | " + ' | '.join(str(c[k]) for k in KEYS) + f" | {sum(v for k, v in c.items() if k not in KEYS)} |")
    L.append(f"| **all** | {sum(v[0] for v in per.values())} | {sum(tot.values())} | " + ' | '.join(str(tot[k]) for k in KEYS) + f" | {sum(v for k, v in tot.items() if k not in KEYS)} |")
    L += ['', '## By family (all three robots)', '', '| Family | ' + ' | '.join(KEYS) + ' |', '|---|' + '---|' * len(KEYS)]
    for fm in sorted(fam, key=lambda x: -sum(fam[x].values())):
        L.append(f'| {fm} | ' + ' | '.join(str(fam[fm][k]) for k in KEYS) + ' |')
    for cls in KEYS + sorted(k for k in tot if k not in KEYS):
        sel = [x for x in rows if x[2] == cls]
        if not sel: continue
        L += ['', f'## {cls} ({len(sel)})', '', '| Robot | Item | Evidence |', '|---|---|---|']
        L += [f'| {r} | {it.replace("|", "/")} | {ev.replace("|", "/")} |' for r, it, c, ev in sel]
    open(out, 'w').write('\n'.join(L) + '\n')
    print(f'wrote {out}: ' + ', '.join(f'{k} {v}' for k, v in tot.most_common()))


def family(topic, ep=''):
    n = ep.split()[1] if ep else ''
    if re.search(r'_layer|voxel_grid|clearing_endpoints', topic): return 'costmap layer topics'
    if re.search(r'dock|battery', topic) or 'docking_server' in n: return 'docking_server'
    if re.search(r'route|/graph', topic) or 'route_server' in n: return 'route_server'
    if 'rclcpp_node' in n: return 'bt_navigator *_rclcpp_node'
    if 'transform_listener_impl' in n: return 'tf2 listener nodes'
    if re.search(r'selector', topic) or 'rviz' in n: return 'RViz Nav2 panel / rviz2'
    if topic == '/diagnostics': return '/diagnostics'
    if re.search(r'cmd_vel', topic): return 'cmd_vel chain'
    if 'collision' in topic: return 'collision_monitor'
    return 'other topics / endpoints'


if __name__ == '__main__':
    main()
