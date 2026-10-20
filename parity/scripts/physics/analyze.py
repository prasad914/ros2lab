#!/usr/bin/env python3
"""Summaries of the physics baseline runs (parity/fixtures/physics/<case>/run<k>/*.csv[.gz]).

Writes parity/fixtures/physics/<case>/summary.json (per run + mean/min/max over runs) and prints one line per case.
Analytical references are computed from the world's own parameters (g = 9.8 as written in the worlds).
Usage: analyze.py [case ...]
"""
import csv
import glob
import gzip
import json
import math
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
FIX = os.path.abspath(os.path.join(HERE, '..', '..', 'fixtures', 'physics'))
G = 9.8


def rows(path):
    p = path if os.path.exists(path) else path + '.gz'
    if not os.path.exists(p):
        return []
    f = gzip.open(p, 'rt') if p.endswith('.gz') else open(p)
    return list(csv.DictReader(f))


def track(run, model, name=None):
    """Model pose track (sim_t, x, y, z, qx, qy, qz, qw) of the entry named `name` (default: the model itself)."""
    r = rows(os.path.join(run, f'model__{model}__pose.csv'))
    want = name or model
    out = [(tsim(d), *(float(d[k]) for k in ('x', 'y', 'z', 'qx', 'qy', 'qz', 'qw')))
           for d in r if d['name'] == want or d['name'].endswith('::' + want)]
    a = np.array(out) if out else np.zeros((0, 8))   # file order = arrival order
    return a


def tsim(d):
    """Header stamp when set, else the clock at arrival (PosePublisher leaves the Pose_V stamp at 0)."""
    t = float(d.get('sim_t') or 0)
    return t if t > 0 else float(d.get('rx_sim_t') or 0)


def names(run, model):
    return sorted({d['name'] for d in rows(os.path.join(run, f'model__{model}__pose.csv'))})


def vel(a, col=1):
    t = a[:, 0]
    return t[1:], np.diff(a[:, col]) / np.diff(t)


def pitch(qx, qy, qz, qw):
    return math.asin(max(-1, min(1, 2 * (qw * qy - qz * qx))))


def yaw(qx, qy, qz, qw):
    return math.atan2(2 * (qw * qz + qx * qy), 1 - 2 * (qy * qy + qz * qz))


def stats(vals):
    v = [x for x in vals if x is not None and not (isinstance(x, float) and math.isnan(x))]
    if not v:
        return None
    return dict(mean=float(np.mean(v)), min=float(np.min(v)), max=float(np.max(v)), n=len(v))


def runs(case):
    return sorted(glob.glob(os.path.join(FIX, case, 'run*')))


# ---------------------------------------------------------------- cases
def drop(run):
    a = track(run, 'box')
    if not len(a):
        return dict(error='no pose rows', names=names(run, 'box'))
    t, z = a[:, 0], a[:, 3]
    t0 = t[0]
    hit = next((i for i in range(len(z)) if z[i] <= 0.1005), None)
    res = dict(samples=len(a), t_first=float(t0), z_start=float(z[0]))
    if hit is not None:
        res['first_contact_t'] = float(t[hit] - t0)
        res['analytic_fall_time'] = math.sqrt(2 * (z[0] - 0.1) / G)
        after = z[hit:]
        mins = [i for i in range(1, len(after) - 1) if after[i] <= after[i - 1] and after[i] <= after[i + 1]]
        res['bounce_max_z_after_first_contact'] = float(after[hit:].max() if False else after.max())
        res['bounce_height_m'] = float(after.max() - 0.1)
        last = a[t >= t[-1] - 0.5]
        res['rest_z_mean'] = float(last[:, 3].mean())
        res['rest_penetration_m'] = float(0.1 - last[:, 3].mean())
        res['rest_z_std'] = float(last[:, 3].std())
        # settle: last time |z - rest| > 1e-4
        dev = np.abs(z - last[:, 3].mean())
        idx = np.where(dev > 1e-4)[0]
        res['settle_time_1e-4'] = float(t[idx[-1]] - t0) if len(idx) else 0.0
    c = rows(os.path.join(run, 'contact__box.csv'))
    if c:
        tl = max(tsim(d) for d in c)
        lastc = [d for d in c if tsim(d) >= tl - 0.5]
        npts = {}
        depths = []
        for d in lastc:
            npts.setdefault(d['sim_t'], 0)
            npts[d['sim_t']] += int(d['n_points'] or 0)
            depths += [float(x) for x in (d['depths'] or '').split()]
        res['rest_contact_points_per_msg'] = stats(list(npts.values()))
        res['rest_contact_depth'] = stats(depths)
        res['contact_msgs'] = len(c)
    return res


