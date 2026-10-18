# Interbotix WX250s with the maker's fake hardware (interbotix_xsarm_ros_control, jazzy branch + jazzy-ros2lab build/launch fixes
# in interbotix_ros_toolboxes and interbotix_ros_manipulators, see parity/robots/wx250s/PORTING.md). Not Gazebo: the maker's sim is Gazebo Classic.
ros2 launch interbotix_xsarm_ros_control xsarm_ros_control.launch.py robot_model:=wx250s hardware_type:=fake use_rviz:=false
