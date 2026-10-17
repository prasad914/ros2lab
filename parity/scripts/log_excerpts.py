#!/usr/bin/env python3
"""Write tracked .txt excerpts of gitignored *.log evidence, so every file a report cites is in git.

Each excerpt is `<source line number>:<line>` (like grep -n) under a header naming the source file, the selection
and this command. Run it on one or more fixture directories; it walks them and writes, next to the source:
  *runner*.log                 -> same name .txt                 every line
  nav2.log | nav2demo.log      -> collision_monitor.txt          lines with [collision_monitor]
                               -> nav2_errors.txt                lines with [ERROR] or [FATAL]
  goal_*/result.json (+ ../logs/nav2.log, or ../logs/nav2demo.log for nav2_bringup)
                               -> goal_*/nav2_goal_lines.txt     [planner_server] [controller_server] [bt_navigator]
                                                                 lines stamped from send_wall - 1 s to result_wall + 3 s
Usage: log_excerpts.py <dir> [<dir> ...]
"""
import datetime
import json
import os
import re
import sys

STAMP = re.compile(r'\[(\d+\.\d+)\] \[(planner_server|controller_server|bt_navigator)[\]. ]')
CM = re.compile(r'\[collision_monitor\]')
ERR = re.compile(r'\[(ERROR|FATAL)\]')
NAV_LOGS = ('nav2.log', 'nav2demo.log')


def write(out, src, selection, lines):
    with open(out, 'w') as o:
        o.write(f'# Excerpt of {src} (gitignored)\n')
        o.write(f'# Selection: {selection}\n')
        o.write(f'# Generated {datetime.datetime.now().astimezone().isoformat(timespec="seconds")} by '
                f'parity/scripts/log_excerpts.py; format <source line>:<line>\n')
        for n, line in lines:
            o.write(f'{n}:{line}' if line.endswith('\n') else f'{n}:{line}\n')
    print(f'{out}: {len(lines)} lines')


def numbered(path):
    with open(path, errors='replace') as f:
        return list(enumerate(f, 1))


def main():
    for root in sys.argv[1:]:
        for d, _, files in os.walk(root):
            for name in files:
                p = os.path.join(d, name)
                if name.endswith('.log') and 'runner' in name:
                    write(p[:-4] + '.txt', p, 'every line', numbered(p))
                elif name in NAV_LOGS:
                    lines = numbered(p)
                    write(os.path.join(d, 'collision_monitor.txt'), p, 'lines matching [collision_monitor]',
                          [(n, l) for n, l in lines if CM.search(l)])
                    write(os.path.join(d, 'nav2_errors.txt'), p, 'lines matching [ERROR] or [FATAL]',
                          [(n, l) for n, l in lines if ERR.search(l)])
                elif name == 'result.json' and os.path.basename(d).startswith('goal_'):
                    r = json.load(open(p))
                    logs = [os.path.join(os.path.dirname(d), 'logs', n) for n in NAV_LOGS]
                    log = next((l for l in logs if os.path.exists(l)), None)
                    if 'send_wall' not in r or log is None:
                        continue
                    t0 = r['send_wall'] - 1.0
                    t1 = r.get('result_wall', r['send_wall'] + 200.0) + 3.0
                    sel = []
                    for n, l in numbered(log):
                        m = STAMP.search(l)
                        if m and t0 <= float(m.group(1)) <= t1:
                            sel.append((n, l))
                    write(os.path.join(d, 'nav2_goal_lines.txt'), log,
                          f'[planner_server] [controller_server] [bt_navigator] lines stamped wall {t0:.3f} .. {t1:.3f} '
                          f'(send_wall - 1 s .. result_wall + 3 s from {p})', sel)


if __name__ == '__main__':
    main()
