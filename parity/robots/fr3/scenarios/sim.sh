# Franka FR3 in Gazebo Harmonic (franka_ros2 jazzy, franka_gazebo_bringup doc "joint_position_example_controller"),
# server only through the launch file's own gz_args, RViz off. The example controller runs the maker's joint motion.
ros2 launch franka_gazebo_bringup gazebo_franka_arm_example_controller.launch.py robot_type:=fr3 controller:=joint_position_example_controller gz_args:='-r -s empty.sdf' rviz:=false