def restitution(run, ground_e):
    out = {}
    for e in (0.0, 0.5, 0.9, 1.0):
        m = f'sphere_e{e}'
        a = track(run, m)
        if not len(a):
            out[m] = dict(error='no rows', names=names(run, m))
            continue
        t, z = a[:, 0], a[:, 3]
        hit = next((i for i in range(len(z)) if z[i] <= 0.1005), None)
        if hit is None:
            out[m] = dict(error='no impact')
            continue
        # first rebound apex: max z between first contact and the second contact
        after = z[hit + 5:]
        sec = next((i for i in range(len(after)) if after[i] <= 0.1005), len(after))
        apex = float(after[:sec].max()) if sec > 0 else 0.1
        h0, h1 = z[0] - 0.1, apex - 0.1
        out[m] = dict(drop_height=float(h0), first_rebound_height=h1, e_effective=math.sqrt(max(h1, 0) / h0),
                      sphere_e=e, ground_e=ground_e, product=e * ground_e)
    return out


def impulse_slide(run, model, axis, mu):
    a = track(run, model)
    if not len(a):
        return dict(error='no rows', names=names(run, model))
    col = 1 if axis == 'x' else 2
    t, v = vel(a, col)
    # impulse step: first big velocity
    i0 = next((i for i in range(len(v)) if abs(v[i]) > 0.05), None)
    if i0 is None:
        return dict(error='never moved')
    v0 = float(np.max(np.abs(v[i0:i0 + 5])))
    x0 = a[i0, col]
    stopped = next((i for i in range(i0 + 5, len(v)) if abs(v[i]) < 1e-3), None)
    res = dict(v0=v0, impulse_sim_t=float(t[i0]))
    if stopped is not None:
        res['stop_distance'] = float(abs(a[stopped + 1, col] - x0))
        res['stop_time'] = float(t[stopped] - t[i0])
        seg = slice(i0 + 3, max(i0 + 4, stopped - 3))
        if stopped - i0 > 10:
            k = np.polyfit(t[seg], np.abs(v[seg]), 1)
            res['decel_fit'] = float(-k[0])
            res['mu_effective'] = float(-k[0] / G)
    else:
        res['stop_distance'] = None
        res['note'] = 'still moving at end of record'
        res['distance_at_end'] = float(abs(a[-1, col] - x0))
    if mu:
        res['analytic_stop_distance'] = v0 * v0 / (2 * mu * G)
        res['analytic_stop_distance_v0_nominal'] = None
    return res


def slide(run, mu):
    r = impulse_slide(run, 'box', 'x', mu)
    r['analytic_stop_distance_v0_0.5'] = 0.25 / (2 * mu * G)
    return r


