#!/usr/bin/env python3
"""Time the Nav2 bringup wait without an initial pose, from a capture_nav.sh nopose run.
Usage: nopose_timing.py <fixture dir nav_nopose> <raw dir with logs/nav2.log>   -> writes <fixture>/timing.txt
Wall times are the log stamps ([INFO] [<epoch>]); sim times come from clock.csv (wall epoch -> /clock), linear between samples."""
import bisect, csv, re, sys
fx, raw = sys.argv[1], sys.argv[2]
rows = [(float(w), float(s)) for w, s in list(csv.reader(open(f'{fx}/clock.csv')))[1:]]
W = [r[0] for r in rows]
def sim(t):
    i = bisect.bisect_left(W, t)
    if i <= 0: return None if not rows or t < W[0] - 1 else rows[0][1]
    if i >= len(rows): return None
    (w0, s0), (w1, s1) = rows[i - 1], rows[i]
    return s0 + (s1 - s0) * (t - w0) / (w1 - w0)
pat = {
    'lm_nav_first_configuring': r'\[lifecycle_manager_navigation\]: .*Configuring',
    'global_costmap_checking_transform': r'\[global_costmap\.global_costmap\]: Checking transform',
    'first_timed_out_waiting_for_transform': r'Timed out waiting for transform',
    'failed_to_activate': r'Failed to activate global_costmap',
    'aborting_bringup': r'\[lifecycle_manager_navigation\]: Failed to bring up all requested nodes\. Aborting bringup\.',
    'lm_nav_active': r'\[lifecycle_manager_navigation\]: .*Managed nodes are active',
}
found = {}
for line in open(f'{raw}/logs/nav2.log', errors='replace'):
    m = re.search(r'\] \[(INFO|WARN|ERROR|FATAL)\] \[(\d+\.\d+)\]', line)
    if not m: continue
    for k, p in pat.items():
        if k not in found and re.search(p, line):
            found[k] = (float(m.group(2)), line.strip()[:300])
out = []
for k in pat:
    if k in found:
        t, l = found[k]; s = sim(t)
        out.append(f'{k}: wall_epoch={t:.3f} sim={"%.3f" % s if s is not None else "n/a (outside clock.csv)"}\n    {l}')
    else:
        out.append(f'{k}: not in log')
a, b = found.get('global_costmap_checking_transform'), found.get('aborting_bringup')
if a and b:
    sa, sb = sim(a[0]), sim(b[0])
    out.append(f'WAIT checking transform -> aborting bringup: wall {b[0]-a[0]:.3f} s, sim {sb-sa:.3f} s' if sa is not None and sb is not None else f'WAIT wall {b[0]-a[0]:.3f} s (sim n/a)')
open(f'{fx}/timing.txt', 'w').write('\n'.join(out) + '\n')
print('\n'.join(out))
