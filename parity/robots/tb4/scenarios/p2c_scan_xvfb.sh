# Lidar check: the maker's turtlebot4_gz.launch.py with its GUI on a virtual display (software rendering), to compare
# /scan with the EGL headless launch (all ranges at range_min there)
xvfb-run -a ros2 launch turtlebot4_gz_bringup turtlebot4_gz.launch.py rviz:=false
