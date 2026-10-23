#!/usr/bin/env python3
"""TurtleBot3 motion calibration from REAL Gazebo runs (parity/scripts/physics/run_case.py output).

For each case dir (run1..runN) it reads the ground-truth model pose (model__<model>__pose.csv.gz, PosePublisher) and
/odom (odom.csv), and reports per run and as mean [min..max]:
  lin cases : command time, gt speed 10/50/90 % times, gt initial acceleration (0-50 %), gt distance and odom distance
              at the end, odom - gt position error, final speeds
  ang cases : gt yaw-rate 50/90 % times, odom and gt yaw at the end, yaw error odom - gt
  stop cases: distance gt / odom from the stop command to rest, time to stop
  wall      : gt x where the robot stops, odom x at the end
  push      : box displacement and first-move time
It also fits the slip model the site uses (public/js/tb3-motion.js): the body velocity follows the wheel-surface
velocity v_w (DiffDrive SpeedLimiter output, = odom) through
        dv/dt = clamp((v_w - v) / tau, -a_max, a_max)
separately for linear (tau_v, a_v) and yaw (tau_w, a_w), by grid search on the gt speed / yaw-rate curve.
Usage: tb3_motion_fit.py <case_dir> [<case_dir> ...] [--json out.json]
"""
import csv, gzip, json, math, os, statistics, sys


def load_pose(run, model):
    f = os.path.join(run, f'model__{model}__pose.csv.gz')
    rows = []
    with gzip.open(f, 'rt') as fh:
        for r in csv.DictReader(fh):
            if r['name'] != model:
                continue
            t = float(r['sim_t']) if float(r['sim_t']) > 0 else float(r['rx_sim_t'])
            qx, qy, qz, qw = (float(r[k]) for k in ('qx', 'qy', 'qz', 'qw'))
            yaw = math.atan2(2 * (qw * qz + qx * qy), 1 - 2 * (qy * qy + qz * qz))
            rows.append((t, float(r['x']), float(r['y']), yaw))
    rows.sort()
    out, last = [], None   # one row per time, yaw unwrapped
    off = 0.0
    for t, x, y, yaw in rows:
        if last is not None and t <= last[0]:
            continue
        if last is not None:
            d = yaw + off - last[3]
            if d > math.pi: off -= 2 * math.pi
            elif d < -math.pi: off += 2 * math.pi
        last = (t, x, y, yaw + off)
        out.append(last)
    return out


def load_odom(run):
    rows = []
    for r in csv.DictReader(open(os.path.join(run, 'odom.csv'))):
        t = float(r['sim_t'])
        qx, qy, qz, qw = (float(r[k]) for k in ('qx', 'qy', 'qz', 'qw'))
        yaw = math.atan2(2 * (qw * qz + qx * qy), 1 - 2 * (qy * qy + qz * qz))
        rows.append((t, float(r['x']), float(r['y']), yaw, float(r['vx']), float(r['wz'])))
    out, off, last = [], 0.0, None
    for t, x, y, yaw, vx, wz in sorted(rows):
        if last is not None:
            d = yaw + off - last[3]
            if d > math.pi: off -= 2 * math.pi
            elif d < -math.pi: off += 2 * math.pi
        last = (t, x, y, yaw + off, vx, wz)
        out.append(last)
    return out


