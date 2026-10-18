# xArm6 beside a table in Gazebo Harmonic (xarm_ros2 jazzy, README 5.8 "Testing xarm on gazebo independently").
# The launch file always starts the Gazebo GUI, so it runs on a virtual display.
xvfb-run -a ros2 launch xarm_gazebo xarm6_beside_table_gazebo.launch.py load_controller:=true
# load_controller:=true is the launch file's own argument (default false: no controllers, attempt 1 in fixtures/xarm6/sim_attempt1_no_controllers)
