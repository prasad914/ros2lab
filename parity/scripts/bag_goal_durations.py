#!/usr/bin/env python3
"""Compare drive_goals.py goal durations (runs/run<N>.json) with each run's bag.

Bag span: bt_navigator NavigateRecovery first RUNNING -> next SUCCESS/FAILURE on /behavior_tree_log, using the bag's
receive time (the recorder runs with --use-sim-time, so this is sim time). Prints, per goal, json/bag seconds.
A goal with no closing event in the bag prints nan.
Usage: bag_goal_durations.py <nav fixture dir, e.g. parity/fixtures/tb3_burger/nav_robotis> [runs, default 1..10]
"""
import json
import sys

import rosbag2_py
from nav2_msgs.msg import BehaviorTreeLog
from rclpy.serialization import deserialize_message


def bag_spans(bag):
    r = rosbag2_py.SequentialReader()
    r.open(rosbag2_py.StorageOptions(uri=bag, storage_id='mcap'), rosbag2_py.ConverterOptions('cdr', 'cdr'))
    r.set_filter(rosbag2_py.StorageFilter(topics=['/behavior_tree_log']))
    spans, start = [], None
    while r.has_next():
        _, data, ts = r.read_next()
        for e in deserialize_message(data, BehaviorTreeLog).event_log:
            if e.node_name != 'NavigateRecovery':
                continue
            if e.current_status == 'RUNNING' and start is None:
                start = ts * 1e-9
            elif e.current_status in ('SUCCESS', 'FAILURE') and start is not None:
                spans.append((e.current_status, ts * 1e-9 - start))
                start = None
    return spans


def main():
    base = sys.argv[1]
    runs = [int(x) for x in sys.argv[2:]] or range(1, 11)
    print('# json = drive_goals.py duration (s sim), bag = NavigateRecovery span in the bag (s sim)')
    for i in runs:
        spans = bag_spans(f'{base}/bags/run{i}')
        res = json.load(open(f'{base}/runs/run{i}.json'))['results']
        cells = []
        for k, (g, v) in enumerate(res.items()):
            st, d = spans[k] if k < len(spans) else ('none', float('nan'))
            cells.append(f'{g} json {v["duration"]:.2f} bag {d:.2f} {st} diff {d - v["duration"]:.2f}')
        print(f'run{i}: ' + ' | '.join(cells))


if __name__ == '__main__':
    main()
