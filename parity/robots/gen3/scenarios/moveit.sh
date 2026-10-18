# M1: Gen3 7-DoF in Gazebo (README "Simulation") and then MoveIt (README "To generate motion plans and execute them
# with a Gazebo simulated 7 DoF Kinova Gen3 arm": kinova_gen3_7dof_robotiq_2f_85_moveit_config sim.launch.py)
xvfb-run -a ros2 launch kortex_bringup kortex_sim_control.launch.py sim_gazebo:=true use_sim_time:=true launch_rviz:=false &
sleep 40
xvfb-run -a ros2 launch kinova_gen3_7dof_robotiq_2f_85_moveit_config sim.launch.py use_sim_time:=true
wait
