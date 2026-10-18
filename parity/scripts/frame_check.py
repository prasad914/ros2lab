#!/usr/bin/env python3
"""Check that goals.yaml positions are valid in the running scenario's map frame (after localization).

Compares /amcl_pose, TF map->base_footprint and goals.yaml start_pose. AMCL is seeded with start_pose, so agreement
there alone proves nothing; the real test projects /scan endpoints through TF map->scan frame onto the map pgm the
scenario loaded and counts how many land within --cells cells of an occupied pixel. A control projects the same
scans with the robot shifted by --control-dx/--control-dy (default: the Gazebo spawn pose of the TB3 launch files,
i.e. what the goals would mean if they were in the Gazebo world frame instead).
Criterion (fixed before measuring): VALID when the scan hit fraction >= --min-hit, |amcl - start_pose| < 0.10 m
and |TF - amcl| < 0.05 m. Prints the report and writes it to --out. Exit 0 VALID, 1 INVALID, 2 no data.
Usage: frame_check.py --map <map.yaml> --out <file> [--scans 5] [--cells 2] [--min-hit 0.8]
"""
import argparse
import math
import os
import sys
import time

import rclpy
import yaml
from geometry_msgs.msg import PoseWithCovarianceStamped
from rclpy.node import Node
from rclpy.parameter import Parameter
from rclpy.qos import QoSProfile, DurabilityPolicy, ReliabilityPolicy, qos_profile_sensor_data
from rclpy.time import Time
from sensor_msgs.msg import LaserScan
from tf2_ros import Buffer, TransformListener


def read_pgm(path):
    with open(path, 'rb') as f:
        data = f.read()
    tokens, i = [], 0
    while len(tokens) < 4:
        while data[i:i + 1].isspace():
            i += 1
        if data[i:i + 1] == b'#':
            while data[i:i + 1] != b'\n':
                i += 1
            continue
        j = i
        while not data[j:j + 1].isspace():
            j += 1
        tokens.append(data[i:j])
        i = j
    assert tokens[0] == b'P5', 'only binary P5 pgm'
    w, h = int(tokens[1]), int(tokens[2])
    return w, h, data[i + 1:i + 1 + w * h]


