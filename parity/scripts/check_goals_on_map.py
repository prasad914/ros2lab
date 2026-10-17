#!/usr/bin/env python3
"""Check every pose in a goals file against a saved map (map_saver_cli .yaml + .pgm).

Usage: check_goals_on_map.py <goals.yaml> <map.yaml>
Prints a Markdown table to stdout. The goals file is only read, never changed.

Cell classification (trinary mode only):
  occ = (255 - pixel) / 255 (or pixel / 255 when negate: 1)
  occ > occupied_thresh -> OCCUPIED, occ < free_thresh -> FREE, else UNKNOWN.
World -> cell: mx = floor((x - origin_x) / resolution), same for y;
PGM rows run top to bottom, so pgm_row = height - 1 - my.
These rules are not checked against nav2 source (not installed on this machine);
compare with the /map that nav2_map_server publishes for the same map.
The nearest-occupied column is the distance in metres between the goal's cell centre
and the nearest OCCUPIED cell centre (cell distance * resolution).
"""
import math
import os
import sys

import yaml


def read_pgm(path):
    with open(path, 'rb') as f:
        data = f.read()
    tokens, pos = [], 0
    while len(tokens) < 4:                      # magic, width, height, maxval
        while data[pos:pos + 1].isspace():
            pos += 1
        if data[pos:pos + 1] == b'#':           # comment line
            pos = data.index(b'\n', pos) + 1
            continue
        start = pos
        while not data[pos:pos + 1].isspace():
            pos += 1
        tokens.append(data[start:pos])
    pos += 1                                    # single whitespace before the raster
    if tokens[0] != b'P5':
        sys.exit(f'{path}: only binary PGM (P5) is supported, got {tokens[0]!r}')
    width, height, maxval = int(tokens[1]), int(tokens[2]), int(tokens[3])
    if maxval > 255:
        sys.exit(f'{path}: 16-bit PGM not supported')
    raster = data[pos:pos + width * height]
    if len(raster) != width * height:
        sys.exit(f'{path}: raster has {len(raster)} bytes, expected {width * height}')
    return width, height, raster


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    goals_path, map_path = sys.argv[1], sys.argv[2]
    with open(map_path) as f:
        m = yaml.safe_load(f)
    with open(goals_path) as f:
        goals = yaml.safe_load(f)

    pgm_path = os.path.join(os.path.dirname(map_path), m['image'])
    width, height, raster = read_pgm(pgm_path)
    res = float(m['resolution'])
    ox, oy, oyaw = (float(v) for v in m['origin'])
    negate = int(m.get('negate', 0))
    occ_t, free_t = float(m['occupied_thresh']), float(m['free_thresh'])
    if m.get('mode', 'trinary') != 'trinary':
        sys.exit(f"mode {m.get('mode')} not supported (only trinary)")
    if oyaw != 0.0:
        sys.exit(f'origin yaw {oyaw} != 0 is not supported')

    def classify(px):
        occ = px / 255.0 if negate else (255 - px) / 255.0
        if occ > occ_t:
            return 'OCCUPIED'
        if occ < free_t:
            return 'FREE'
        return 'UNKNOWN'

    occupied = [(c, height - 1 - r) for r in range(height) for c in range(width)
                if classify(raster[r * width + c]) == 'OCCUPIED']

    poses = []
    if 'start_pose' in goals:
        poses.append(('start_pose', goals['start_pose']))
    for name, g in (goals.get('goals') or {}).items():
        poses.append((name, g))
    if 'obstacle_goal' in goals:
        poses.append(('obstacle_goal', goals['obstacle_goal']))

    print(f'goals: `{goals_path}`  ')
    print(f'map: `{map_path}` (image `{m["image"]}`, {width} x {height} px, resolution {res}, '
          f'origin [{ox}, {oy}, {oyaw}], negate {negate}, occupied_thresh {occ_t}, free_thresh {free_t})')
    print(f'occupied cells: {len(occupied)}')
    print()
    print('| pose | x | y | cell (mx, my) | pgm (col, row) | pixel | status | status in goals file | match | nearest occupied cell (metres) |')
    print('|---|---|---|---|---|---|---|---|---|---|')
    for name, g in poses:
        x, y = float(g['position']['x']), float(g['position']['y'])
        mx, my = math.floor((x - ox) / res), math.floor((y - oy) / res)
        expected = g.get('status', '-')
        if not (0 <= mx < width and 0 <= my < height):
            print(f'| {name} | {x:.3f} | {y:.3f} | ({mx}, {my}) | - | - | OUTSIDE_MAP | {expected} | '
                  f'{"yes" if expected == "OUTSIDE_MAP" else "NO"} | - |')
            continue
        row = height - 1 - my
        px = raster[row * width + mx]
        status = classify(px)
        dist = min((math.hypot(mx - c, my - r) * res for c, r in occupied), default=float('nan'))
        print(f'| {name} | {x:.3f} | {y:.3f} | ({mx}, {my}) | ({mx}, {row}) | {px} | {status} | {expected} | '
              f'{"yes" if status == expected else "NO"} | {dist:.3f} |')


if __name__ == '__main__':
    main()