def incline(run, th):
    s = math.sin(math.radians(th))
    out = {}
    for m, k in (('sphere', 5 / 7), ('cylinder', 2 / 3), ('box_frictionless', 1.0)):
        a = track(run, m)
        if not len(a):
            out[m] = dict(error='no rows', names=names(run, m))
            continue
        t = a[:, 0] - a[0, 0]
        d = np.hypot(a[:, 1] - a[0, 1], a[:, 3] - a[0, 3])
        sel = (t > 0.05) & (t < 1.2)
        acc = float(np.polyfit(t[sel], d[sel], 2)[0] * 2) if sel.sum() > 10 else None
        out[m] = dict(accel_along_slope=acc, analytic=k * G * s, ratio_to_g_sin=acc / (G * s) if acc else None,
                      expected_ratio=k, distance_1s=float(np.interp(1.0, t, d)))
    return out


def pendulum(run):
    out = {}
    for m, extra in (('pend_d0', {}), ('pend_d01', {}), ('pend_d1', {}), ('pend_spring', {'k': 10.0})):
        js = [d for d in rows(os.path.join(run, f'joint_state__{m}.csv')) if d['joint'] == 'hinge']
        src = 'joint_state'
        if js:
            t = np.array([tsim(d) for d in js])
            q = np.array([float(d['position']) for d in js]) + 0.5      # joint zero = released at 0.5 rad
        else:
            a = track(run, m, 'bob')
            src = 'link pose'
            if not len(a):
                out[m] = dict(error='no rows', names=names(run, m))
                continue
            t = a[:, 0]
            q = np.array([pitch(*r[4:8]) for r in a])
        order = np.argsort(t)
        t, q = t[order] - t[order][0], q[order]
        eq = 0.0
        zc = [t[i] - q[i] * (t[i + 1] - t[i]) / (q[i + 1] - q[i]) for i in range(len(q) - 1) if (q[i] - eq) * (q[i + 1] - eq) < 0]
        per = [2 * (zc[i + 1] - zc[i]) for i in range(len(zc) - 1)]
        peaks = [q[i] for i in range(1, len(q) - 1) if q[i] > q[i - 1] and q[i] >= q[i + 1] and q[i] > 0]
        res = dict(source=src, samples=int(len(t)), theta0=float(q[0]), period_mean=float(np.mean(per)) if per else None,
                   n_half_periods=len(per), first_peaks=[float(x) for x in peaks[:6]],
                   amplitude_at_end=float(np.max(np.abs(q[t > t[-1] - 2.0]))) if len(t) else None)
        if len(peaks) >= 2 and peaks[1] > 0:
            res['log_decrement'] = float(math.log(peaks[0] / peaks[1]))
        I = 1.0 * 1.0 + 2 / 5 * 1.0 * 0.05 ** 2
        w2 = (1.0 * G * 1.0 + extra.get('k', 0.0)) / I
        res['analytic_small_angle_period'] = 2 * math.pi / math.sqrt(w2)
        res['analytic_period_with_amplitude_0.5'] = res['analytic_small_angle_period'] * (1 + 0.5 ** 2 / 16) if not extra else None
        out[m] = res
    return out


def collision(run):
    A, B = track(run, 'box_a'), track(run, 'box_b')
    if not len(A) or not len(B):
        return dict(error='no rows')
    ta, va = vel(A)
    tb, vb = vel(B)
    i0 = next((i for i in range(len(va)) if va[i] > 0.05), None)
    if i0 is None:
        return dict(error='A never moved')
    v_before = float(np.median(va[i0 + 5:i0 + 50]))
    ib = next((i for i in range(len(vb)) if vb[i] > 0.01), None)
    if ib is None:
        return dict(v_a_before=v_before, error='B never moved')
    sl = slice(ib + 30, ib + 200)
    va_after, vb_after = float(np.median(va[sl])), float(np.median(vb[sl]))
    return dict(v_a_before=v_before, v_a_after=va_after, v_b_after=vb_after, impact_t=float(tb[ib]),
                e_effective=(vb_after - va_after) / v_before if v_before else None,
                momentum_ratio=(va_after + vb_after) / v_before if v_before else None)


