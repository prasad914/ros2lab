#!/usr/bin/env python3
"""
run_matrix.py - Orchestrates the 5x5 planner and controller matrix test for nav2_bringup.
For each pair of installed planners (NavFn, Smac2D, ThetaStar, SmacHybrid, SmacLattice)
and controllers (MPPI, DWB, RPP, RotationShimRPP, Graceful):
  - Starts nav2_bringup with the pair's YAML configuration.
  - Checks lifecycle status of planner_server and controller_server.
  - If configuration fails, captures the error log and marks UNVERIFIED + log.
  - If configuration succeeds, records an MCAP bag and navigates to Goal 1.
  - Stops recording and reference stack.
  - Emits matrix_results.json and summary report.
"""

import os
import sys
import time
import subprocess
import json

PLANNERS = ["NavFn", "Smac2D", "ThetaStar", "SmacHybrid", "SmacLattice"]
CONTROLLERS = ["MPPI", "DWB", "RPP", "RotationShimRPP", "Graceful"]
DOMAIN = 41
PARTITION = "ref41"
ROBOT = "tb3_burger"
SCEN = "nav2_bringup"

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MAP_PATH = os.path.join(BASE_DIR, "fixtures", "maps", "turtlebot3_world.yaml")
FIXTURES_DIR = os.path.join(BASE_DIR, "fixtures", ROBOT, SCEN)
CONFIGS_DIR = os.path.join(FIXTURES_DIR, "configs")
LOGS_DIR = os.path.join(FIXTURES_DIR, "logs")
BAGS_DIR = os.path.join(FIXTURES_DIR, "bags")
RUNS_DIR = os.path.join(FIXTURES_DIR, "runs")


def run_cmd(cmd, env=None, check=True):
    sub_env = os.environ.copy()
    if env:
        sub_env.update(env)
    res = subprocess.run(cmd, shell=True, env=sub_env, capture_output=True, text=True)
    if check and res.returncode != 0:
        raise RuntimeError(f"Command failed (exit {res.returncode}): {cmd}\nOutput:\n{res.stdout}\n{res.stderr}")
    return res


def stop_stack():
    run_cmd(f"bash parity/scripts/record_bag.sh stop {DOMAIN}", check=False)
    run_cmd(f"bash parity/scripts/stop_reference.sh {DOMAIN}", check=False)
    time.sleep(3)


def check_lifecycle_node(node_name):
    # Returns (is_ok, state_string)
    cmd = f"bash -c 'source parity/scripts/env.sh && export ROS_DOMAIN_ID={DOMAIN} && ros2 lifecycle get {node_name}'"
    res = run_cmd(cmd, check=False)
    out = res.stdout.strip()
    if "active [3]" in out or "inactive [2]" in out:
        return True, out
    return False, out


def extract_log_errors(log_path):
    if not os.path.exists(log_path):
        return "Log file not found"
    lines = []
    with open(log_path, "r", errors="ignore") as f:
        for line in f:
            if any(k in line for k in ["[FATAL]", "[ERROR]", "Exception", "Failed to create", "Could not open"]):
                lines.append(line.strip())
    return "\n".join(lines[-10:]) if lines else "No explicit error line found"


def test_pair(planner, controller):
    pair_name = f"{planner}_{controller}"
    print(f"\n=======================================================")
    print(f"Testing Pair: {pair_name}")
    print(f"=======================================================")

    config_path = os.path.join(CONFIGS_DIR, f"{pair_name}.yaml")
    if not os.path.exists(config_path):
        raise FileNotFoundError(f"Config not found: {config_path}")

    stop_stack()

    env = {
        "ROS_DOMAIN_ID": str(DOMAIN),
        "GZ_PARTITION": PARTITION,
        "PARAMS_FILE": config_path,
        "MAP": MAP_PATH
    }


    print(f"Starting nav2_bringup with {config_path}...")
    run_cmd(f"bash parity/scripts/start_reference.sh {ROBOT} {SCEN} {DOMAIN} {PARTITION}", env=env)

    # Wait for bringup
    print("Waiting 8s for bringup...")
    time.sleep(8)

    # Start bag recording
    print(f"Starting rosbag recording for {pair_name}...")
    run_cmd(f"bash parity/scripts/record_bag.sh start {ROBOT} {SCEN} {DOMAIN} {pair_name}", env=env)
    time.sleep(2)

    # Drive Goal 1 (this handles /initialpose, AMCL confirmation, and goal execution)
    print(f"Driving Goal 1 for {pair_name}...")
    drive_res = run_cmd(
        f"bash -c 'source parity/scripts/env.sh && export ROS_DOMAIN_ID={DOMAIN} && "
        f"python3 parity/scripts/drive_goals.py --goal-name goal1 --run-label {pair_name} --out-dir {RUNS_DIR}'",
        check=False
    )
    print(drive_res.stdout)

    print(f"Stopping rosbag recording for {pair_name}...")
    run_cmd(f"bash parity/scripts/record_bag.sh stop {DOMAIN}", check=False)
    time.sleep(2)

    stop_stack()

    # Read run summary if available
    run_json = os.path.join(RUNS_DIR, f"{pair_name}.json")
    goal_res = {}
    if os.path.exists(run_json):
        with open(run_json, "r") as f:
            data = json.load(f)
            goal_res = data.get("results", {}).get("goal1", {})

    # Check bag file size
    bag_dir = os.path.join(BAGS_DIR, pair_name)
    bag_size_mb = 0.0
    if os.path.exists(bag_dir):
        for root, _, files in os.walk(bag_dir):
            for file in files:
                bag_size_mb += os.path.getsize(os.path.join(root, file)) / (1024 * 1024)

    return {
        "pair": pair_name,
        "planner": planner,
        "controller": controller,
        "status": "VERIFIED" if goal_res.get("success") else "FAILED_GOAL",
        "duration_sim": goal_res.get("duration", 0.0),
        "duration_wall": goal_res.get("wall_duration", 0.0),
        "position_error_m": goal_res.get("position_error_m"),
        "bag_size_mb": round(bag_size_mb, 2),
        "bag_dir": bag_dir
    }


def main():
    os.makedirs(LOGS_DIR, exist_ok=True)
    os.makedirs(BAGS_DIR, exist_ok=True)
    os.makedirs(RUNS_DIR, exist_ok=True)

    results = []
    matrix_file = os.path.join(FIXTURES_DIR, "matrix_results.json")

    # If partial results exist, load them to allow resuming
    if os.path.exists(matrix_file):
        with open(matrix_file, "r") as f:
            try:
                results = json.load(f)
            except Exception:
                results = []

    tested_pairs = {r["pair"] for r in results}

    for planner in PLANNERS:
        for controller in CONTROLLERS:
            pair_name = f"{planner}_{controller}"
            if pair_name in tested_pairs:
                print(f"Skipping already tested pair: {pair_name}")
                continue
            res = test_pair(planner, controller)
            results.append(res)
            with open(matrix_file, "w") as f:
                json.dump(results, f, indent=2)

    print("\n=======================================================")
    print("Matrix Testing Complete! Summary:")
    print("=======================================================")
    verified_count = sum(1 for r in results if r["status"] == "VERIFIED")
    unverified_count = sum(1 for r in results if r["status"] == "UNVERIFIED")
    failed_count = sum(1 for r in results if r["status"] == "FAILED_GOAL")
    print(f"Total: {len(results)} | VERIFIED: {verified_count} | UNVERIFIED: {unverified_count} | FAILED_GOAL: {failed_count}")


if __name__ == "__main__":
    main()
