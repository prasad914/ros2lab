#!/usr/bin/env python3
"""
matrix_configs.py - Generates parameter YAML configurations for all 5 planners
and 5 controllers in Nav2 Jazzy.
"""

import os
import yaml
import copy

BASE_PARAMS_PATH = "/opt/ros/jazzy/share/nav2_bringup/params/nav2_params.yaml"

PLANNERS = {
    "NavFn": {
        "plugin": "nav2_navfn_planner::NavfnPlanner",
        "tolerance": 0.5,
        "use_astar": False,
        "allow_unknown": True,
    },
    "Smac2D": {
        "plugin": "nav2_smac_planner::SmacPlanner2D",
        "tolerance": 0.5,
        "downsample_costmap": False,
        "downsampling_factor": 1,
        "allow_unknown": True,
        "max_iterations": 1000000,
        "max_on_approach_iterations": 1000,
        "terminal_checking_interval": 5000,
        "smooth_path": True,
        "cost_travel_multiplier": 2.0,
    },
    "ThetaStar": {
        "plugin": "nav2_theta_star_planner::ThetaStarPlanner",
        "how_many_corners": 8,
        "w_euc_cost": 1.0,
        "w_traversal_cost": 2.0,
        "allow_unknown": True,
    },
    "SmacHybrid": {
        "plugin": "nav2_smac_planner::SmacPlannerHybrid",
        "downsample_costmap": False,
        "downsampling_factor": 1,
        "tolerance": 0.5,
        "allow_unknown": True,
        "max_iterations": 1000000,
        "max_on_approach_iterations": 1000,
        "terminal_checking_interval": 5000,
        "smooth_path": True,
        "motion_model_for_search": "DUBIN",
        "angle_quantization_bins": 72,
        "minimum_turning_radius_global_coords": 0.2,
        "reverse_penalty": 2.0,
        "change_penalty": 0.05,
        "non_straight_penalty": 1.2,
        "cost_penalty": 2.0,
        "retrospective_penalty": 0.01,
    },
    "SmacLattice": {
        "plugin": "nav2_smac_planner::SmacPlannerLattice",
        "allow_unknown": True,
        "tolerance": 0.5,
        "max_iterations": 1000000,
        "max_on_approach_iterations": 1000,
        "terminal_checking_interval": 5000,
        "smooth_path": True,
        "lattice_filepath": "",  # Intentionally empty: requires external lattice JSON file
    },
}

