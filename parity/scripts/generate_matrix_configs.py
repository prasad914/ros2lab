#!/usr/bin/env python3
"""
generate_matrix_configs.py - One params file per planner x controller pair for the nav2_bringup matrix.

Each pair starts from the INSTALLED nav2_bringup params (/opt/ros/jazzy/share/nav2_bringup/params/nav2_params.yaml)
and changes only what the pair needs: the plugin name of planner_server.GridBased / controller_server.FollowPath,
plus the parameters that plugin cannot load without (CHANGES below, each with its reason). Every other key,
including the installed MPPI keys left under FollowPath, stays as installed.

Writes <out_root>/<pair>/params.yaml and <out_root>/<pair>/params.diff (the list of changed keys, then a unified diff
of the installed file against params.yaml, both dumped by PyYAML with sorted keys so only real changes show).
Usage: generate_matrix_configs.py [<out_root>]   (default parity/fixtures/tb3_burger/nav2_bringup/matrix)
"""
import copy
import difflib
import os
import sys

import yaml

BASE_PARAMS_PATH = "/opt/ros/jazzy/share/nav2_bringup/params/nav2_params.yaml"
LATTICE = ("/opt/ros/jazzy/share/nav2_smac_planner/sample_primitives/5cm_resolution/"
           "0.5m_turning_radius/diff/output.json")
# DWB critic names: the FollowPath block of the installed nav2_bringup/params/nav2_multirobot_params_all.yaml
DWB_CRITICS_SRC = "/opt/ros/jazzy/share/nav2_bringup/params/nav2_multirobot_params_all.yaml"

PLANNERS = ["NavFn", "Smac2D", "ThetaStar", "SmacHybrid", "SmacLattice"]
CONTROLLERS = ["MPPI", "DWB", "RPP", "RotationShimRPP", "Graceful"]
GB = ("planner_server", "GridBased")
FP = ("controller_server", "FollowPath")


def dwb_critics():
    with open(DWB_CRITICS_SRC) as f:
        return yaml.safe_load(f)["controller_server"]["ros__parameters"]["FollowPath"]["critics"]


# (node, plugin id) -> list of (key, value, reason). The installed file already is NavFn + MPPI.
CHANGES = {
    "NavFn": [],
    "Smac2D": [(GB, "plugin", "nav2_smac_planner::SmacPlanner2D", "plugin name")],
    "ThetaStar": [(GB, "plugin", "nav2_theta_star_planner::ThetaStarPlanner", "plugin name")],
    "SmacHybrid": [(GB, "plugin", "nav2_smac_planner::SmacPlannerHybrid", "plugin name")],
    "SmacLattice": [(GB, "plugin", "nav2_smac_planner::SmacPlannerLattice", "plugin name"),
                    (GB, "lattice_filepath", LATTICE, "required: the installed diff-drive primitives")],
    "MPPI": [],
    "DWB": [(FP, "plugin", "dwb_core::DWBLocalPlanner", "plugin name"),
            (FP, "critics", None, "the installed key holds MPPI critic names, which DWB would try to load as "
                                  f"DWB critics; DWB's list from {DWB_CRITICS_SRC}")],
    "RPP": [(FP, "plugin", "nav2_regulated_pure_pursuit_controller::RegulatedPurePursuitController", "plugin name")],
    "RotationShimRPP": [(FP, "plugin", "nav2_rotation_shim_controller::RotationShimController", "plugin name"),
                        (FP, "primary_controller",
                         "nav2_regulated_pure_pursuit_controller::RegulatedPurePursuitController",
                         "required: the controller the shim hands over to")],
    "Graceful": [(FP, "plugin", "nav2_graceful_controller::GracefulController", "plugin name")],
}


def dump(cfg):
    return yaml.safe_dump(cfg, default_flow_style=False, sort_keys=True).splitlines(keepends=True)


def generate_pair(planner, controller, out_dir):
    with open(BASE_PARAMS_PATH) as f:
        base = yaml.safe_load(f)
    cfg = copy.deepcopy(base)
    changed = []
    for (node, plugin_id), key, value, reason in CHANGES[planner] + CHANGES[controller]:
        if value is None and key == "critics":
            value = dwb_critics()
        block = cfg[node]["ros__parameters"][plugin_id]
        changed.append(f"# {node}.{plugin_id}.{key}: {block.get(key, '<not set>')!r} -> {value!r}  ({reason})\n")
        block[key] = value

    os.makedirs(out_dir, exist_ok=True)
    with open(os.path.join(out_dir, "params.yaml"), "w") as f:
        yaml.safe_dump(cfg, f, default_flow_style=False, sort_keys=False)
    with open(os.path.join(out_dir, "params.diff"), "w") as f:
        f.write(f"# {planner} x {controller}: changes against {BASE_PARAMS_PATH}\n")
        f.write(f"# written by parity/scripts/generate_matrix_configs.py; {len(changed)} key(s) changed\n")
        f.writelines(changed or ["# none: the pair is the installed file\n"])
        f.writelines(difflib.unified_diff(dump(base), dump(cfg), "installed/nav2_params.yaml", f"{planner}_{controller}/params.yaml"))
    return os.path.join(out_dir, "params.yaml")


if __name__ == "__main__":
    out_root = sys.argv[1] if len(sys.argv) > 1 else "parity/fixtures/tb3_burger/nav2_bringup/matrix"
    for p in PLANNERS:
        for c in CONTROLLERS:
            generate_pair(p, c, os.path.join(out_root, f"{p}_{c}"))
    print(f"Generated {len(PLANNERS) * len(CONTROLLERS)} pairs in {out_root}")
