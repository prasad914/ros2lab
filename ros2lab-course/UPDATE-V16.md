# ROS2Lab update V16: real robots, Gazebo sensors in RViz, chapter fixes

This package contains **everything from V13, V14 and V15** plus the changes below. Unzip it over your saved version, as before.

## What changed

**1. Robot selection: real robots from their makers' ROS packages**

The Robot list on the RViz page (and the gallery in the Week 9 lesson RV6) now has groups:

| Group | Robots |
|---|---|
| Basic robots (ROS2Lab) | the teaching models: 3-DOF arm, 6-DOF arm, Chiku, quadruped, hexapod, humanoid, Ackermann, mecanum, hybrids |
| Collaborative and desktop arms | Universal Robots UR5e, Franka FR3 (with hand), Kinova Gen3 7-DOF with vision module, UFACTORY xArm 6 and Lite 6, Dobot CR5, Dobot Magician, SO-101 (LeRobot), Trossen WidowX 250 |
| Industrial arms | ABB IRB 120, KUKA KR 6 R900 (Agilus), FANUC LR Mate 200iD |
| Mobile robots | TurtleBot3 Waffle and Burger, AgileX Scout V2 |
| Legged robots and humanoids | Unitree Go2, Unitree G1 (29 DOF), Unitree H1, Boston Dynamics Spot |
| Drones | Bitcraze Crazyflie 2.1, the teaching quadcopter |

- **Where the models come from:**
  - Each real robot is built from its maker's public ROS repository with the real `xacro`.
  - Meshes are the original STL, DAE or OBJ files with their materials and textures, simplified so they load faster.
  - Each package carries its LICENSE, and the page shows the source repository and licence.
- **Unitree "G2":** there is no Unitree G2. Unitree's current robots are the Go2 (quadruped), the G1 and the H1 (humanoids), and all three are included.

**2. Gazebo sensors shown in RViz, the way it is done on Ubuntu with ROS 2 Jazzy**

Robots with sensors (TurtleBot3, Go2, G1, H1, Kinova Gen3) have a second launch file, `sim.launch.py` / `sim.launch.xml`. Choose **Gazebo simulation** in step 3 of the RViz page. The package is laid out like a real Jazzy simulation package:

```
urdf/<robot>.gazebo.xacro      <gazebo reference="link"><sensor type="gpu_lidar|camera|rgbd_camera|imu">, DiffDrive, JointStatePublisher
urdf/<robot>_sim.urdf.xacro    the robot + its Gazebo tags (+ optical frames for cameras)
worlds/<robot>_world.sdf       a room; loads the Physics, Sensors (ogre2) and Imu systems
config/gz_bridge.yaml          ros_gz_bridge: Gazebo topics -> ROS 2 topics (and /cmd_vel back)
launch/sim.launch.py (.xml)    gz_sim.launch.py + robot_state_publisher + ros_gz_sim create + parameter_bridge + rviz2
rviz/sim.rviz                  RobotModel, TF, LaserScan, PointCloud2, Image, Imu, Odometry
```

- **The Gazebo window:**
  - It shows the world and the robot.
  - It has play, pause and step buttons, and shows sim time, RTF and the entity tree.
- **What each sensor produces:**
  - The lidar casts rays (LaserScan, and PointCloud2 for 3D lidars such as the Livox MID-360 and the Unitree L1).
  - Cameras render images (Image display, and Camera display with overlay).
  - Depth cameras give depth images and coloured point clouds.
  - The IMU gives orientation, angular velocity and acceleration.
- **Driving and moving the robots:**
  - Drive the mobile robots with `ros2 run teleop_twist_keyboard teleop_twist_keyboard` in a new terminal. Buttons are shown, or type the keys i, j, l, k, q, z.
  - You can also use `ros2 topic pub /cmd_vel ...`.
  - The Kinova Gen3 has position controllers: `ros2 topic pub --once /joint_2/cmd_pos std_msgs/msg/Float64 "{data: 1.0}"`.
- **Commands that work in the practice terminal:**
  - `ros2 topic list`, `ros2 topic echo /scan`, `ros2 topic hz /scan`, `ros2 node info /ros_gz_bridge`
  - `gz sim -r empty.sdf`, `gz topic -l`, `gz topic -e -t /clock`, `gz model --list`
  - `ros2 run ros_gz_sim create ...`, `ros2 run ros_gz_bridge parameter_bridge /scan@sensor_msgs/msg/LaserScan[gz.msgs.LaserScan`
- **The real rules apply, so the usual mistakes show up exactly as on Ubuntu:**
  - Sensors publish only if the world loads `gz-sim-sensors-system` (and `gz-sim-imu-system` for IMUs).
  - ROS 2 sees a Gazebo topic only through `ros_gz_bridge`.
  - The frame is `<gz_frame_id>`; without it, RViz says *Could not transform from [model/link/sensor]*.
  - A paused simulation publishes nothing.
  - Gazebo Classic plugins (`libgazebo_ros_*.so`) and sensor type `ray` do nothing in Harmonic.
  - With `use_sim_time`, RViz's ROS Time is the Gazebo clock.
- **Your own package (Open a package folder… / Open files…):**
  - If the URDF has `<gazebo>` sensors or systems, the world, bridge YAML, `sim.launch.py/.xml` and `sim.rviz` are generated from what the URDF declares.
  - The notes explain anything that will not work: a missing `gz_frame_id`, no JointStatePublisher, or Gazebo Classic plugins.
- **Robot details panel:**
  - Below the package files, a new **Robot details** panel lists every link, the moving joints with their limits, the Gazebo sensors (topic, rate, frame, resolution), the Gazebo systems, and ros2_control and transmissions if present.

