# TurtleBot4 (standard) in Gazebo Harmonic from the Jazzy apt packages, server only with EGL headless rendering
# (parity/scripts/launch/tb4_headless.launch.py: the installed spawn launch unchanged, no GUI client).
# Attempt 1 (xvfb-run turtlebot4_gz.launch.py rviz:=false) ran at real_time_factor 0.0049: fixtures/tb4/sim_attempt1_xvfb.
ros2 launch parity/scripts/launch/tb4_headless.launch.py
