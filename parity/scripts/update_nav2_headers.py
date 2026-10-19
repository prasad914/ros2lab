"""
update_nav2_headers.py - Header of public/robots/tb3_<model>/nav2_params.json: the installed source file and the
package version it came from (dpkg), and a check that the parameter values equal that installed file.
"""
import json
import subprocess

import yaml

deb_ver = subprocess.check_output(["dpkg-query", "-W", "ros-jazzy-turtlebot3-navigation2"], text=True).strip().split("\t")[1]
installed_ver = deb_ver.split("-")[0]   # upstream version, e.g. 2.3.6 of 2.3.6-1noble.20261006.044113

updates = [
    ("public/robots/tb3_burger/nav2_params.json", "/opt/ros/jazzy/share/turtlebot3_navigation2/param/burger.yaml"),
    ("public/robots/tb3_waffle/nav2_params.json", "/opt/ros/jazzy/share/turtlebot3_navigation2/param/waffle.yaml"),
    ("public/robots/tb3_waffle_pi/nav2_params.json", "/opt/ros/jazzy/share/turtlebot3_navigation2/param/waffle_pi.yaml")
]

for path, src in updates:
    with open(path, "r") as f:
        data = json.load(f)
    values = {k: v for k, v in data.items() if k != "_header"}
    if values != yaml.safe_load(open(src)):
        raise SystemExit(f"{path}: parameter values differ from {src}")
    data["_header"] = {
        "description": f"TurtleBot3 Navigation 2 Parameters (ROS 2 Jazzy installed)",
        "package": "turtlebot3_navigation2",
        "version": installed_ver,
        "deb_package": "ros-jazzy-turtlebot3-navigation2",
        "deb_version": deb_ver,
        "ros_distro": "jazzy",
        "upstream_repo": "https://github.com/ROBOTIS-GIT/turtlebot3.git",
        "source_file": src,
        "generated_by": "parity/scripts/update_nav2_headers.py"
    }
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
    print("Updated", path)
