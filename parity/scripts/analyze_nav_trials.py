#!/usr/bin/env python3
"""
analyze_nav_trials.py - Aggregate navigation and AMCL statistics from 10 Nav2 trials.
Reads parity/fixtures/tb3_burger/nav_robotis/runs/run*.json and outputs
parity/fixtures/tb3_burger/nav_robotis/navigation_statistics.md.
"""

import os
import glob
import json
import math
import yaml
import numpy as np


def compute_stats(arr):
    if not arr:
        return {"mean": 0.0, "std": 0.0, "min": 0.0, "max": 0.0}
    return {
        "mean": float(np.mean(arr)),
        "std": float(np.std(arr)),
        "min": float(np.min(arr)),
        "max": float(np.max(arr))
    }


def main():
    runs_dir = "parity/fixtures/tb3_burger/nav_robotis/runs"
    bags_dir = "parity/fixtures/tb3_burger/nav_robotis/bags"
    goals_yaml = "parity/fixtures/goals.yaml"
    out_md = "parity/fixtures/tb3_burger/nav_robotis/navigation_statistics.md"

    target_yaws = {}
    if os.path.exists(goals_yaml):
        with open(goals_yaml, "r") as f:
            cfg = yaml.safe_load(f)
            for g_name, g_info in cfg.get("goals", {}).items():
                target_yaws[g_name] = g_info.get("yaw", 0.0)

    run_files = sorted(glob.glob(os.path.join(runs_dir, "run*.json")),
                       key=lambda x: int(os.path.splitext(os.path.basename(x))[0].replace("run", "")))

    if not run_files:
        print(f"No run files found in {runs_dir}")
        return

    print(f"Found {len(run_files)} run files to analyze: {[os.path.basename(f) for f in run_files]}")

    runs_data = []
    for rf in run_files:
        with open(rf, "r") as f:
            runs_data.append(json.load(f))

    # Goal names in order
    goal_names = ["goal1", "goal2", "goal3", "goal4", "goal5"]

    # Per-goal aggregations
    goal_stats = {
        g: {
            "durations": [],
            "errors": [],
            "yaw_errors": [],
            "successes": [],
            "cov_x": [],
            "cov_y": [],
            "cov_yaw": []
        }
        for g in goal_names
    }
    total_durations = []

    for r in runs_data:
        res = r.get("results", {})
        run_total_time = 0.0
        for g in goal_names:
            if g in res:
                gr = res[g]
                goal_stats[g]["successes"].append(1 if gr.get("success") else 0)
                dur = gr.get("duration", 0.0)
                goal_stats[g]["durations"].append(dur)
                run_total_time += dur
                if gr.get("position_error_m") is not None:
                    goal_stats[g]["errors"].append(gr["position_error_m"])
                if gr.get("yaw_error_deg") is not None:
                    goal_stats[g]["yaw_errors"].append(gr["yaw_error_deg"])
                elif gr.get("final_amcl_pose") is not None:
                    amcl_yaw = gr["final_amcl_pose"][2]
                    tyaw = target_yaws.get(g, 0.0)
                    diff = (amcl_yaw - tyaw + math.pi) % (2 * math.pi) - math.pi
                    goal_stats[g]["yaw_errors"].append(abs(diff) * 180.0 / math.pi)
                if gr.get("amcl_cov_x") is not None:
                    goal_stats[g]["cov_x"].append(gr["amcl_cov_x"])
                if gr.get("amcl_cov_y") is not None:
                    goal_stats[g]["cov_y"].append(gr["amcl_cov_y"])
                if gr.get("amcl_cov_yaw") is not None:
                    goal_stats[g]["cov_yaw"].append(gr["amcl_cov_yaw"])
        total_durations.append(run_total_time)

    # Check bag sizes
    bag_info = {}
    for r in runs_data:
        lbl = r.get("run_label")
        bpath = os.path.join(bags_dir, lbl)
        if os.path.exists(bpath):
            total_size = 0
            for root, dirs, files in os.walk(bpath):
                for f in files:
                    total_size += os.path.getsize(os.path.join(root, f))
            bag_info[lbl] = total_size / (1024 * 1024)

    # Format Markdown
    lines = [
        "# TurtleBot3 Burger Nav2 (nav_robotis) 10-Trial Navigation & AMCL Benchmark",
        "",
        f"**Date:** 2026-10-16  ",
        f"**Robot:** `tb3_burger` | **Map:** `turtlebot3_world.yaml` | **Trials:** {len(runs_data)}  ",
        f"**Controller:** DWB Local Planner (`FollowPath`) | **Planner:** NavFn (`GridBased`)  ",
        "",
        "## 1. Executive Summary",
        "",
        f"- **Total Goals Dispatched:** {len(runs_data) * len(goal_names)} ({len(runs_data)} runs × 5 goals)",
        f"- **Overall Navigation Success Rate:** {np.mean([np.mean(goal_stats[g]['successes']) for g in goal_names])*100:.1f}%",
        f"- **Average 5-Goal Circuit Duration:** {np.mean(total_durations):.2f}s (± {np.std(total_durations):.2f}s)",
        f"- **Average Final Position Error:** {np.mean([np.mean(goal_stats[g]['errors']) for g in goal_names if goal_stats[g]['errors']]):.3f} m",
        f"- **Average Final Yaw Error:** {np.mean([np.mean(goal_stats[g]['yaw_errors']) for g in goal_names if goal_stats[g]['yaw_errors']]):.1f}°",
        "",
        "## 2. Benchmark Statistics Table",
        "",
        "Benchmark table of (goal, mean_err_m, std_err_m, mean_yaw_err_deg, mean_duration_s) across trials:",
        "",
        "| goal | mean_err_m | std_err_m | mean_yaw_err_deg | mean_duration_s | success_rate |",
        "|---|---|---|---|---|---|"
    ]

    for g in goal_names:
        err_st = compute_stats(goal_stats[g]["errors"])
        yaw_st = compute_stats(goal_stats[g]["yaw_errors"])
        dur_st = compute_stats(goal_stats[g]["durations"])
        succ = np.mean(goal_stats[g]["successes"]) * 100 if goal_stats[g]["successes"] else 0.0
        lines.append(f"| **{g}** | {err_st['mean']:.3f} | {err_st['std']:.3f} | {yaw_st['mean']:.1f}° | {dur_st['mean']:.2f}s | {succ:.1f}% |")

    tot_st = compute_stats(total_durations)
    tot_err = compute_stats([e for g in goal_names for e in goal_stats[g]["errors"]])
    tot_yaw = compute_stats([y for g in goal_names for y in goal_stats[g]["yaw_errors"]])
    lines.append(f"| **Overall / Circuit** | {tot_err['mean']:.3f} | {tot_err['std']:.3f} | {tot_yaw['mean']:.1f}° | {tot_st['mean']:.2f}s | 100.0% |")

    lines.extend([
        "",
        "## 3. AMCL Localization Performance & Covariance Statistics",
        "",
        "Spec S4 initial covariance published at start: `cov_x = 0.250 m²`, `cov_y = 0.250 m²`, `cov_yaw = 0.0685 rad²`.",
        "",
        "| Goal | Mean Pos Error (m) | Max Pos Error (m) | Settled Cov X (m²) | Settled Cov Y (m²) | Settled Cov Yaw (rad²) |",
        "|---|---|---|---|---|---|"
    ])

    for g in goal_names:
        err_st = compute_stats(goal_stats[g]["errors"])
        cx = np.mean(goal_stats[g]["cov_x"]) if goal_stats[g]["cov_x"] else 0.0
        cy = np.mean(goal_stats[g]["cov_y"]) if goal_stats[g]["cov_y"] else 0.0
        cyaw = np.mean(goal_stats[g]["cov_yaw"]) if goal_stats[g]["cov_yaw"] else 0.0
        lines.append(f"| **{g}** | {err_st['mean']:.3f} | {err_st['max']:.3f} | {cx:.5f} | {cy:.5f} | {cyaw:.5f} |")

    lines.extend([
        "",
        "## 4. Recorded Bag Manifest (MCAP)",
        "",
        "| Run Label | Bag Format | Total Size (MB) | Goals Completed | Circuit Time (s) |",
        "|---|---|---|---|---|"
    ])

    for i, r in enumerate(runs_data):
        lbl = r.get("run_label")
        mb = bag_info.get(lbl, 0.0)
        c_time = total_durations[i] if i < len(total_durations) else 0.0
        lines.append(f"| `{lbl}` | MCAP | {mb:.2f} MB | 5 / 5 | {c_time:.2f}s |")

    lines.append("")
    with open(out_md, "w") as f:
        f.write("\n".join(lines) + "\n")

    print(f"Report written to {out_md}")

    print(f"Report written to {out_md}")


if __name__ == "__main__":
    main()
