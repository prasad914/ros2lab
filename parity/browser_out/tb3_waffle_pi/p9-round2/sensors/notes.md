Scenario tried: tb3_waffle_pi / sensors; the only scenario with fixtures in this robot folder.
The fixture action_list.txt is empty; no pose estimate, goal, planner/controller choice, or RViz display-add action is listed.
World launch attempted: {"attempted":true}.
Observed after launch attempt: ROS2Lab ROS 2 for beginners
Home
Playground
Simulator
Free resources
Log in
Register
Robotic Models Simulator / Robot
Robot not found

This page has one robot and its own workspace. A description package is built with colcon, and a launch file (Python or XML) starts robot_state_publisher, joint_state_publisher_gui and rviz2 with a saved .rviz config, as on Ubuntu. Move a slider and the robot moves: /joint_states → robot_state_publisher → /tf → RViz.

Gazebo, MoveIt 2 and the real robot on this page

Robot

Launch it
 Robot model (display)
 Gazebo simulation with sensors (sim)
 Gazebo + ros2_control (sim_control)
 Python launch file
 XML launch file
Type these commands for me
or type them in the terminal below
Workspace files
Robot details: links, joints, sensors, Gazebo plugins
Terminal: ~/ros2_ws
student@ros2lab: ~/ros2_ws
Right-click a terminal for the Terminator menu
+ New terminal
student@ros2lab: ~/ros2_ws
(There is no robot "tb3_waffle_pi" in the catalog. Go back to the Robotic Models Simulator and pick one.)
student@ros2lab:~/ros2_ws$ TURTLEBOT3_MODEL=waffle_pi ros2 launch turtlebot3_gazebo turtlebot3_world.launch.py
TURTLEBOT3_MODEL=waffle_pi: command not found
student@ros2lab:~/ros2_ws$
Tab
↑ Last command
Open a new terminal
Open VS Code
Start again
Connect to ROS 2 on your Ubuntu computer (rosbridge)
How it works, and its limits
ROS2Lab: a free ROS 2 course for students and engineers
Developed by the Robotics and ROS2 lab Channel
Terms of Use
Privacy notice
RViz launch attempted: {"attempted":true}.
Exact blocker displayed by browser: There is no robot "tb3_waffle_pi" in the catalog. Go back to the Robotic Models Simulator and pick one.
Also displayed for launch command: TURTLEBOT3_MODEL=waffle_pi: command not found.
No simulator launch completed; no RViz element interaction or expected bus-message assertion was available. Pose agreement was not assessed.