def noinertial(run):
    meta = json.load(open(os.path.join(run, 'run_meta.json')))
    res = dict(model_info=meta.get('model_info'))
    for m in ('box_noinertial', 'box_ref'):
        a = track(run, m)
        if not len(a):
            res[m] = dict(error='no rows', names=names(run, m))
            continue
        t, v = vel(a)
        i0 = next((i for i in range(len(v)) if abs(v[i]) > 0.05), None)
        z_rest = float(a[(a[:, 0] > 1.2) & (a[:, 0] < 1.45), 3].mean()) if len(a) else None
        res[m] = dict(v_after_1Ns_impulse=float(np.max(v[i0:i0 + 5])) if i0 is not None else None, z_rest_before_push=z_rest)
        if res[m]['v_after_1Ns_impulse']:
            res[m]['mass_effective'] = 1.0 / res[m]['v_after_1Ns_impulse']
    return res


def joint_limits(run):
    js = [d for d in rows(os.path.join(run, 'joint_state__arm.csv')) if d['joint'] == 'j']
    if not js:
        return dict(error='no joint rows')
    t = np.array([tsim(d) for d in js])
    q = np.array([float(d['position']) for d in js])
    v = np.array([float(d['velocity']) for d in js])
    moving = np.where(np.abs(v) > 1e-4)[0]
    res = dict(max_velocity=float(np.max(np.abs(v))), final_position=float(q[-1]), max_position=float(q.max()),
               velocity_limit=0.5, effort_limit=1.0, commanded_effort=5.0, upper_limit=1.0)
    if len(moving) > 3:
        i = moving[0]
        seg = slice(i, min(i + 60, len(t)))
        res['initial_angular_accel'] = float(np.polyfit(t[seg], v[seg], 1)[0])
        res['accel_if_effort_clamped_to_1'] = 1.0 / (0.0834 + 0.25)
        res['accel_if_effort_5'] = 5.0 / (0.0834 + 0.25)
        res['time_motion_start'] = float(t[i])
    return res


def determinism(case_runs):
    tracks = []
    for r in case_runs:
        a = track(r, 'tilted')
        tracks.append(a)
    if not tracks or any(len(a) == 0 for a in tracks):
        return dict(error='missing tracks')
    n = min(len(a) for a in tracks)
    ref = tracks[0][:n]
    diffs = [float(np.max(np.abs(a[:n, 1:] - ref[:, 1:]))) for a in tracks]
    return dict(runs=len(tracks), rows_compared=n, rows_per_run=[len(a) for a in tracks],
                max_abs_diff_vs_run1=diffs, identical=all(d == 0.0 for d in diffs),
                final_pose_run1=[float(x) for x in tracks[0][n - 1, 1:]])


