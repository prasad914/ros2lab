#!/usr/bin/env python3
"""Compare check_goals_on_map.py statuses with the /map that nav2_map_server publishes.

Usage: compare_goals_mapserver.py <goals.yaml> <map_echo.yaml> <goals_check.md>
  map_echo.yaml: output of `ros2 topic echo --once --full-length --qos-durability transient_local /map`
  goals_check.md: output of check_goals_on_map.py for the same map
Prints a Markdown table to stdout. The cell index is computed from the echoed message's own
info (resolution, origin, width, height): index = my * width + mx, mx = floor((x - origin.x) / resolution).
/map.data values: 100 -> OCCUPIED, 0 -> FREE, -1 -> UNKNOWN, anything else -> OTHER(<value>).
"""
import math
import sys

import yaml


def main():
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    goals_path, echo_path, check_path = sys.argv[1:]
    with open(goals_path) as f:
        goals = yaml.safe_load(f)
    with open(echo_path) as f:
        msg = next(d for d in yaml.safe_load_all(f) if d)   # echo ends with a '---' separator
    info, data = msg['info'], msg['data']
    res, width, height = float(info['resolution']), int(info['width']), int(info['height'])
    ox, oy = float(info['origin']['position']['x']), float(info['origin']['position']['y'])
    if len(data) != width * height:
        sys.exit(f'/map data has {len(data)} values, expected {width * height} (echo truncated?)')

    script = {}
    with open(check_path) as f:
        for line in f:
            cols = [c.strip() for c in line.strip().strip('|').split('|')]
            if len(cols) >= 7 and cols[0] not in ('pose', '---'):
                script[cols[0]] = cols[6]

    poses = []
    if 'start_pose' in goals:
        poses.append(('start_pose', goals['start_pose']))
    poses += list((goals.get('goals') or {}).items())
    if 'obstacle_goal' in goals:
        poses.append(('obstacle_goal', goals['obstacle_goal']))

    names = {100: 'OCCUPIED', 0: 'FREE', -1: 'UNKNOWN'}
    print(f'map_server /map: {width} x {height}, resolution {res}, origin [{ox}, {oy}], '
          f'frame_id {msg["header"]["frame_id"]}  ')
    print(f'script output: `{check_path}`')
    print()
    print('| pose | x | y | cell (mx, my) | index | /map.data | /map status | script status | agrees |')
    print('|---|---|---|---|---|---|---|---|---|')
    for name, g in poses:
        x, y = float(g['position']['x']), float(g['position']['y'])
        mx, my = math.floor((x - ox) / res), math.floor((y - oy) / res)
        if not (0 <= mx < width and 0 <= my < height):
            val, status, idx = '-', 'OUTSIDE_MAP', '-'
        else:
            idx = my * width + mx
            val = int(data[idx])
            status = names.get(val, f'OTHER({val})')
        s = script.get(name, '-')
        print(f'| {name} | {x:.3f} | {y:.3f} | ({mx}, {my}) | {idx} | {val} | {status} | {s} | '
              f'{"yes" if s == status else "no"} |')


if __name__ == '__main__':
    main()
