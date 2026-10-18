#!/usr/bin/env python3
"""
pick_goals.py - Pick navigation goals on a robot's map, deterministically, and write a goals.yaml in the format of
parity/fixtures/goals.yaml (start_pose + goal1..goalN). Checked afterwards by check_goals_on_map.py and against the
/map that nav2_map_server publishes (compare_goals_mapserver.py) - this script only proposes.

A candidate is a FREE cell (trinary rules of check_goals_on_map.py) that is
  - reachable from the start cell through FREE cells (4-connected flood fill),
  - at least --clearance m from every OCCUPIED or UNKNOWN cell,
  - at least --spacing m from the start and from every goal already picked,
  - within --max-dist m of the start (straight line).
Candidates are scanned on a --step m grid in row-major order from the map origin; among them the goals are picked
greedily by largest distance to the start and the goals so far (farthest-point order), so the result depends only on
the map and the arguments. Yaw of every goal is 0.
Usage: pick_goals.py <map.yaml> <out_goals.yaml> --start-x 0 --start-y 0 [--n 5] [--clearance 0.6] [--spacing 1.5]
                     [--max-dist 8] [--step 0.25]
"""
import argparse
import math
from collections import deque

import yaml

from check_goals_on_map import read_pgm  # same PGM reader as the checker


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('map_yaml')
    ap.add_argument('out')
    ap.add_argument('--start-x', type=float, required=True)
    ap.add_argument('--start-y', type=float, required=True)
    ap.add_argument('--n', type=int, default=5)
    ap.add_argument('--clearance', type=float, default=0.6)
    ap.add_argument('--spacing', type=float, default=1.5)
    ap.add_argument('--max-dist', type=float, default=8.0)
    ap.add_argument('--step', type=float, default=0.25)
    a = ap.parse_args()
    import os
    m = yaml.safe_load(open(a.map_yaml))
    img = m['image'] if os.path.isabs(m['image']) else os.path.join(os.path.dirname(a.map_yaml), m['image'])
    w, h, px = read_pgm(img)   # 8-bit P5, as check_goals_on_map.py reads it
    res, ox, oy = float(m['resolution']), float(m['origin'][0]), float(m['origin'][1])
    neg, occ_t, free_t = int(m.get('negate', 0)), float(m['occupied_thresh']), float(m['free_thresh'])

    def cls(mx, my):
        p = px[(h - 1 - my) * w + mx]
        occ = p / 255.0 if neg else (255 - p) / 255.0
        return 'O' if occ > occ_t else 'F' if occ < free_t else 'U'
    grid = [[cls(x, y) for x in range(w)] for y in range(h)]
    cell = lambda x, y: (int(math.floor((x - ox) / res)), int(math.floor((y - oy) / res)))
    sx, sy = cell(a.start_x, a.start_y)
    if grid[sy][sx] != 'F':
        raise SystemExit(f'start ({a.start_x}, {a.start_y}) is not FREE on the map: {grid[sy][sx]}')
    reach = [[False] * w for _ in range(h)]
    q = deque([(sx, sy)]); reach[sy][sx] = True
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            u, v = x + dx, y + dy
            if 0 <= u < w and 0 <= v < h and not reach[v][u] and grid[v][u] == 'F':
                reach[v][u] = True; q.append((u, v))
    r = int(math.ceil(a.clearance / res))
    # clearance by a distance transform would be faster; a window check on the sampled candidates is enough here
    def clear(x, y):
        for v in range(max(0, y - r), min(h, y + r + 1)):
            for u in range(max(0, x - r), min(w, x + r + 1)):
                if grid[v][u] != 'F' and math.hypot(u - x, v - y) * res < a.clearance:
                    return False
        return True
    cands = []
    k = max(1, int(round(a.step / res)))
    for y in range(0, h, k):
        for x in range(0, w, k):
            if not reach[y][x]:
                continue
            wx, wy = ox + (x + 0.5) * res, oy + (y + 0.5) * res
            if math.hypot(wx - a.start_x, wy - a.start_y) > a.max_dist:
                continue
            if clear(x, y):
                cands.append((round(wx, 3), round(wy, 3)))
    picked = []
    for _ in range(a.n):
        best, bd = None, -1
        for c in cands:
            d = min([math.hypot(c[0] - a.start_x, c[1] - a.start_y)] + [math.hypot(c[0] - p[0], c[1] - p[1]) for p in picked])
            if d >= a.spacing and d > bd:
                best, bd = c, d
        if best is None:
            break
        picked.append(best)
    out = {'map': {'yaml': a.map_yaml, 'resolution': res, 'origin': m['origin'], 'width': w, 'height': h},
           'picked_by': f'parity/scripts/pick_goals.py --start-x {a.start_x} --start-y {a.start_y} --n {a.n} '
                        f'--clearance {a.clearance} --spacing {a.spacing} --max-dist {a.max_dist} --step {a.step}',
           'candidates': len(cands),
           'start_pose': {'frame_id': 'map', 'position': {'x': a.start_x, 'y': a.start_y, 'z': 0.0},
                          'orientation': {'x': 0.0, 'y': 0.0, 'z': 0.0, 'w': 1.0}, 'yaw': 0.0, 'status': 'FREE',
                          'covariance': [0.25, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.25, 0.0, 0.0, 0.0, 0.0] + [0.0] * 23 + [0.06853891909122467]},
           'goals': {f'goal{i + 1}': {'description': f'picked: clearance >= {a.clearance} m, reachable from start', 'frame_id': 'map',
                                      'position': {'x': p[0], 'y': p[1], 'z': 0.0},
                                      'orientation': {'x': 0.0, 'y': 0.0, 'z': 0.0, 'w': 1.0}, 'yaw': 0.0, 'status': 'FREE'}
                     for i, p in enumerate(picked)}}
    with open(a.out, 'w') as f:
        yaml.safe_dump(out, f, sort_keys=False)
    print(f'{len(cands)} candidates; picked {len(picked)}: {picked}')


if __name__ == '__main__':
    main()