def tb3(run, mode):
    gt = track(run, 'burger')
    od = rows(os.path.join(run, 'odom.csv'))
    meta = json.load(open(os.path.join(run, 'commands_sent.json')))
    if not len(gt) or not od:
        return dict(error='missing rows', gt=len(gt), odom=len(od), names=names(run, 'burger'))
    tc = meta['sent'][0]['sent_at_sim'] if meta.get('sent') else None
    ot = np.array([tsim(d) for d in od])
    ox = np.array([float(d['x']) for d in od]); oy = np.array([float(d['y']) for d in od])
    oyaw = np.array([yaw(float(d['qx']), float(d['qy']), float(d['qz']), float(d['qw'])) for d in od])
    ovx = np.array([float(d['vx']) for d in od]); owz = np.array([float(d['wz']) for d in od])
    gt_t = gt[:, 0]
    gx = np.interp(ot, gt_t, gt[:, 1] - gt[0, 1]); gy = np.interp(ot, gt_t, gt[:, 2] - gt[0, 2])
    gyaw = np.unwrap([yaw(*r[4:8]) for r in gt])
    gyaw_i = np.interp(ot, gt_t, gyaw - gyaw[0])
    res = dict(odom_msgs=len(od), odom_rate_per_sim_s=float((len(ot) - 1) / (ot[-1] - ot[0])) if len(ot) > 1 else None,
               odom_frame_id=od[0]['frame_id'], odom_child_frame_id=od[0]['child_frame_id'], command_sim_t=tc,
               gt_samples=len(gt))
    end = ot[-1]
    res['odom_final'] = dict(x=float(ox[-1]), y=float(oy[-1]), yaw_unwrapped=float(np.unwrap(oyaw)[-1]))
    res['gt_final_rel'] = dict(x=float(gx[-1]), y=float(gy[-1]), yaw_unwrapped=float(gyaw_i[-1]))
    res['pos_error_final'] = float(math.hypot(ox[-1] - gx[-1], oy[-1] - gy[-1]))
    if mode == 'lin':
        gvt, gv = vel(gt)
        res['gt_speed_final'] = float(np.median(np.hypot(*(np.diff(gt[-200:, 1:3], axis=0).T)) / np.diff(gt[-200:, 0])))
        if tc is not None:
            sel = gvt > tc
            vv = gv[sel]; tt = gvt[sel]
            r90 = next((tt[i] for i in range(len(vv)) if vv[i] >= 0.18), None)
            res['gt_time_to_90pct_after_cmd'] = float(r90 - tc) if r90 is not None else None
            res['gt_initial_accel'] = float(np.polyfit(tt[(tt > tc + 0.01) & (tt < tc + 0.12)], vv[(tt > tc + 0.01) & (tt < tc + 0.12)], 1)[0]) \
                if ((tt > tc + 0.01) & (tt < tc + 0.12)).sum() > 5 else None
            o_after = ot > tc
            r90o = next((ot[o_after][i] for i in range(o_after.sum()) if ovx[o_after][i] >= 0.18), None)
            res['odom_vx_time_to_90pct_after_cmd'] = float(r90o - tc) if r90o is not None else None
        res['odom_vx_final'] = float(ovx[-1])
        res['distance_gt'] = float(math.hypot(gx[-1], gy[-1]))
        res['distance_odom'] = float(math.hypot(ox[-1], oy[-1]))
    else:
        w = np.diff(gyaw) / np.diff(gt_t)
        res['gt_yaw_rate_final'] = float(np.median(w[-200:]))
        res['odom_wz_final'] = float(owz[-1])
        if tc is not None:
            tt = gt_t[1:]
            r90 = next((tt[i] for i in range(len(w)) if tt[i] > tc and w[i] >= 0.9), None)
            res['gt_time_to_90pct_after_cmd'] = float(r90 - tc) if r90 is not None else None
        res['yaw_error_final'] = float(np.unwrap(oyaw)[-1] - gyaw_i[-1])
    return res


def tb3_push(run):
    res = tb3(run, 'lin')
    b = track(run, 'light_box')
    if len(b):
        res['box_displacement'] = float(math.hypot(b[-1, 1] - b[0, 1], b[-1, 2] - b[0, 2]))
        res['box_final'] = [float(x) for x in b[-1, 1:4]]
        moved = np.where(np.hypot(b[:, 1] - b[0, 1], b[:, 2] - b[0, 2]) > 0.002)[0]
        res['box_first_moved_t'] = float(b[moved[0], 0]) if len(moved) else None
    return res