def yaw_of(q):
    return math.atan2(2 * (q.w * q.z + q.x * q.y), 1 - 2 * (q.y * q.y + q.z * q.z))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--map', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--goals-yaml', default='parity/fixtures/goals.yaml')
    ap.add_argument('--scans', type=int, default=5)
    ap.add_argument('--cells', type=int, default=2)
    ap.add_argument('--min-hit', type=float, default=0.8)
    ap.add_argument('--control-dx', type=float, default=-2.0)
    ap.add_argument('--control-dy', type=float, default=-0.5)
    ap.add_argument('--limit', type=float, default=60.0, help='wall-clock seconds to collect the data')
    ap.add_argument('--base-frame', default='base_footprint', help="the robot base frame of the Nav2 config")
    args = ap.parse_args()

    with open(args.map) as f:
        my = yaml.safe_load(f)
    res, (ox, oy, _) = float(my['resolution']), my['origin']
    w, h, px = read_pgm(os.path.join(os.path.dirname(os.path.abspath(args.map)), my['image']))
    occ_max = int(round((1.0 - float(my['occupied_thresh'])) * 255))  # trinary, negate 0: pixel <= this = occupied
    with open(args.goals_yaml) as f:
        sp = yaml.safe_load(f)['start_pose']

    def occupied_near(x, y):
        c, r = int(math.floor((x - ox) / res)), h - 1 - int(math.floor((y - oy) / res))
        for dr in range(-args.cells, args.cells + 1):
            for dc in range(-args.cells, args.cells + 1):
                rr, cc = r + dr, c + dc
                if 0 <= rr < h and 0 <= cc < w and px[rr * w + cc] <= occ_max:
                    return True
        return False

    rclpy.init()
    node = Node('frame_check', parameter_overrides=[Parameter('use_sim_time', Parameter.Type.BOOL, True)])
    buf = Buffer()
    TransformListener(buf, node)
    st = {'amcl': None, 'scans': []}
    amcl_qos = QoSProfile(depth=1, reliability=ReliabilityPolicy.RELIABLE, durability=DurabilityPolicy.TRANSIENT_LOCAL)
    node.create_subscription(PoseWithCovarianceStamped, '/amcl_pose', lambda m: st.__setitem__('amcl', m), amcl_qos)
    node.create_subscription(LaserScan, '/scan', lambda m: st['scans'].append(m), qos_profile_sensor_data)

    lines = [f'# frame_check.py {time.strftime("%Y-%m-%dT%H:%M:%S%z")}  map={args.map}  goals={args.goals_yaml}',
             f'# criterion: hit >= {args.min_hit} within {args.cells} cells ({args.cells * res:.2f} m), '
             f'|amcl - start_pose| < 0.10 m, |TF - amcl| < 0.05 m']
    used, hits, ctrl_hits, total, tf_base = 0, 0, 0, 0, None
    end = time.monotonic() + args.limit
    # TF arrives on the same node: spin, and take each scan once its stamp can be transformed (drop after 2 s sim)
    while time.monotonic() < end and used < args.scans:
        rclpy.spin_once(node, timeout_sec=0.1)
        now = node.get_clock().now()
        for s in list(st['scans']):
            stamp = Time.from_msg(s.header.stamp)
            if not buf.can_transform('map', s.header.frame_id, stamp):
                if (now - stamp).nanoseconds > 2e9:
                    st['scans'].remove(s)
                    lines.append(f'scan {s.header.stamp.sec}.{s.header.stamp.nanosec:09d}: '
                                 f'no TF map->{s.header.frame_id} within 2 s sim')
                continue
            st['scans'].remove(s)
            if used >= args.scans:
                continue
            t = buf.lookup_transform('map', s.header.frame_id, stamp)
            tx, ty, yaw = t.transform.translation.x, t.transform.translation.y, yaw_of(t.transform.rotation)
            n = hit = chit = 0
            for k, r in enumerate(s.ranges):
                if not (s.range_min < r < s.range_max) or math.isinf(r) or math.isnan(r):
                    continue
                a = yaw + s.angle_min + k * s.angle_increment
                x, y = tx + r * math.cos(a), ty + r * math.sin(a)
                n += 1
                hit += occupied_near(x, y)
                chit += occupied_near(x + args.control_dx, y + args.control_dy)
            lines.append(f'scan stamp {s.header.stamp.sec}.{s.header.stamp.nanosec:09d} frame {s.header.frame_id}: '
                         f'TF ({tx:.3f}, {ty:.3f}, yaw {yaw:.3f}); {n} valid ranges, {hit} near occupied, '
                         f'control {chit}')
            used += 1
            total, hits, ctrl_hits = total + n, hits + hit, ctrl_hits + chit
    try:
        t = buf.lookup_transform('map', args.base_frame, Time())
        tf_base = (t.transform.translation.x, t.transform.translation.y, yaw_of(t.transform.rotation))
    except Exception as e:  # noqa: BLE001
        lines.append(f'TF map->{args.base_frame}: {e}')
    node.destroy_node()
    rclpy.shutdown()

    a = st['amcl']
    lines.append(f"goals.yaml start_pose: ({sp['position']['x']:.3f}, {sp['position']['y']:.3f}, yaw {sp['yaw']:.3f}) "
                 f"frame {sp['frame_id']}")
    if a is None or tf_base is None or total == 0:
        lines.append(f'NO DATA: amcl_pose={"yes" if a else "no"} tf_base={"yes" if tf_base else "no"} scan ranges={total}')
        verdict, code = 'NO DATA', 2
    else:
        ap_ = a.pose.pose
        axy = (ap_.position.x, ap_.position.y, yaw_of(ap_.orientation))
        d_start = math.hypot(axy[0] - sp['position']['x'], axy[1] - sp['position']['y'])
        d_tf = math.hypot(tf_base[0] - axy[0], tf_base[1] - axy[1])
        frac, cfrac = hits / total, ctrl_hits / total
        lines += [f'/amcl_pose: ({axy[0]:.3f}, {axy[1]:.3f}, yaw {axy[2]:.3f}) frame {a.header.frame_id} '
                  f'stamp {a.header.stamp.sec}.{a.header.stamp.nanosec:09d}; cov xx {a.pose.covariance[0]:.4f} '
                  f'yy {a.pose.covariance[7]:.4f} yawyaw {a.pose.covariance[35]:.4f}',
                  f'TF map->{args.base_frame} (latest): ({tf_base[0]:.3f}, {tf_base[1]:.3f}, yaw {tf_base[2]:.3f})',
                  f'|amcl - start_pose| = {d_start:.3f} m; |TF - amcl| = {d_tf:.3f} m',
                  f'scan hit fraction: {hits}/{total} = {frac:.3f} over {used} scans',
                  f'control (robot shifted by {args.control_dx}, {args.control_dy}): {ctrl_hits}/{total} = {cfrac:.3f}']
        ok = frac >= args.min_hit and d_start < 0.10 and d_tf < 0.05
        verdict, code = ('VALID' if ok else 'INVALID'), (0 if ok else 1)
    lines.append(f'VERDICT: {verdict}')
    with open(args.out, 'w') as f:
        f.write('\n'.join(lines) + '\n')
    print('\n'.join(lines))
    sys.exit(code)


if __name__ == '__main__':
    main()