**3. RViz**
- **New displays, each with RViz2's own properties and status texts** ("Topic: OK", "N messages received at X hz.", "Showing [N] points from [1] messages", "Could not transform from [...] to [...]"):
  - **Image** and **Camera**: each opens its own panel under Displays, as in RViz2. Camera draws the 3D scene behind or over the image, using CameraInfo.
  - **Imu**: from `rviz_imu_plugin`. If that package is not installed, a saved config shows the red "class could not be loaded" display, as in RViz2.
  - **PointCloud2**: colour transformers Intensity, AxisColor, RGB8 and FlatColor.
  - **LaserScan** and **Odometry**: now fed by topic. Odometry keeps poses using Position Tolerance, Angle Tolerance and Keep.
- **rosbridge:** connected to a real Ubuntu computer through rosbridge, RViz now subscribes to the topic of every display you add, and decodes real images, point clouds, IMU, odometry, paths and maps.
- **Marker display:**
  - Its Topic starts empty, as in RViz2.
  - Its status shows "OK" and then "N messages received".
  - `ros2 topic pub --once` now waits for a subscriber (Jazzy behaviour) and publishes as soon as RViz subscribes.
- **QoS mismatch:** like RViz2, the display shows "Topic: OK" and draws nothing. The rclcpp warning "offering incompatible QoS ... RELIABILITY_QOS_POLICY" is printed where rviz2's output is.
- **Joints:**
  - Floating and planar joints are treated as fixed, as robot_state_publisher does.
  - joint_state_publisher gives them no slider.
- **Other fixes:**
  - The "Add → By topic" list in lesson RViz windows now lists the lesson's topics.
  - RViz no longer reports mass and inertia warnings (check_urdf still does).

**4. Lessons (upload the new course content)**
- **RV3 (Markers):** the terminal steps now follow RViz2:
  1. Add a Marker display by type.
  2. Type `/visualization_marker` into its empty Topic.
  3. Publish.
- **RV2 (Sensor data):**
  - The QoS text now describes what RViz2 really shows ("Topic: OK", nothing drawn, and the incompatible-QoS warning in the terminal).
  - A new section explains Gazebo sensor tags and the ros_gz_bridge YAML, and asks students to run the TurtleBot3 simulation on the RViz page.
- **RV6 (Robot gallery):** lists the real robots, and the gallery select groups them.
- **UR7 (6-DOF arm):** a new RViz block shows the real UR5e from Universal Robots' package.

## Publish

1. Unzip the package over your project folder (`C:\ros2lab-course`).
2. Publish the website:
   ```
   firebase deploy --only hosting
   ```
3. Upload the updated lesson text:
   1. Open the website and press **Ctrl + F5**.
   2. Go to **Instructor → Course content** and upload `content\course-content.json`.

   Optional check before uploading: `node tools\check-content.mjs` should end with "All good".
4. Open www.ros2lab.com/rviz.html, press **Ctrl + F5**, then:
   1. Choose **TurtleBot3 Waffle** and **Gazebo simulation**.
   2. Press **Type these commands for me**.

The package is larger than before (about 65 MB) because of the robot meshes in `public/robots/`. Firebase Hosting serves them like any other file.

## New files

| File | What it is |
|---|---|
| `public/js/ros-gz.js` | Gazebo + ros_gz for the practice terminal (gz sim, create, parameter_bridge, gz topics, bridged data, launch-file reading) |
| `public/js/gz-sdf.js` | Reads `<gazebo>` sensor and plugin tags, world SDF files and bridge YAML |
| `public/js/gz-sim.js` | The browser stand-in for Gazebo: world, robots, lidar rays, camera rendering, IMU |
| `public/js/gz-window.js` | The Gazebo Sim window |
| `public/js/rviz-sim.js` | Writes the simulation files of a package (gazebo.xacro, world, bridge YAML, launch files, RViz displays) |
| `public/js/ros-msgs.js` | Decodes real ROS 2 messages received through rosbridge |
| `public/vendor/three/loaders/MTLLoader.js` | three.js OBJ material loader (MIT) |
| `public/robots/<package>/` | 18 real robot packages, each with its LICENSE file |

## Licences of the robot models

The model files are redistributed under their own licences (kept in each package folder):

| Package | Source | Licence |
|---|---|---|
| ur_description | UniversalRobots/Universal_Robots_ROS2_Description | BSD-3-Clause |
| franka_description | frankarobotics/franka_description | Apache-2.0 |
| kortex_description | Kinovarobotics/ros2_kortex | BSD-3-Clause |
| xarm_description | xArm-Developer/xarm_ros2 | BSD-3-Clause |
| cra_description | Dobot-Arm/DOBOT_6Axis_ROS2_V4 | MIT |
| dobot_description | jkaniuka/magician_ros2 | MIT |
| so101_description | TheRobotStudio/SO-ARM100 | Apache-2.0 |
| interbotix_xsarm_descriptions | Interbotix/interbotix_ros_manipulators | BSD-3-Clause |
| abb_irb120_support | ros-industrial/abb | Apache-2.0 |
| kuka_kr6_support | ros-industrial/kuka_experimental | Apache-2.0 |
| fanuc_lrmate200id_support | ros-industrial/fanuc | BSD-3-Clause |
| turtlebot3_description | ROBOTIS-GIT/turtlebot3 | Apache-2.0 |
| scout_description | agilexrobotics/scout_ros2 | Apache-2.0 |
| go2_description, g1_description, h1_description | unitreerobotics/unitree_ros | BSD-3-Clause |
| spot_description | bdaiinstitute/spot_description | MIT |
| crazyflie_description | IMRCLab/crazyswarm2 | MIT |

Robot and company names are trademarks of their owners. ROS2Lab is not affiliated with them. The page says the models come from the makers' public ROS packages.