def sensors(run, wall):
    imu = rows(os.path.join(run, 'imu.csv'))
    scan = rows(os.path.join(run, 'scan.csv'))
    res = dict(imu_samples=len(imu), scan_msgs=len(scan))
    if imu:
        arr = np.array([[float(d[k]) for k in ('wx', 'wy', 'wz', 'ax', 'ay', 'az', 'qx', 'qy', 'qz', 'qw')] for d in imu])
        t = np.array([tsim(d) for d in imu])
        res['imu_rate_per_sim_s'] = float((len(t) - 1) / (t[-1] - t[0]))
        res['imu_frame_id'] = imu[0]['frame_id']
        last = arr[-1000:]
        res['imu_last1000'] = {k: dict(mean=float(last[:, i].mean()), std=float(last[:, i].std()))
                               for i, k in enumerate(('wx', 'wy', 'wz', 'ax', 'ay', 'az', 'qx', 'qy', 'qz', 'qw'))}
        res['imu_model_stddev'] = dict(angular_velocity=2e-4, linear_acceleration=1.7e-2)
    if scan:
        res['scan_frame_id'] = scan[0]['frame_id']
        t = np.array([tsim(d) for d in scan])
        res['scan_rate_per_sim_s'] = float((len(t) - 1) / (t[-1] - t[0])) if len(t) > 1 else None
        d0 = scan[0]
        res['scan_meta'] = {k: d0[k] for k in ('angle_min', 'angle_max', 'angle_step', 'range_min', 'range_max', 'count')}
        R = [[float(x) for x in d['ranges'].split()] for d in scan]
        flat = [x for r in R for x in r]
        res['ranges_total'] = len(flat)
        res['ranges_inf'] = sum(1 for x in flat if math.isinf(x))
        res['ranges_nan'] = sum(1 for x in flat if math.isnan(x))
        res['ranges_eq_range_max'] = sum(1 for x in flat if x == float(d0['range_max']))
        fin = [x for x in flat if math.isfinite(x)]
        res['finite_ranges'] = len(fin)
        if fin:
            res['finite_min_max'] = [min(fin), max(fin)]
        if wall:
            ray0 = np.array([r[0] for r in R if r and math.isfinite(r[0])])
            if len(ray0):
                res['ray0_at_wall_1m'] = dict(n=int(len(ray0)), mean=float(ray0.mean()), std=float(ray0.std()),
                                              min=float(ray0.min()), max=float(ray0.max()), model_stddev=0.01,
                                              model_resolution=0.015)
                hist, edges = np.histogram(ray0, bins=20)
                res['ray0_histogram'] = dict(counts=hist.tolist(), edges=[float(e) for e in edges])
                res['ray0_distinct_values'] = int(len(set(np.round(ray0, 9))))
            # all rays within +-10 deg of the wall normal, corrected to the perpendicular distance
            perp = []
            for r in R:
                for i in list(range(0, 11)) + list(range(350, 360)):
                    if i < len(r) and math.isfinite(r[i]):
                        perp.append(r[i] * math.cos(math.radians(i)))
            if perp:
                p = np.array(perp)
                res['wall_rays_pm10deg_perp'] = dict(n=int(len(p)), mean=float(p.mean()), std=float(p.std()))
    return res


def ur5e_traj(run):
    cs = rows(os.path.join(run, 'controller_state.csv'))
    js = rows(os.path.join(run, 'joint_states.csv'))
    meta = json.load(open(os.path.join(run, 'record_meta.json'))) if os.path.exists(os.path.join(run, 'record_meta.json')) else {}
    res = dict(controller_state_msgs=len(cs), joint_states_msgs=len(js), result=meta.get('result'), accepted=meta.get('accepted'))
    if js:
        t = np.array([float(d['stamp']) for d in js])
        res['joint_states_rate'] = float((len(t) - 1) / (t[-1] - t[0])) if len(t) > 1 else None
    if cs:
        t = np.array([float(d['stamp']) for d in cs])
        res['controller_state_rate'] = float((len(t) - 1) / (t[-1] - t[0])) if len(t) > 1 else None
        for j in ('shoulder_pan_joint', 'shoulder_lift_joint', 'elbow_joint'):
            err = np.array([float(d[f'{j}_ref']) - float(d[f'{j}_fb']) for d in cs])
            err = err[np.isfinite(err)]
            if len(err):
                res[f'{j}_max_abs_tracking_error'] = float(np.max(np.abs(err)))
                res[f'{j}_final_error'] = float(err[-1])
    return res


