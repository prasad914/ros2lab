#!/usr/bin/env python3
"""
Generate per-robot nav2_params.json from real upstream ROS 2 Jazzy YAML configuration files.
Cites the upstream source file, repository, and version.
"""

import json
import os
import yaml
import zipfile

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, ".."))
PUBLIC_ROBOTS = os.path.join(ROOT_DIR, "public", "robots")

ROBOT_CONFIGS = [
    {
        "name": "tb3_burger",
        "aliases": ["turtlebot3_burger", "turtlebot3"],
        "source_file": "public/robots/ws/turtlebot3/src/turtlebot3/turtlebot3_navigation2/param/burger.yaml",
        "package": "turtlebot3_navigation2",
        "version": "2.3.7",
        "ros_distro": "jazzy",
        "upstream_repo": "https://github.com/ROBOTIS-GIT/turtlebot3.git",
        "description": "TurtleBot3 Burger Navigation 2 Parameters (ROS 2 Jazzy)"
    },
    {
        "name": "tb3_waffle",
        "aliases": ["turtlebot3_waffle"],
        "source_file": "public/robots/ws/turtlebot3/src/turtlebot3/turtlebot3_navigation2/param/waffle.yaml",
        "package": "turtlebot3_navigation2",
        "version": "2.3.7",
        "ros_distro": "jazzy",
        "upstream_repo": "https://github.com/ROBOTIS-GIT/turtlebot3.git",
        "description": "TurtleBot3 Waffle Navigation 2 Parameters (ROS 2 Jazzy)"
    },
    {
        "name": "crazyflie",
        "aliases": ["crazyflie_description"],
        "source_file": "public/robots/ws/crazyswarm2/src/crazyswarm2/crazyflie_examples/config/nav2_params.yaml",
        "package": "crazyflie_examples",
        "version": "0.4.0",
        "ros_distro": "jazzy",
        "upstream_repo": "https://github.com/IMRCLab/crazyswarm2.git",
        "description": "Crazyflie 2.1 Navigation 2 Parameters (ROS 2 Jazzy)"
    },
    {
        "name": "scout",
        "aliases": ["scout_description", "scout_v2"],
        "zip_source": "share/nav2_bringup/params/nav2_params.yaml",
        "package": "nav2_bringup",
        "version": "1.3.1",
        "ros_distro": "jazzy",
        "upstream_repo": "https://github.com/ros-navigation/navigation2.git",
        "description": "AgileX Scout v2 Navigation 2 Parameters (ROS 2 Jazzy)"
    }
]

def load_yaml(cfg):
    if "source_file" in cfg:
        path = os.path.join(ROOT_DIR, cfg["source_file"])
        with open(path, "r", encoding="utf-8") as f:
            return yaml.safe_load(f)
    elif "zip_source" in cfg:
        zip_path = os.path.join(ROOT_DIR, "public", "ros", "jazzy", "share.zip")
        with zipfile.ZipFile(zip_path, "r") as z:
            with z.open(cfg["zip_source"]) as f:
                return yaml.safe_load(f.read().decode("utf-8"))
    raise ValueError(f"Unknown config source: {cfg}")

def main():
    print("Generating per-robot nav2_params.json files...")
    for cfg in ROBOT_CONFIGS:
        data = load_yaml(cfg)

        # Inject metadata citation header
        out_dict = {
            "_header": {
                "description": cfg["description"],
                "package": cfg["package"],
                "version": cfg["version"],
                "ros_distro": cfg["ros_distro"],
                "upstream_repo": cfg["upstream_repo"],
                "source_file": cfg.get("source_file") or cfg.get("zip_source"),
                "generated_by": "tools/generate-nav2-params.py"
            }
        }
        for k, v in data.items():
            out_dict[k] = v

        targets = [cfg["name"]] + cfg.get("aliases", [])
        for target in targets:
            target_dir = os.path.join(PUBLIC_ROBOTS, target)
            os.makedirs(target_dir, exist_ok=True)
            out_path = os.path.join(target_dir, "nav2_params.json")
            with open(out_path, "w", encoding="utf-8") as f:
                json.dump(out_dict, f, indent=2)
            print(f"  [+] Wrote {out_path}")

    print("Successfully generated all nav2_params.json files.")

if __name__ == "__main__":
    main()
