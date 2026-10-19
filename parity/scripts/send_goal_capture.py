#!/usr/bin/env python3
"""Send one goal (from goals.yaml, or an ad-hoc map point) through navigate_to_pose and save what the action returns.

Writes into --out-dir:
  result.json     goal, accepted, status (number and name), every field of the result message
                  (Jazzy: error_code, error_msg), sim and wall time of accept and result
  feedback.jsonl  every feedback message, one JSON object per line, with the sim time it was received
Durations are sim time (node clock, use_sim_time). Wall times are kept to cut the launch logs to this goal.
Usage: send_goal_capture.py --goal <goal1|...|obstacle_goal> --out-dir <dir> [--timeout 180] [--goals-yaml f]
       send_goal_capture.py --name <label> --x <m> --y <m> [--yaw <rad>] --out-dir <dir>   (map frame, not in goals.yaml)
"""
import argparse
import json
import math
import os
import time

import rclpy
import yaml
from action_msgs.msg import GoalStatus
from nav2_msgs.action import NavigateToPose
from rclpy.action import ActionClient
from rclpy.node import Node
from rclpy.parameter import Parameter
from rosidl_runtime_py import message_to_ordereddict

STATUS = {v: k[len('STATUS_'):] for k, v in vars(GoalStatus).items() if k.startswith('STATUS_')}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--goal', help='a goal of goals.yaml')
    ap.add_argument('--name', help='label of an ad-hoc point given with --x/--y')
    ap.add_argument('--x', type=float)
    ap.add_argument('--y', type=float)
    ap.add_argument('--yaw', type=float, default=0.0)
    ap.add_argument('--out-dir', required=True)
    ap.add_argument('--timeout', type=float, default=180.0, help='sim seconds before the goal is cancelled')
    ap.add_argument('--goals-yaml', default='parity/fixtures/goals.yaml')
    args = ap.parse_args()
    if args.goal:
        with open(args.goals_yaml) as f:
            cfg = yaml.safe_load(f)
        g = cfg['obstacle_goal'] if args.goal == 'obstacle_goal' else cfg['goals'][args.goal]
        name, source = args.goal, args.goals_yaml
    elif args.name and args.x is not None and args.y is not None:
        g = {'frame_id': 'map', 'position': {'x': args.x, 'y': args.y, 'z': 0.0},
             'orientation': {'x': 0.0, 'y': 0.0, 'z': math.sin(args.yaw / 2), 'w': math.cos(args.yaw / 2)}}
        name, source = args.name, 'command line (--x/--y/--yaw)'
    else:
        ap.error('give --goal, or --name with --x and --y')
    os.makedirs(args.out_dir, exist_ok=True)

    rclpy.init()
    node = Node('send_goal_capture', parameter_overrides=[Parameter('use_sim_time', Parameter.Type.BOOL, True)])
    client = ActionClient(node, NavigateToPose, 'navigate_to_pose')
    sim = lambda: node.get_clock().now().nanoseconds / 1e9
    out = {'goal_name': name, 'goal_source': source, 'goal_yaml': g}
    if not client.wait_for_server(timeout_sec=60.0):
        out['error'] = 'navigate_to_pose server not available after 60 s wall'
        json.dump(out, open(os.path.join(args.out_dir, 'result.json'), 'w'), indent=2)
        raise SystemExit(1)
    for _ in range(10):  # receive /clock before the first sim stamp
        rclpy.spin_once(node, timeout_sec=0.1)

    goal = NavigateToPose.Goal()
    goal.pose.header.frame_id = g.get('frame_id', 'map')
    goal.pose.header.stamp = node.get_clock().now().to_msg()
    for k in ('x', 'y', 'z'):
        setattr(goal.pose.pose.position, k, float(g['position'][k]))
    for k in ('x', 'y', 'z', 'w'):
        setattr(goal.pose.pose.orientation, k, float(g['orientation'][k]))
    out['goal_msg'] = message_to_ordereddict(goal)

    fb_file = open(os.path.join(args.out_dir, 'feedback.jsonl'), 'w')

    def on_feedback(fb):
        fb_file.write(json.dumps({'recv_sim': sim(), 'recv_wall': time.time(),
                                  'feedback': message_to_ordereddict(fb.feedback)}) + '\n')

    out['send_wall'] = time.time()
    out['send_sim'] = sim()
    fut = client.send_goal_async(goal, feedback_callback=on_feedback)
    rclpy.spin_until_future_complete(node, fut, timeout_sec=10.0)
    if not fut.done():
        out['error'] = 'send_goal_async: no answer within 10 s wall'
    else:
        handle = fut.result()
        out['accepted'] = handle.accepted
        out['response_wall'] = time.time()
        out['response_sim'] = sim()
        if handle.accepted:
            res_fut = handle.get_result_async()
            t0 = sim()
            while not res_fut.done():
                rclpy.spin_once(node, timeout_sec=0.2)
                if sim() - t0 > args.timeout:
                    out['timed_out_after_sim_s'] = sim() - t0
                    c = handle.cancel_goal_async()
                    rclpy.spin_until_future_complete(node, c, timeout_sec=5.0)
                    rclpy.spin_until_future_complete(node, res_fut, timeout_sec=10.0)
                    break
            if res_fut.done():
                r = res_fut.result()
                out['status'] = r.status
                out['status_name'] = STATUS.get(r.status, '?')
                out['result'] = message_to_ordereddict(r.result)
            out['result_wall'] = time.time()
            out['result_sim'] = sim()
            out['duration_sim_s'] = out['result_sim'] - out['response_sim']
    fb_file.close()
    with open(os.path.join(args.out_dir, 'result.json'), 'w') as f:
        json.dump(out, f, indent=2, default=str)
    print(json.dumps({k: out.get(k) for k in ('goal_name', 'accepted', 'status', 'status_name', 'result',
                                               'duration_sim_s')}, default=str))
    node.destroy_node()
    rclpy.shutdown()


if __name__ == '__main__':
    main()
