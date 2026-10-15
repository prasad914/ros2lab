# Parity Verification Results against Installed Jazzy Packages

Generated from `tests/fixtures/_installed/facts.md` and installed package inspection.

| Item / Spec Section | Spec Claim | Installed Evidence & Path | Status |
|---|---|---|---|
| **Docking Server** (S5) | `opennav_docking` installed | `tests/fixtures/_installed/ros2_pkg_list.txt` contains `opennav_docking` | CONFIRMED |
| **Route Server** (S5) | `nav2_route` installed | `tests/fixtures/_installed/ros2_pkg_list.txt` contains `nav2_route` | CONFIRMED |
| **Velocity Stamped Cmd** (S5) | `enable_stamped_cmd_vel: true` in TB3 nav params and bridge YAML | `turtlebot3_navigation2/param/*.yaml` lines show `enable_stamped_cmd_vel: true`; `turtlebot3_gazebo/params/*_bridge.yaml` shows `geometry_msgs/msg/TwistStamped` | CONFIRMED |
| **AMCL Initial Pose** (S7) | `set_initial_pose: false` | Default in nav2 bringup / AMCL config | CONFIRMED |
| **Sensors per Robot** (S9) | Burger has scan/imu/odom, no camera/depth/pointcloud; Waffle/Waffle Pi have camera image/info | `turtlebot3_gazebo/models/` SDF files confirm Burger has imu and ray/gpu_lidar (`scan`), Waffle/Waffle Pi have camera (`camera/image_raw`, `camera/camera_info`) | CONFIRMED |
| **RViz Frame Rate / Timeout** (S10) | Frame Rate default 30, Frame Timeout 15s | `nav2_default_view.rviz` | CONFIRMED |
