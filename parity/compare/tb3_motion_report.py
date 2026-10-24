#!/usr/bin/env python3
"""Night 1, Part 3.3: TurtleBot3 motion, REAL vs SITE before / after the dynamic model, one table.
Reads tb3_motion_fit.py JSON for REAL (parity/fixtures/tb3_jazzy_v3/physics), SITE-BEFORE and SITE-AFTER
(parity/compare/site_tb3_motion.mjs on the two checkouts). Writes parity/reports/TB3_MOTION_NIGHT1.md.
Usage: tb3_motion_report.py <real.json> <before.json> <after.json> [<before_strip.json> <after_strip.json>]"""
import json, sys

S = lambda L: {r['case']: r['summary'] for r in L}
# (case, key, what, abs tol, rel tol) -- the same limits as tests/tb3-motion.test.mjs; times: one page frame (0.05 s)
ROWS = [
    ('tb3_lin', 'gt_v_t50', 'ground truth 50 % of 0.2 m/s (s after the command)', 0.05, 0), ('tb3_lin', 'gt_v_t90', 'ground truth 90 % (s)', 0.1, 0),
    ('tb3_lin', 'odom_v_t90', 'odom vx 90 % (s)', 0.05, 0), ('tb3_lin', 'pos_error', 'odom - ground truth after 10 s (m)', 0.01, 0),
    ('tb3_lin', 'gt_v_final', 'final ground-truth speed (m/s)', 0.005, 0),
    ('tb3_ang', 'gt_w_t50', 'ground truth 50 % of 1 rad/s (s)', 0.1, 0), ('tb3_ang', 'gt_w_t90', 'ground truth 90 % (s)', 0.15, 0),
    ('tb3_ang', 'yaw_error', 'odom yaw - ground-truth yaw after 10 s (rad)', 0.1, 0), ('tb3_ang', 'pos_error', 'position drift during the spin (m)', 0.02, 0),
    ('tb3_stop', 'gt_stop_dist', 'ground truth travels after the stop command (m)', 0.01, 0), ('tb3_stop', 'odom_stop_dist', 'odom travels after the stop command (m)', 0.01, 0),
    ('tb3_fast', 'gt_v_final', '0.5 m/s command: final speed (no clamp in Gazebo) (m/s)', 0.01, 0), ('tb3_fast', 'gt_v_t90', '0.5 m/s: ground truth 90 % (s)', 0.1, 0),
    ('tb3_fast', 'pos_error', '0.5 m/s: odom - ground truth (m)', 0.01, 0),
    ('tb3_spin_fast', 'gt_w_final', '4 rad/s command: final yaw rate (rad/s)', 0.05, 0), ('tb3_spin_fast', 'gt_w_t90', '4 rad/s: ground truth 90 % (s)', 0.15, 0),
    ('tb3_spin_fast', 'yaw_error', '4 rad/s: odom - ground truth yaw after 5 s (rad)', 0.1, 0.05),
    ('tb3_wall', 'gt_x_end', 'wall 1.0 m ahead of the lidar: base_footprint x at rest (m)', 0.02, 0), ('tb3_wall', 'odom_x_end', 'odom x after 10 s (wheels keep turning) (m)', 0.05, 0.05),
    ('tb3_wall', 'wheel_odom_v_final', 'odom vx while pushing the wall (m/s)', 0.01, 0),
    ('tb3_push', 'box_disp', 'light box (0.1 kg) displacement (m)', 0, 0.05), ('tb3_push', 'box_first_move', 'box first moves (sim s)', 0.05, 0),
    ('tb3_push', 'gt_dist', 'robot ground-truth distance while pushing (m)', 0, 0.02),
    ('tb3wp_lin', 'gt_v_t50', 'Waffle Pi: ground truth 50 % of 0.2 m/s (s)', 0.05, 0), ('tb3wp_lin', 'gt_v_t90', 'Waffle Pi: 90 % (s)', 0.1, 0),
    ('tb3wp_lin', 'pos_error', 'Waffle Pi: odom - ground truth (m)', 0.01, 0),
    ('tb3wp_ang', 'gt_w_t50', 'Waffle Pi: 50 % of 1 rad/s (s)', 0.1, 0), ('tb3wp_ang', 'gt_w_t90', 'Waffle Pi: 90 % (s)', 0.15, 0),
    ('tb3wp_ang', 'yaw_error', 'Waffle Pi: odom - ground-truth yaw after 10 s (rad)', 0.1, 0),
    ('tb3wp_stop', 'gt_stop_dist', 'Waffle Pi: ground truth after the stop (m)', 0.01, 0),
]


