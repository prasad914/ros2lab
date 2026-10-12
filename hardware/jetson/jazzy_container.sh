#!/usr/bin/env bash
# JetPack 6.x (Ubuntu 22.04): ROS 2 Jazzy in a container, with the GPU, the USB devices and the host network.
#   ./jazzy_container.sh            start (or attach to) the container; ~/ros2_ws is shared with the host
set -euo pipefail
NAME=ros2lab_jazzy
if ! docker ps -a --format '{{.Names}}' | grep -qx "$NAME"; then
  docker run -d --name "$NAME" --runtime nvidia --network host --ipc host --privileged \
    -v /dev:/dev -v "$HOME/ros2_ws:/root/ros2_ws" -e RMW_IMPLEMENTATION=rmw_cyclonedds_cpp -e ROS_DOMAIN_ID="${ROS_DOMAIN_ID:-7}" \
    ros:jazzy-ros-base sleep infinity
  docker exec "$NAME" bash -c "apt-get update && apt-get install -y ros-jazzy-ros2-control ros-jazzy-ros2-controllers ros-jazzy-imu-sensor-broadcaster ros-jazzy-xacro ros-jazzy-rmw-cyclonedds-cpp ros-jazzy-python-qt-binding"
fi
docker start "$NAME" >/dev/null
exec docker exec -it "$NAME" bash
