# Kinova Gen3 7-DoF + Robotiq 2F-85 in Gazebo Harmonic (ros2_kortex jazzy, README "Simulation"), sim_gazebo:=true.
# The launch file always starts the Gazebo GUI, so it runs on a virtual display.
xvfb-run -a ros2 launch kortex_bringup kortex_sim_control.launch.py sim_gazebo:=true use_sim_time:=true launch_rviz:=false
