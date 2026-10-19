import json
import yaml
import subprocess

mapping = [
    ("public/robots/tb3_burger/nav2_params.json", "/opt/ros/jazzy/share/turtlebot3_navigation2/param/burger.yaml"),
    ("public/robots/tb3_waffle/nav2_params.json", "/opt/ros/jazzy/share/turtlebot3_navigation2/param/waffle.yaml"),
    ("public/robots/tb3_waffle_pi/nav2_params.json", "/opt/ros/jazzy/share/turtlebot3_navigation2/param/waffle_pi.yaml")
]

installed_ver = subprocess.check_output(["dpkg-query", "-W", "ros-jazzy-turtlebot3-navigation2"], text=True).strip().split("\t")[1]
print("Installed version:", installed_ver)

all_match = True
for jpath, ypath in mapping:
    with open(ypath) as f:
        ydata = yaml.safe_load(f)
    with open(jpath) as f:
        jdata = json.load(f)
    j_params = {k: v for k, v in jdata.items() if k != "_header"}
    match = (j_params == ydata)
    print(f"{jpath} vs {ypath}: match = {match}")
    if not match:
        all_match = False
        print("Mismatch in", jpath)

if not all_match:
    print("FAIL: nav2_params.json does not match installed yaml files!")
    exit(1)
else:
    print("SUCCESS: all nav2_params.json match installed yaml files.")
