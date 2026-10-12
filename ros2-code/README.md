# Week 5 and Week 6 code: the real ROS 2 packages

These are the complete packages that the Week 5 and Week 6 lessons show and explain, line by line. They are real code. Every package was built and run on **ROS 2 Jazzy** (zero compiler warnings, 12 unit tests passing). The numbers quoted in the lessons' "Tested on a real system" boxes come from these exact files.

Give them to students **after** they have tried the lessons, or use them in a lab session on real Ubuntu 24.04 + ROS 2 Jazzy.

| Package | Language | What is inside |
|---|---|---|
| `my_robot_interfaces` | interfaces | `BatteryStatus.msg`, `RobotStatus.msg`, `SetSpeed.srv`, `GoTo.srv`, `Countdown.action`, `DriveDistance.action` |
| `chiku_control` | Python | 26 nodes. **Week 5:** hello_node, circle_driver, pose_monitor, status_publisher, switchable_driver, spawn_client, turtle_artist, drive_distance_server/client, speed_driver, battery_monitor. **Week 6:** heartbeat, log_demo, square_driver, go_to_goal, safety_filter, head_joints, latched_status, late_listener, goto_server, cruise_control, turtle_tf_broadcaster, turtle_follower, battery_checker, lifecycle_driver, patrol. It also has launch files (circle, mission, turtle_goal in Python/XML/YAML, two_robots, follow, patrol), config files and pytest tests. |
| `chiku_control_cpp` | C++ | The same nodes in rclcpp, plus a composable `circle_component`, `control_math.hpp`, launch files (circle.launch.xml, mission.launch.py, turtle_goal.launch.py) and gtest tests. |

## Build and test (Ubuntu 24.04, ROS 2 Jazzy)

```bash
sudo apt install ros-jazzy-turtlesim ros-jazzy-tf2-ros python3-colcon-common-extensions
mkdir -p ~/ros2_ws
cp -r src ~/ros2_ws/            # this folder's src/
cd ~/ros2_ws
source /opt/ros/jazzy/setup.bash
colcon build
source install/setup.bash
colcon test && colcon test-result     # expect: 12 tests, 0 errors, 0 failures
```

## Try it

```bash
ros2 launch chiku_control circle.launch.py                   # Week 5: turtlesim + speed_driver + pose_monitor
ros2 launch chiku_control mission.launch.py                  # Week 5 mini-project: battery monitor
ros2 run chiku_control spawn_client                          # Week 5: a service client (turtlesim must be running)
ros2 launch chiku_control turtle_goal.launch.py goal_x:=3.0  # Week 6: closed-loop go-to-goal
ros2 launch chiku_control two_robots.launch.xml              # Week 6: two namespaced robots, goals from YAML
ros2 launch chiku_control follow.launch.py                   # Week 6: tf2, turtle2 follows turtle1
```

Every C++ node has the same name and the same topics as its Python twin. So `ros2 run chiku_control speed_driver` and `ros2 run chiku_control_cpp speed_driver` can be swapped freely.

Note: pressing Ctrl+C on `ros2 launch` sometimes prints a harmless `KeyboardInterrupt` traceback from a Python node. The terminal and launch both send the stop signal (lesson N18 explains this).
