#!/usr/bin/env python3
"""
Generate robot capability manifests (robots/<id>.json and robots/<id>/manifest.json)
from captured topic fixtures and installed configs.
Spec S1, Prompt P3.
"""
import os
import json

ROBOTS = {
    "tb3_burger": {
        "title": "TurtleBot3 Burger",
        "category": "mobile",
        "nonstandard": False,
        "base_frame": "base_footprint",
        "odom_frame": "odom",
        "map_frame": "map",
        "sensors": [
            {"name": "lidar", "type": "sensor_msgs/msg/LaserScan", "topic": "/scan", "frame_id": "base_scan", "rate_hz": 5.0},
            {"name": "imu", "type": "sensor_msgs/msg/Imu", "topic": "/imu", "frame_id": "imu_link", "rate_hz": 100.0},
            {"name": "odometry", "type": "nav_msgs/msg/Odometry", "topic": "/odom", "frame_id": "odom", "child_frame_id": "base_footprint", "rate_hz": 30.0}
        ],
        "fixture_topic_list": "parity/fixtures/tb3_burger/sensors/topic_list.txt",
        "frames": [
            "odom",
            "base_footprint",
            "base_link",
            "base_scan",
            "imu_link",
            "wheel_left_link",
            "wheel_right_link",
            "caster_back_link"
        ]
    },
    "tb3_waffle": {
        "title": "TurtleBot3 Waffle",
        "category": "mobile",
        "nonstandard": False,
        "base_frame": "base_footprint",
        "odom_frame": "odom",
        "map_frame": "map",
        "sensors": [
            {"name": "lidar", "type": "sensor_msgs/msg/LaserScan", "topic": "/scan", "frame_id": "base_scan", "rate_hz": 5.0},
            {"name": "imu", "type": "sensor_msgs/msg/Imu", "topic": "/imu", "frame_id": "imu_link", "rate_hz": 100.0},
            {"name": "odometry", "type": "nav_msgs/msg/Odometry", "topic": "/odom", "frame_id": "odom", "child_frame_id": "base_footprint", "rate_hz": 30.0},
            {"name": "camera_rgb", "type": "sensor_msgs/msg/Image", "topic": "/camera/image_raw", "frame_id": "camera_rgb_optical_frame", "rate_hz": 30.0},
            {"name": "camera_info", "type": "sensor_msgs/msg/CameraInfo", "topic": "/camera/camera_info", "frame_id": "camera_rgb_optical_frame", "rate_hz": 30.0}
        ],
        "fixture_topic_list": "parity/fixtures/tb3_waffle/sensors/topic_list.txt",
        "frames": [
            "odom",
            "base_footprint",
            "base_link",
            "base_scan",
            "imu_link",
            "wheel_left_link",
            "wheel_right_link",
            "caster_back_right_link",
            "caster_back_left_link",
            "camera_link",
            "camera_rgb_frame",
            "camera_rgb_optical_frame",
            "camera_depth_frame",
            "camera_depth_optical_frame"
        ]
    },
    "tb3_waffle_pi": {
        "title": "TurtleBot3 Waffle Pi",
        "category": "mobile",
        "nonstandard": False,
        "base_frame": "base_footprint",
        "odom_frame": "odom",
        "map_frame": "map",
        "sensors": [
            {"name": "lidar", "type": "sensor_msgs/msg/LaserScan", "topic": "/scan", "frame_id": "base_scan", "rate_hz": 5.0},
            {"name": "imu", "type": "sensor_msgs/msg/Imu", "topic": "/imu", "frame_id": "imu_link", "rate_hz": 100.0},
            {"name": "odometry", "type": "nav_msgs/msg/Odometry", "topic": "/odom", "frame_id": "odom", "child_frame_id": "base_footprint", "rate_hz": 30.0},
            {"name": "camera_rgb", "type": "sensor_msgs/msg/Image", "topic": "/camera/image_raw", "frame_id": "camera_rgb_optical_frame", "rate_hz": 30.0},
            {"name": "camera_info", "type": "sensor_msgs/msg/CameraInfo", "topic": "/camera/camera_info", "frame_id": "camera_rgb_optical_frame", "rate_hz": 30.0}
        ],
        "fixture_topic_list": "parity/fixtures/tb3_waffle/sensors/topic_list.txt",
        "frames": [
            "odom",
            "base_footprint",
            "base_link",
            "base_scan",
            "imu_link",
            "wheel_left_link",
            "wheel_right_link",
            "caster_back_right_link",
            "caster_back_left_link",
            "camera_link",
            "camera_rgb_frame",
            "camera_rgb_optical_frame"
        ]
    }
}