def val(M, c, k):
    v = M.get(c, {}).get(k)
    return v['mean'] if isinstance(v, dict) and 'mean' in v else None


def fmt(x): return 'n/a' if x is None else f'{x:.4f}'


def verdict(r, s, ab, rl):
    if r is None or s is None: return 'n/a'
    d = s - r
    return 'MATCH' if abs(d) <= ab + rl * abs(r) else f'DIFFERS ({d:+.4f})'


def main():
    real, before, after = (json.load(open(f)) for f in sys.argv[1:4])
    strip = [json.load(open(f)) for f in sys.argv[4:6]] if len(sys.argv) > 5 else [[], []]
    R, B, A = S(real), S(before), S(after)
    SB, SA = S(strip[0]), S(strip[1])
    L = ['# TurtleBot3 motion: real Gazebo vs the site, before and after the dynamic model (Night 1, Part 3)', '',
         'REAL: `parity/fixtures/tb3_jazzy_v3/physics/<case>/` (this PC, gz-sim 8.10, installed turtlebot3_gazebo 2.3.7 models, 3 runs',
         'each, bit-identical; mean shown). SITE: `parity/compare/site_tb3_motion.mjs` runs the site\'s own Gazebo model on the same',
         'world files with the TurtleBot3 files the site ships, stepped like the page (50 ms frames) - BEFORE = branch tb3-focus',
         'before the change, AFTER = with `public/js/tb3-motion.js`. Both sides are measured by `parity/compare/tb3_motion_fit.py`',
         '(real at 1 kHz with central differences, the site at its 50 ms frames with the speed over the last frame).',
         'Tolerances (same as `tests/tb3-motion.test.mjs`): times one page frame (0.05 s) or more where noted, distances as listed.',
         'Rows outside the tolerance after the change are **APPROXIMATED** with the measured difference.', '',
         '| Case | Quantity | REAL | SITE before | SITE after | tolerance | before | after |', '|---|---|---|---|---|---|---|---|']
    cnt = {'before': {}, 'after': {}}
    for c, k, what, ab, rl in ROWS:
        Bm, Am = (SB, SA) if c == 'tb3_push' else (B, A)
        r, b, a = val(R, c, k), val(Bm, c, k), val(Am, c, k)
        rr = R.get(c, {}).get(k)
        rs = 'n/a' if rr is None else (fmt(rr['mean']) + (f" [{rr['min']:.4f}..{rr['max']:.4f}]" if rr['min'] != rr['max'] else ''))
        vb, va = verdict(r, b, ab, rl), verdict(r, a, ab, rl)
        va = va if not va.startswith('DIFFERS') else va.replace('DIFFERS', 'APPROXIMATED')
        for tag, v in (('before', vb), ('after', va)): key = v.split(' ')[0]; cnt[tag][key] = cnt[tag].get(key, 0) + 1
        tol = f'±{ab}' + (f' + {int(rl * 100)} %' if rl else '') if ab else f'±{int(rl * 100)} %'
        L.append(f'| {c} | {what} | {rs} | {fmt(b)} | {fmt(a)} | {tol} | {vb} | {va} |')
    L += ['', 'Totals: before ' + ', '.join(f'{k} {v}' for k, v in sorted(cnt['before'].items())) + '; after ' + ', '.join(f'{k} {v}' for k, v in sorted(cnt['after'].items())) + '.', '',
          'tb3_push rows use the world\'s box without its PosePublisher plugin on the site side (`STRIP_POSEPUB=1`), i.e. a plain',
          'rigid box like one a student spawns: the site turns any model with a plugin into a kinematic robot (gz-sdformat.js',
          'addModel; physics_parity.md cause 1, not changed on Night 1), so with the recorder\'s PosePublisher the box cannot move',
          'on the site at all (page mode: displacement ' + fmt(val(A, 'tb3_push', 'box_disp')) + ' m after, ' + fmt(val(B, 'tb3_push', 'box_disp')) + ' m before).']
    open('parity/reports/TB3_MOTION_NIGHT1.md', 'w').write('\n'.join(L) + '\n')
    print('wrote parity/reports/TB3_MOTION_NIGHT1.md', cnt)


if __name__ == '__main__':
    main()
