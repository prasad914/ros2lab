# Dobot CR5 in Gazebo Harmonic (DOBOT_6Axis_ROS2_V4 jazzy, README scenario 3 "Gazebo simulation only"), server only
# with the launch file's own gui:=false; DOBOT_TYPE=cr5 as the README says.
export DOBOT_TYPE=cr5
ros2 launch dobot_gazebo dobot_gazebo.launch.py gui:=false