def speeds(g, win=0.02):
    """gt body speed along heading and yaw rate, by central differences over +-win s (at least one sample step)"""
    T = [r[0] for r in g]
    if len(T) > 2: win = max(win, 1.01 * sorted(T[i + 1] - T[i] for i in range(len(T) - 1))[len(T) // 2])
    out = []
    j0 = j1 = 0
    for i, (t, x, y, th) in enumerate(g):
        while T[j0] < t - win: j0 += 1
        while j1 + 1 < len(T) and T[j1 + 1] <= t + win: j1 += 1
        if j1 == j0: continue
        a, b = g[j0], g[j1]; dt = b[0] - a[0]
        vx = ((b[1] - a[1]) * math.cos(th) + (b[2] - a[2]) * math.sin(th)) / dt
        out.append((t, vx, (b[3] - a[3]) / dt))
    return out


def t_at(series, t0, level, idx):
    for r in series:
        if r[0] >= t0 and r[idx] >= level:
            return r[0] - t0
    return None


def sim_lag(times, vw, tau, amax, delay=0.0):
    """body velocity through the slip model; vw = wheel-surface velocity at each time, seen `delay` s late"""
    v, out, k = 0.0, [], 0
    def w_at(t):   # times only increase, so the lookup index only moves forward
        nonlocal k
        if t < times[0]: return 0.0
        while k + 1 < len(times) and times[k + 1] <= t: k += 1
        return vw[k]
    for i, t in enumerate(times):
        if i:
            dt = times[i] - times[i - 1]
            n = max(1, int(dt / 0.001 + 0.5)); h = dt / n
            target = w_at(times[i - 1] - delay)
            for _ in range(n):
                a = (target - v) / tau if tau > 0 else (target - v) / h
                a = max(-amax, min(amax, a))
                v += a * h
        out.append(v)
    return out


def fit(times, vw, vb, taus, amaxs, delays=(0.0,)):
    best = None
    for d in delays:
        for tau in taus:
            for am in amaxs:
                s = sim_lag(times, vw, tau, am, d)
                e = math.sqrt(sum((p - q) ** 2 for p, q in zip(s, vb)) / len(vb))
                if best is None or e < best[0]:
                    best = (e, tau, am, d)
    return {'rms': best[0], 'tau': best[1], 'a_max': best[2], 'delay': best[3]}


def metric_fit(times, vw, level, real, delays, taus, amaxs):
    """parameters whose simulated body curve best matches the real 50 % / 90 % times and the final deficit
    (integral of wheel - body velocity = odom - ground truth): score = |dt50|/0.05 + |dt90|/0.1 + |ddef|/(0.1*real def)"""
    best = None
    T = [times[0] + i * 0.001 for i in range(int((times[-1] - times[0]) / 0.001))]
    j, W = 0, []
    for t in T:
        while j + 1 < len(times) and times[j + 1] <= t: j += 1
        W.append(vw[j])
    for d in delays:
        for tau in taus:
            for am in amaxs:
                v = sim_lag(T, W, tau, am, d)
                t50 = next((t - real['t_cmd'] for t, x in zip(T, v) if t >= real['t_cmd'] and x >= 0.5 * level), None)
                t90 = next((t - real['t_cmd'] for t, x in zip(T, v) if t >= real['t_cmd'] and x >= 0.9 * level), None)
                if t50 is None or t90 is None: continue
                dfc = sum((a - b) * 0.001 for a, b in zip(W, v))
                sc = abs(t50 - real['t50']) / 0.05 + abs(t90 - real['t90']) / 0.1 + abs(dfc - real['deficit']) / max(1e-6, 0.1 * abs(real['deficit']))
                if best is None or sc < best['score']:
                    best = dict(score=sc, delay=d, tau=tau, a_max=am, t50=t50, t90=t90, deficit=dfc)
    return best


def spread(xs):
    xs = [x for x in xs if x is not None]
    if not xs: return None
    return {'mean': statistics.mean(xs), 'min': min(xs), 'max': max(xs), 'n': len(xs)}


def case_cfg(case_dir):
    c = json.load(open(os.path.join(case_dir, 'case.json')))
    model = 'waffle_pi' if 'waffle_pi' in ' '.join(c.get('subs', [])) else 'burger'
    cmds = [json.loads(x) for x in c.get('cmds', [])]
    return c, model, cmds


def analyse(case_dir):
    c, model, cmds = case_cfg(case_dir)
    name = os.path.basename(case_dir.rstrip('/'))
    runs = sorted(d for d in os.listdir(case_dir) if d.startswith('run') and os.path.isdir(os.path.join(case_dir, d)))
    per = {}
    for rn in runs:
        run = os.path.join(case_dir, rn)
        g = load_pose(run, model)
        o = load_odom(run)
        sp = speeds(g)
        t_cmd = cmds[0]['t'] if cmds else 0.0
        msg = cmds[0]['msg'] if cmds else ''
        vx_cmd = float((msg.split('linear { x: ')[1].split(' ')[0]) if 'linear { x:' in msg else 0.0)
        wz_cmd = float((msg.split('angular { z: ')[1].split(' ')[0]) if 'angular { z:' in msg else 0.0)
        g0 = min(g, key=lambda r: abs(r[0] - t_cmd))
        gend, oend = g[-1], o[-1]
        R = {'model': model, 't_cmd': t_cmd, 'vx_cmd': vx_cmd, 'wz_cmd': wz_cmd, 't_end': gend[0]}
        # distance travelled (gt from the command time; odom from its origin)
        R['gt_dist'] = math.hypot(gend[1] - g0[1], gend[2] - g0[2])
        R['odom_dist'] = math.hypot(oend[1], oend[2])
        R['gt_yaw'] = gend[3] - g0[3]
        R['odom_yaw'] = oend[3]
        # odom vs gt in the odom frame (gt relative to its pose at the command, rotated into the start heading)
        c0, s0 = math.cos(-g0[3]), math.sin(-g0[3])
        gx, gy = c0 * (gend[1] - g0[1]) - s0 * (gend[2] - g0[2]), s0 * (gend[1] - g0[1]) + c0 * (gend[2] - g0[2])
        R['pos_error'] = math.hypot(oend[1] - gx, oend[2] - gy)
        R['yaw_error'] = oend[3] - R['gt_yaw']
        if vx_cmd:
            for p in (10, 50, 90): R[f'gt_v_t{p}'] = t_at(sp, t_cmd, vx_cmd * p / 100, 1)
            R['odom_v_t90'] = t_at([(r[0], r[4]) for r in o], t_cmd, vx_cmd * 0.9, 1)
            t50 = R['gt_v_t50']
            R['gt_acc_0_50'] = (0.5 * vx_cmd / t50) if t50 else None
            R['gt_v_final'] = statistics.mean(r[1] for r in sp if r[0] > gend[0] - 0.5)
            R['odom_v_final'] = o[-1][4]
        if wz_cmd:
            for p in (10, 50, 90): R[f'gt_w_t{p}'] = t_at(sp, t_cmd, wz_cmd * p / 100, 2)
            R['gt_w_final'] = statistics.mean(r[2] for r in sp if r[0] > gend[0] - 0.5)
            R['odom_w_final'] = o[-1][5]
        if len(cmds) > 1:   # stop command
            t_stop = cmds[1]['t']
            gs = min(g, key=lambda r: abs(r[0] - t_stop)); os_ = min(o, key=lambda r: abs(r[0] - t_stop))
            R['t_stop'] = t_stop
            R['gt_stop_dist'] = math.hypot(gend[1] - gs[1], gend[2] - gs[2])
            R['odom_stop_dist'] = math.hypot(oend[1] - os_[1], oend[2] - os_[2])
            R['gt_time_to_rest'] = next((r[0] - t_stop for r in sp if r[0] > t_stop and abs(r[1]) < 0.002), None)
        if name.startswith('tb3_wall'):
            R['gt_x_end'] = gend[1]; R['odom_x_end'] = oend[1]
            R['gt_v_final'] = statistics.mean(r[1] for r in sp if r[0] > gend[0] - 0.5)
            R['wheel_odom_v_final'] = o[-1][4]
        # slip fit on the window after the command (odom velocity = wheel-surface velocity of the SpeedLimiter)
        win = [r for r in sp if t_cmd - 0.05 <= r[0] <= t_cmd + 4.0]
        if '--metric-fit' in sys.argv and (vx_cmd or wz_cmd) and len(cmds) == 1 and not name.startswith(('tb3_wall', 'tb3_push')):
            ot = [r[0] for r in o if t_cmd - 0.05 <= r[0] <= t_cmd + 4.0]
            ov = [r[4] if vx_cmd else r[5] for r in o if t_cmd - 0.05 <= r[0] <= t_cmd + 4.0]
            lvl = vx_cmd or wz_cmd
            realm = dict(t_cmd=t_cmd, t50=R['gt_v_t50' if vx_cmd else 'gt_w_t50'], t90=R['gt_v_t90' if vx_cmd else 'gt_w_t90'],
                         deficit=R['pos_error'] if vx_cmd else R['yaw_error'])
            if None not in realm.values():
                R['metric_fit_' + ('lin' if vx_cmd else 'ang')] = metric_fit(ot, ov, lvl, realm,
                    [0.0, 0.02, 0.04, 0.06, 0.08, 0.1, 0.12, 0.15, 0.2, 0.25],
                    [0.0, 0.02, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5],
                    [0.3, 0.4, 0.5, 0.55, 0.6, 0.7, 0.8, 0.9, 1.0, 1.2, 1.5, 2.0, 3.0] if vx_cmd else [0.6, 0.7, 0.75, 0.8, 0.85, 0.9, 1.0, 1.1, 1.2, 1.5])
        if win and (vx_cmd or wz_cmd) and len(cmds) == 1 and not name.startswith('tb3_wall') and '--metric-fit' not in sys.argv:
            ot = [r[0] for r in o]
            def oval(t, k):
                i = min(range(len(ot)), key=lambda j: abs(ot[j] - t)); return o[i][k]
            times = [r[0] for r in win][::5]
            if vx_cmd:
                vw = [oval(t, 4) for t in times]; vb = [r[1] for r in win][::5]
                R['fit_lin'] = fit(times, vw, vb, [0.0, 0.02, 0.04, 0.06, 0.08, 0.1, 0.12, 0.15, 0.2, 0.25, 0.3], [0.3, 0.4, 0.45, 0.5, 0.55, 0.6, 0.7, 0.8, 1.0, 1.5, 2.0, 5.0, 100.0], (0.0, 0.05, 0.1, 0.15, 0.2, 0.25))
            if wz_cmd:
                vw = [oval(t, 5) for t in times]; vb = [r[2] for r in win][::5]
                R['fit_ang'] = fit(times, vw, vb, [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 1.0], [0.4, 0.5, 0.6, 0.7, 0.75, 0.8, 0.85, 0.9, 1.0, 1.2, 1.5, 2.0, 3.0, 100.0], (0.0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3))
        if name.startswith('tb3_push'):
            b = load_pose(run, 'light_box')
            R['box_disp'] = math.hypot(b[-1][1] - b[0][1], b[-1][2] - b[0][2])
            R['box_first_move'] = next((r[0] for r in b if math.hypot(r[1] - b[0][1], r[2] - b[0][2]) > 0.001), None)
        per[rn] = R
    keys = sorted({k for R in per.values() for k, v in R.items() if isinstance(v, (int, float)) and not isinstance(v, bool)})
    summ = {k: spread([R.get(k) for R in per.values()]) for k in keys}
    for f in ('metric_fit_lin', 'metric_fit_ang'):
        fs = [R[f] for R in per.values() if R.get(f)]
        if fs: summ[f] = {k: spread([x[k] for x in fs]) for k in ('delay', 'tau', 'a_max', 't50', 't90', 'deficit', 'score')}
    for f in ('fit_lin', 'fit_ang'):
        fs = [R[f] for R in per.values() if f in R]
        if fs: summ[f] = {k: spread([x[k] for x in fs]) for k in ('tau', 'a_max', 'delay', 'rms')}
    return {'case': name, 'dir': case_dir, 'runs': per, 'summary': summ}


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    out = sys.argv[sys.argv.index('--json') + 1] if '--json' in sys.argv else None
    if out: args = [a for a in args if a != out]
    res = [analyse(d) for d in args]
    for r in res:
        print(f"== {r['case']}  ({r['dir']})")
        for k, v in r['summary'].items():
            if isinstance(v, dict) and 'mean' in v:
                print(f"  {k}: {v['mean']:.4f} [{v['min']:.4f}..{v['max']:.4f}] n={v['n']}")
            elif isinstance(v, dict):
                print(f"  {k}: " + ', '.join(f"{kk} {vv['mean']:.3f} [{vv['min']:.3f}..{vv['max']:.3f}]" for kk, vv in v.items()))
    if out:
        json.dump(res, open(out, 'w'), indent=1)


if __name__ == '__main__':
    main()