CONTROLLERS = {
    "MPPI": {
        # MPPI is already present in nav2_params.yaml
    },
    "DWB": {
        "plugin": "dwb_core::DWBLocalPlanner",
        "debug_trajectory_details": False,
        "min_vel_x": 0.0,
        "min_vel_y": 0.0,
        "max_vel_x": 0.26,
        "max_vel_y": 0.0,
        "max_vel_theta": 1.0,
        "min_speed_xy": 0.0,
        "max_speed_xy": 0.26,
        "min_speed_theta": 0.0,
        "acc_lim_x": 2.5,
        "acc_lim_y": 0.0,
        "acc_lim_theta": 3.2,
        "decel_lim_x": -2.5,
        "decel_lim_y": 0.0,
        "decel_lim_theta": -3.2,
        "vx_samples": 20,
        "vy_samples": 0,
        "vtheta_samples": 20,
        "sim_time": 1.7,
        "linear_granularity": 0.05,
        "angular_granularity": 0.025,
        "transform_tolerance": 0.2,
        "xy_goal_tolerance": 0.25,
        "trans_stopped_velocity": 0.25,
        "short_circuit_trajectory_evaluation": True,
        "stateful": True,
        "critics": ["RotateToGoal", "Oscillation", "BaseObstacle", "GoalAlign", "PathAlign", "PathDist", "GoalDist"],
        "BaseObstacle.scale": 0.02,
        "PathAlign.scale": 32.0,
        "PathAlign.forward_point_distance": 0.1,
        "GoalAlign.scale": 24.0,
        "GoalAlign.forward_point_distance": 0.1,
        "PathDist.scale": 32.0,
        "GoalDist.scale": 24.0,
        "RotateToGoal.scale": 32.0,
        "RotateToGoal.slowing_factor": 5.0,
        "RotateToGoal.lookahead_time": -1.0,
    },
    "RPP": {
        "plugin": "nav2_regulated_pure_pursuit_controller::RegulatedPurePursuitController",
        "desired_linear_vel": 0.22,
        "lookahead_dist": 0.4,
        "min_lookahead_dist": 0.2,
        "max_lookahead_dist": 0.6,
        "lookahead_time": 1.5,
        "rotate_to_heading_angular_vel": 1.0,
        "transform_tolerance": 0.2,
        "use_velocity_scaled_lookahead_dist": False,
        "min_approach_linear_velocity": 0.05,
        "approach_velocity_scaling_dist": 0.6,
        "use_collision_detection": True,
        "max_allowed_time_to_collision_up_to_carrot": 1.0,
        "use_regulated_linear_velocity_scaling": True,
        "use_cost_regulated_linear_velocity_scaling": False,
        "cost_scaling_dist": 0.3,
        "cost_scaling_gain": 1.0,
        "inflation_cost_scaling_factor": 3.0,
        "max_angular_accel": 3.2,
        "rotate_to_heading_min_angle": 0.785,
        "allow_reversing": False,
    },
    "RotationShimRPP": {
        "plugin": "nav2_rotation_shim_controller::RotationShimController",
        "primary_controller": "nav2_regulated_pure_pursuit_controller::RegulatedPurePursuitController",
        "angular_dist_threshold": 0.785,
        "forward_prune_distance": 1.0,
        "rotate_to_heading_angular_vel": 1.0,
        "max_angular_accel": 3.2,
        "simulate_ahead_time": 1.0,
        "desired_linear_vel": 0.22,
        "lookahead_dist": 0.4,
        "min_lookahead_dist": 0.2,
        "max_lookahead_dist": 0.6,
        "lookahead_time": 1.5,
        "transform_tolerance": 0.2,
        "use_velocity_scaled_lookahead_dist": False,
        "min_approach_linear_velocity": 0.05,
        "approach_velocity_scaling_dist": 0.6,
        "use_collision_detection": True,
        "max_allowed_time_to_collision_up_to_carrot": 1.0,
        "use_regulated_linear_velocity_scaling": True,
        "use_cost_regulated_linear_velocity_scaling": False,
        "cost_scaling_dist": 0.3,
        "cost_scaling_gain": 1.0,
        "inflation_cost_scaling_factor": 3.0,
        "rotate_to_heading_min_angle": 0.785,
        "allow_reversing": False,
    },
    "Graceful": {
        "plugin": "nav2_graceful_controller::GracefulController",
        "v_linear_min": 0.05,
        "v_linear_max": 0.22,
        "v_angular_max": 1.0,
        "acc_lim_linear": 2.5,
        "acc_lim_angular": 3.2,
        "decel_lim_linear": -2.5,
        "decel_lim_angular": -3.2,
        "k_phi": 2.0,
        "k_delta": 1.0,
        "beta": 0.4,
        "lambda": 2.0,
        "slowdown_radius": 0.5,
        "angular_dist_threshold": 0.785,
        "transform_tolerance": 0.2,
    },
}


def generate_config(planner_name, controller_name, out_path):
    with open(BASE_PARAMS_PATH, "r") as f:
        cfg = yaml.safe_load(f)

    # Set planner
    p_spec = PLANNERS[planner_name]
    cfg["planner_server"]["ros__parameters"]["GridBased"] = copy.deepcopy(p_spec)

    # Set controller
    if controller_name != "MPPI":
        c_spec = CONTROLLERS[controller_name]
        cfg["controller_server"]["ros__parameters"]["FollowPath"] = copy.deepcopy(c_spec)

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w") as f:
        yaml.dump(cfg, f, default_flow_style=False)
    return out_path


if __name__ == "__main__":
    out_dir = "parity/fixtures/tb3_burger/nav2_bringup/configs"
    for p in PLANNERS:
        for c in CONTROLLERS:
            p_file = os.path.join(out_dir, f"{p}_{c}.yaml")
            generate_config(p, c, p_file)
    print(f"Generated {len(PLANNERS) * len(CONTROLLERS)} configuration files in {out_dir}")
