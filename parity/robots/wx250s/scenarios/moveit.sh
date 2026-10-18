# M1: Interbotix WX250s MoveIt with the maker's fake hardware (xsarm_moveit.launch.py includes xsarm_ros_control for
# hardware_type fake; jazzy-ros2lab fixes in parity/robots/wx250s/PORTING.md). MoveIt RViz off. Not Gazebo.
export RCUTILS_LOGGING_BUFFERED_STREAM=0
ros2 launch interbotix_xsarm_moveit xsarm_moveit.launch.py robot_model:=wx250s hardware_type:=fake use_moveit_rviz:=false
