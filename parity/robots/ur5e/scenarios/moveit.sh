# M1: UR5e Gazebo + MoveIt from the apt package ur_simulation_gz (ur_sim_moveit.launch.py starts RViz and the
# Gazebo GUI itself), on a virtual display
xvfb-run -a ros2 launch ur_simulation_gz ur_sim_moveit.launch.py ur_type:=ur5e
