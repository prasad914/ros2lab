# goal_pose_gui

A separate window, like `joint_state_publisher_gui`, for typing goal positions and orientations for any robot.

| Robot | What the window sends |
|---|---|
| Arm with MoveIt | Tool pose (x, y, z, roll, pitch, yaw) or joint values to `move_group` (`/move_action`); a Cartesian (straight-line) path via `/compute_cartesian_path` and `/execute_trajectory` |
| Arm without MoveIt | Joint values to `/<controller>/follow_joint_trajectory` (`-p use_moveit:=false -p controller:=arm_controller`) |
| Mobile, legged, flying | Goal x, y (z), yaw to `/navigate_to_pose` (Nav2 or `pose_follower`); velocity sliders to `cmd_vel` |

```bash
# arm (MoveIt running)
ros2 run goal_pose_gui goal_pose_gui --ros-args -p robot_type:=arm -p planning_group:=ur_manipulator -p end_effector_link:=tool0
# mobile robot in Gazebo (DiffDrive system, plain Twist on /cmd_vel)
ros2 launch goal_pose_gui goal_pose_gui.launch.py robot_type:=diff
# mobile robot with Jazzy's diff_drive_controller (TwistStamped on its own topic)
ros2 launch goal_pose_gui goal_pose_gui.launch.py robot_type:=diff stamped:=true cmd_vel:=/diff_drive_controller/cmd_vel
```

The same goals from a terminal:

```bash
ros2 action send_goal /navigate_to_pose nav2_msgs/action/NavigateToPose \
  "{pose: {header: {frame_id: odom}, pose: {position: {x: 1.0, y: 0.5}, orientation: {z: 0.383, w: 0.924}}}}" --feedback
ros2 topic pub --once /goal_pose geometry_msgs/msg/PoseStamped \
  "{header: {frame_id: odom}, pose: {position: {x: 1.0, y: 0.5}, orientation: {w: 1.0}}}"
```

`pose_follower` is a proportional controller with no map and no obstacle avoidance. Use Nav2 for real navigation.
Tests: `colcon test --packages-select goal_pose_gui && colcon test-result --verbose`.