DEFAULT_QOS = {
    "/clock": {"reliability": "Best Effort", "durability": "Volatile", "depth": 10, "history": "Keep Last"},
    "/robot_description": {"reliability": "Reliable", "durability": "Transient Local", "depth": 1, "history": "Keep Last"},
    "/rosout": {"reliability": "Reliable", "durability": "Transient Local", "depth": 1000, "history": "Keep Last"},
    "/parameter_events": {"reliability": "Reliable", "durability": "Volatile", "depth": 1000, "history": "Keep Last"},
    "/tf": {"reliability": "Reliable", "durability": "Volatile", "depth": 100, "history": "Keep Last"},
    "/tf_static": {"reliability": "Reliable", "durability": "Transient Local", "depth": 100, "history": "Keep Last"}
}

def parse_topics(path):
    if not path or not os.path.exists(path):
        return []
    topics = []
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            parts = line.split(" ")
            name = parts[0]
            type_str = parts[1].strip("[]") if len(parts) > 1 else "std_msgs/msg/String"
            qos = DEFAULT_QOS.get(name, {
                "reliability": "Reliable",
                "durability": "Volatile",
                "depth": 10,
                "history": "Keep Last"
            })
            topics.append({
                "name": name,
                "type": type_str,
                "qos": qos
            })
    return topics

def main():
    root = "/home/prasad/ros2lab-course"
    robots_dir = os.path.join(root, "public", "robots")
    os.makedirs(robots_dir, exist_ok=True)

    for rid, info in ROBOTS.items():
        topics = []
        if info.get("fixture_topic_list"):
            fpath = os.path.join(root, info["fixture_topic_list"])
            topics = parse_topics(fpath)
        else:
            topics = [
                {"name": "/cmd_vel", "type": "geometry_msgs/msg/TwistStamped", "qos": {"reliability": "Reliable", "durability": "Volatile", "depth": 10, "history": "Keep Last"}},
                {"name": "/odom", "type": "nav_msgs/msg/Odometry", "qos": {"reliability": "Reliable", "durability": "Volatile", "depth": 10, "history": "Keep Last"}},
                {"name": "/tf", "type": "tf2_msgs/msg/TFMessage", "qos": {"reliability": "Reliable", "durability": "Volatile", "depth": 100, "history": "Keep Last"}},
                {"name": "/tf_static", "type": "tf2_msgs/msg/TFMessage", "qos": {"reliability": "Reliable", "durability": "Transient Local", "depth": 100, "history": "Keep Last"}}
            ]

        manifest = {
            "_header": {
                "robot": rid,
                "description": f"Robot capability manifest for {info['title']} (ROS 2 Jazzy)",
                "source": info.get("fixture_topic_list") or "installed"
            },
            "id": rid,
            "name": info["title"],
            "category": info["category"],
            "nonstandard": info["nonstandard"],
            "base_frame": info["base_frame"],
            "odom_frame": info["odom_frame"],
            "map_frame": info["map_frame"],
            "sensors": info["sensors"],
            "topics": topics,
            "frames": info["frames"]
        }

        # Write public/robots/<id>/manifest.json
        sub_dir = os.path.join(robots_dir, rid)
        os.makedirs(sub_dir, exist_ok=True)
        sub_json = os.path.join(sub_dir, "manifest.json")
        with open(sub_json, "w") as f:
            json.dump(manifest, f, indent=2)
            f.write("\n")
        print(f"Wrote {sub_json}")

        # Check / copy nav2_params.json for waffle_pi if needed
        if rid == "tb3_waffle_pi":
            waffle_params = os.path.join(robots_dir, "tb3_waffle", "nav2_params.json")
            target_params = os.path.join(sub_dir, "nav2_params.json")
            if os.path.exists(waffle_params) and not os.path.exists(target_params):
                with open(waffle_params) as f:
                    pdata = json.load(f)
                pdata["_header"]["description"] = "TurtleBot3 Waffle Pi Navigation 2 Parameters (ROS 2 Jazzy)"
                with open(target_params, "w") as f:
                    json.dump(pdata, f, indent=2)
                    f.write("\n")
                print(f"Wrote {target_params}")

if __name__ == "__main__":
    main()
