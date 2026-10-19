#!/usr/bin/env python3
"""Compare matching P9-round2 browser observations with real scenario fixtures."""
import json
import os
import re

ROOT = "/home/prasad/ros2lab-course/parity"
CASES = {
    "tb3_burger": ["sensors", "slam", "cartographer", "nav_robotis"],
    "tb3_waffle": ["sensors"],
    "tb3_waffle_pi": ["sensors"],
}


def read_browser(robot, scenario):
    directory = os.path.join(ROOT, "browser_out", robot, "p9-round2", scenario)
    for filename in ("snapshot.json", "emulator-state.json"):
        path = os.path.join(directory, filename)
        if os.path.isfile(path):
            with open(path, encoding="utf-8") as stream:
                data = json.load(stream)
            return data.get("state", data), path
    return None, None


def fixture_edges(path):
    if not os.path.isfile(path):
        return set()
    text = open(path, encoding="utf-8").read()
    return set(re.findall(r'"([^" ]+)"\s*->\s*"([^" ]+)"', text))


for robot, scenarios in CASES.items():
    for scenario in scenarios:
        fixture = os.path.join(ROOT, "fixtures", robot, scenario)
        topics_path = os.path.join(fixture, "topic_list.txt")
        browser, browser_path = read_browser(robot, scenario)
        print(f"\n{robot}/{scenario}")
        if not os.path.isdir(fixture):
            print("  PENDING: no matching real scenario fixture")
            continue
        if not browser:
            print("  PENDING: no matching browser observation")
            continue
        if not os.path.isfile(topics_path):
            print("  PENDING: real topic list unavailable")
        else:
            real_topics = {}
            for line in open(topics_path, encoding="utf-8"):
                match = re.match(r"(/\S+)\s+\[(.+)\]", line.strip())
                if match:
                    real_topics[match.group(1)] = match.group(2)
            state = browser.get("state", browser)
            browser_topics = {x["name"]: x.get("type", "?") for x in state.get("topics", [])}
            shared = set(real_topics) & set(browser_topics)
            exact = sorted(name for name in shared if real_topics[name] == browser_topics[name])
            missing = sorted(set(real_topics) - set(browser_topics))
            extra = sorted(set(browser_topics) - set(real_topics))
            print(f"  Interface topic/type overlap: {len(exact)}/{len(real_topics)} fixture topics exact")
            print(f"  Expected fixture-only topics (browser missing): {missing}")
            print(f"  Browser-only topics: {extra}")
            print(f"  Evidence: {topics_path}; {browser_path}")
        gv = next((os.path.join(fixture, f) for f in os.listdir(fixture) if f.endswith(".gv")), None)
        if gv:
            state = browser.get("state", browser)
            tf = state.get("tf", state.get("tfFramesEdgesAuthority", {}))
            real_edges = fixture_edges(gv)
            browser_edges = {(e.get("parent"), e.get("child")) for e in tf.get("edges", [])}
            print(f"  TF edges: fixture {len(real_edges)}, browser {len(browser_edges)}, shared {len(real_edges & browser_edges)}")
            print(f"  Fixture edges missing in browser: {sorted(real_edges-browser_edges)}")
            print(f"  Browser-only edges: {sorted(browser_edges-real_edges)}")
            print(f"  Evidence: {gv}; {browser_path}")
        if scenario in ("slam", "cartographer"):
            print("  SLAM occupancy IoU: PENDING (browser map absent; no aligned map pair)")
        if scenario == "nav_robotis":
            print("  Path/trajectory/costmap/localisation: PENDING (browser plan, odom, costmaps and AMCL absent)")
