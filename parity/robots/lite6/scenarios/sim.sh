# xArm Lite 6 beside a table in Gazebo Harmonic (xarm_ros2 jazzy, README 5.8), controllers loaded by the launch file's
# own load_controller:=true; GUI on a virtual display. Same build as xarm6 (parity/robots/xarm6/build_summary.txt).
xvfb-run -a ros2 launch xarm_gazebo lite6_beside_table_gazebo.launch.py load_controller:=true
