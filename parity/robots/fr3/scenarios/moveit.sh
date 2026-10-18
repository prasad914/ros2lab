# M1: FR3 MoveIt with the maker's fake hardware (franka_fr3_moveit_config moveit.launch.py use_fake_hardware:=true;
# franka_gazebo_controllers.yaml has no trajectory controller for MoveIt). RViz on a virtual display.
xvfb-run -a ros2 launch franka_fr3_moveit_config moveit.launch.py robot_ip:=dont-care use_fake_hardware:=true