def ur5e_step(run):
    js = rows(os.path.join(run, 'joint_states.csv'))
    meta = json.load(open(os.path.join(run, 'record_meta.json'))) if os.path.exists(os.path.join(run, 'record_meta.json')) else {}
    if not js or 'step_to' not in meta:
        return dict(error='no data', meta=meta)
    t = np.array([float(d['stamp']) for d in js])
    q = np.array([float(d['shoulder_pan_joint_pos']) for d in js])
    q0, q1 = meta['step_from'][0], meta['step_to'][0]
    frac = (q - q0) / (q1 - q0)
    start = next((i for i in range(len(frac)) if frac[i] > 0.01), None)
    res = dict(rows=len(js), joint_states_rate=float((len(t) - 1) / (t[-1] - t[0])), final_fraction=float(frac[-1]))
    if start is not None:
        t63 = next((t[i] for i in range(start, len(frac)) if frac[i] >= 0.632), None)
        t95 = next((t[i] for i in range(start, len(frac)) if frac[i] >= 0.95), None)
        ts = t[start - 1] if start > 0 else t[start]
        res['time_constant_63pct'] = float(t63 - ts) if t63 is not None else None
        res['time_to_95pct'] = float(t95 - ts) if t95 is not None else None
        res['overshoot_fraction'] = float(max(0.0, frac.max() - 1.0))
    gp = os.path.join(run, 'gain_param.txt')
    if os.path.exists(gp):
        res['gain_param_reply'] = open(gp).read().strip()
    return res


def summarize(case):
    rs = runs(case)
    per = {}
    if case == 'determinism':
        return dict(case=case, determinism=determinism(rs))
    for r in rs:
        k = os.path.basename(r)
        try:
            if case.startswith('drop'):
                per[k] = drop(r)
            elif case.startswith('restitution_ground'):
                per[k] = restitution(r, float(case.replace('restitution_ground', '')))
            elif case.startswith('slide_mu'):
                per[k] = slide(r, float(case.replace('slide_mu', '')))
            elif case == 'slide_aniso':
                per[k] = dict(box_x=impulse_slide(r, 'box_x', 'x', 0.1), box_y=impulse_slide(r, 'box_y', 'y', 1.0))
            elif case == 'slide_combine':
                per[k] = dict(box_lo=impulse_slide(r, 'box_lo', 'x', None), box_hi=impulse_slide(r, 'box_hi', 'x', None))
            elif case.startswith('incline_'):
                per[k] = incline(r, int(case.split('_')[1]))
            elif case == 'pendulum':
                per[k] = pendulum(r)
            elif case == 'collision':
                per[k] = collision(r)
            elif case == 'noinertial':
                per[k] = noinertial(r)
            elif case == 'joint_limits':
                per[k] = joint_limits(r)
            elif case == 'tb3_push':
                per[k] = tb3_push(r)
            elif case.startswith('tb3_lin'):
                per[k] = tb3(r, 'lin')
            elif case.startswith('tb3_ang'):
                per[k] = tb3(r, 'ang')
            elif case.startswith('tb3_sensors'):
                per[k] = sensors(r, case.endswith('wall'))
            elif case == 'ur5e_traj':
                per[k] = ur5e_traj(r)
            elif case.startswith('ur5e_step'):
                per[k] = ur5e_step(r)
        except Exception as e:   # keep going, show the error in the summary
            per[k] = dict(error=repr(e))
    return dict(case=case, runs=per)


def main():
    cases = sys.argv[1:] or sorted(d for d in os.listdir(FIX) if os.path.isdir(os.path.join(FIX, d)) and runs(d))
    for c in cases:
        s = summarize(c)
        with open(os.path.join(FIX, c, 'summary.json'), 'w') as f:
            json.dump(s, f, indent=1)
        print(c, json.dumps(s)[:300])


if __name__ == '__main__':
    main()
