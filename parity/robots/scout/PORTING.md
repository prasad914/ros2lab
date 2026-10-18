# AgileX Scout V2 – ROS2LAB-PORT to ROS 2 Jazzy / Gazebo Harmonic

Why a port: the maker's ROS 2 repositories have no Jazzy Gazebo simulation.
- `agilexrobotics/scout_ros2` branch `origin/jazzy` (48f70cbe "add jazzy driver"): only scout_base (the CAN hardware
  driver), scout_description, scout_msgs – no simulation (P2b rule 4: the hardware driver is not a simulation).
- `agilexrobotics/ugv_gazebo_sim` (git ls-remote: branches humble, master, old_version; no jazzy): the Scout simulation
  on branch humble 9d7888af uses Gazebo Classic (`gazebo_ros`, `libgazebo_ros_diff_drive.so`), which Jazzy does not have.

Port: branch `jazzy-ros2lab` of ~/robots_ws/src/agilex/ugv_gazebo_sim from humble 9d7888af, now d5068ecc. Two commits:
1. 0372dde `scout/scout_description/urdf/scout_v2.gazebo`: the Classic `libgazebo_ros_diff_drive.so` block replaced by
   `gz-sim-diff-drive-system` (left joints front_left_wheel + rear_left_wheel, right joints front_right_wheel +
   rear_right_wheel, topic cmd_vel, odom_topic odom, tf_topic tf, frames odom → base_link, 30 Hz) and
   `gz-sim-joint-state-publisher-system`. Wheel geometry: `${track}` (0.58306) and `${wheel_radius}` (0.16459) from
   scout_v2.xacro; the Classic block's wheel_separation 0.451 and wheel_diameter 0.08 did not match the model.
2. d5068ec `scout/scout_gazebo_sim/launch/scout_v2_gz.launch.py` (new) + package.xml exec_depends: ros_gz_sim
   (`-r -s empty.sdf`, `gui:=true` for the GUI), robot_state_publisher from scout_v2.xacro (use_sim_time),
   `ros_gz_sim create -topic robot_description -name scout_v2 -z 0.3`, ros_gz_bridge for /clock, /cmd_vel
   (geometry_msgs/msg/TwistStamped → gz.msgs.Twist), /odom, /tf, /joint_states.
Not ported: the Scout Mini files, the other AgileX robots in the repo, the Classic worlds (the port uses empty.sdf).
Build note: ugv_gazebo_sim's scout_description has the same package name as scout_ros2's, so the port is built with
`colcon build --symlink-install --base-paths src/agilex/ugv_gazebo_sim/scout --packages-up-to scout_gazebo_sim`.
