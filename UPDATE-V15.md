# ROS2Lab update V15: RViz launched the real ROS 2 way

This package contains **everything from V13 and V14** plus the changes below. Unzip it over your saved version, as before.

## What changed

**The RViz page now works like a ROS 2 computer**

Every robot is a ROS 2 **description package** in `~/ros2_ws/src`, laid out the standard way:

```
<robot>_description/
  package.xml
  CMakeLists.txt        install(DIRECTORY launch urdf meshes rviz DESTINATION share/${PROJECT_NAME})
  urdf/                 the .urdf.xacro and its included macro files
  meshes/               STL / DAE files (if any)
  launch/display.launch.py
  launch/display.launch.xml
  rviz/display.rviz     Fixed Frame, Grid + RobotModel + TF, and a saved camera view
```

The student uses the practice terminal on the page and types the usual commands (or presses **Type these commands for me**):

```
cd ~/ros2_ws
colcon build --packages-select arm3_description
source install/setup.bash
ros2 launch arm3_description display.launch.py      (or display.launch.xml)
```

- **The launch file:**
  - It runs `xacro` on the model and passes the result as the `robot_description` parameter of **robot_state_publisher**.
  - It starts **joint_state_publisher_gui** (or joint_state_publisher with `gui:=false`) and **rviz2 -d display.rviz**.
  - The launch arguments `model:=` and `gui:=` work.
- **The terminal behaves like on Ubuntu:**
  - `ros2 launch` keeps it busy until Ctrl+C.
  - Open **+ New terminal** to try `ros2 node list`, `ros2 topic list`, `ros2 topic info /robot_description`, `ros2 topic echo /joint_states`, `ros2 topic echo /tf`, `ros2 run tf2_ros tf2_echo base_link <link>`.
- **The data flow is the real one:**
  - Moving a slider publishes `/joint_states`.
  - robot_state_publisher turns it into `/tf`.
  - RViz moves the robot.
  - Fixed joints are on `/tf_static`.
- **The RViz window title** is the installed config path, as on Ubuntu: `/home/student/ros2_ws/install/<pkg>/share/<pkg>/rviz/display.rviz - RViz`.
- **Your own robot:**
  - **Open a package folder…** uses your package as it is, including your own launch files.
  - **Open files…** wraps loose `.urdf`/`.urdf.xacro` and mesh files into a new package.
  - If a package has no launch file, `display.launch.py`, `display.launch.xml` and `display.rviz` are added.
- **The rosbridge connection** to a real Ubuntu computer is still on the page, under "Connect to ROS 2 on your Ubuntu computer".

**RViz itself**
- **Fixed Frame**, frame properties and topic properties are now Qt combo boxes, as in RViz2:
  - click the value and pick from the list, or type and press Enter;
  - Fixed Frame lists the TF frames that exist;
  - a Topic lists the topics of the right message type (Description Topic lists `/robot_description`).
- **Other property editors:** choice properties (Plane, Style…) open a Qt list, and colours have a "…" colour picker.
- **Add → By topic** now works as in RViz2 (from `add_display_dialog.cpp`):
  - It lists every topic whose type has a display plugin (with `display.launch.py` running: /clicked_point, /goal_pose, /initialpose, /joint_states, /tf, /tf_static).
  - It has **Show unvisualizable topics** (/parameter_events, /robot_description, /rosout) and **Filter topics by name**.
  - The dialog has RViz2's real size (500 × 660) and opens above the page like a separate window.
- **RobotModel:**
  - The robot appears only when its Description Topic has a publisher, as in RViz2.
  - Status messages are RViz2's own: "Topic: OK", "1 messages received at … hz.", "URDF parsed OK", "URDF failed Model parse".
- **.rviz files** are read with a proper YAML reader, so real RViz config files (keys in any order, groups, saved views) load correctly.

**Lessons**
- Week 7 to 9 RViz blocks now show the conventional command `ros2 launch urdf_tutorial display.launch.py model:=$PWD/my_robot.urdf.xacro` and the nodes it starts.
- Lessons XT5 and RV1 now tell students that a RobotModel added "by display type" starts with an empty Description Topic (exactly like RViz2), and how to choose `/robot_description`.

## Publish

1. Unzip the package over your project folder (`C:\ros2lab-course`).
2. Publish the website:
   ```
   firebase deploy --only hosting
   ```
   (If you have not published V13 yet, follow UPDATE-V13.md first; it also deploys functions and rules.)
3. Upload the updated lesson text: open the website, press **Ctrl + F5**, go to **Instructor → Course content**, and upload `content\course-content.json`.
   (Optional check before uploading: `node tools\check-content.mjs`. It replays every terminal task and should end with "All good".)
4. Open www.ros2lab.com/rviz.html, press **Ctrl + F5**, then **Type these commands for me**.

## New files

| File | What it is |
|---|---|
| `public/js/rviz-pkg.js` | Builds description packages (package.xml, CMakeLists.txt, Python and XML launch files, .rviz config) |
| `public/js/rviz-yaml.js` | Reads .rviz config files |
| `public/img/rviz/qt/ecombo.png`, `ecombo_enum.png`, `popup_sel.png` | Qt Fusion combo box parts, drawn by rendering Qt |
