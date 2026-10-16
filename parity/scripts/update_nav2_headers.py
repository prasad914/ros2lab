import json
import subprocess

installed_ver = subprocess.check_output(["dpkg-query", "-W", "ros-jazzy-turtlebot3-navigation2"], text=True).strip().split("\t")[1]

updates = [
    ("public/robots/tb3_burger/nav2_params.json", "/opt/ros/jazzy/share/turtlebot3_navigation2/param/burger.yaml"),
    ("public/robots/tb3_waffle/nav2_params.json", "/opt/ros/jazzy/share/turtlebot3_navigation2/param/waffle.yaml"),
    ("public/robots/tb3_waffle_pi/nav2_params.json", "/opt/ros/jazzy/share/turtlebot3_navigation2/param/waffle_pi.yaml")
]

for path, src in updates:
    with open(path, "r") as f:
        data = json.load(f)
    data["_header"] = {
        "description": f"TurtleBot3 Navigation 2 Parameters (ROS 2 Jazzy installed)",
        "package": "turtlebot3_navigation2",
        "version": installed_ver,
        "ros_distro": "jazzy",
        "upstream_repo": "https://github.com/ROBOTIS-GIT/turtlebot3.git",
        "source_file": src,
        "generated_by": "parity script P6"
    }
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
    print("Updated", path)
