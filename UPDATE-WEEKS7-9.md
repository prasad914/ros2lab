# ROS2Lab update: Weeks 7 to 9 (URDF, xacro, TF and RViz)

This update adds an **optional advanced track** (Days 31 to 45, 22 lessons, 3 tests) and a practice **3D RViz** that runs in the browser.
It also contains the earlier changes that make the site independent (no college details, Gmail contact, the "Developed by the Robotics and ROS2 lab Channel" credit).

## What is new

- **Week 7, Describe a robot with URDF:** links, shapes, origins, colours, joints, limits, mimic joints, the joint-frame rule, REP 103/105 frames, Chiku (2 wheels), a 3-DOF arm with a gripper, a 6-DOF arm, collision and inertia.
- **Week 8, Xacro, meshes and TF:** properties, maths, macros (4-legged and 6-legged robots), arguments, includes, meshes, robot_state_publisher, joint_state_publisher, tf2_echo, view_frames, static transforms, a description package with Python and XML display launch files.
- **Week 9, RViz, markers and interactive markers:** displays, Fixed Frame, saved configs, sensor displays and QoS, markers, MarkerArrays, interactive markers with menus, a robot gallery, and a mobile-manipulator project.
- **Practice RViz (RViz-lite):**
  - In the practice terminal: `rviz2`, `ros2 run rviz2 rviz2`, `ros2 launch urdf_tutorial display.launch.py model:=...`, `ros2 launch urdf_launch display.launch.py ...` and the students' own display launch files all open it under the terminal, with joint sliders, TF, markers and real RViz error messages.
  - New terminal commands: `xacro`, `check_urdf`, `urdf_to_graphviz`, `ros2 run tf2_tools view_frames`, and `$(xacro file)` inside commands. `ros2 topic pub` now also handles `visualization_msgs/msg/Marker` and `sensor_msgs/msg/JointState`. The old positional `static_transform_publisher` form works too, with Jazzy's deprecation warning.
  - In lessons: a live URDF/xacro editor (xacro + check_urdf + 3D view + automatic goals) and a gallery of 12 robots.
  - In the Python playground: published markers appear in 3D, and dragging an interactive marker calls the student's own feedback callback.
- **Robot library** in `public/robots/`: 12 original teaching robots (xacro), shared macros and two STL meshes.
- **three.js** (MIT licence) is hosted with your site in `public/vendor/three/`. Nothing new is loaded from other websites, so the security settings in `firebase.json` stay the same.

## The certificate does not change

Weeks 7 to 9 are optional. A new setting in `functions/config.js` decides which weeks count for lifetime access, the project unlock and the certificate:

```js
const CORE_MODULES = ["W1", "W2", "IN", "W3", "PF", "NP"];
```

To make the new weeks count as well, add `"UR", "XT", "RV"` to the list (or leave the list empty `[]` so that every week counts), then deploy the functions again.

## Publishing (about 20 minutes)

1. **Copy the files.** Unzip `ros2lab-weeks7-9-changed-files.zip` into a folder, then copy its `ros2lab-course` folder over `C:\ros2lab-course`, replacing files:
   ```
   mkdir "%USERPROFILE%\Downloads\r2l-w79"
   tar -xf "%USERPROFILE%\Downloads\ros2lab-weeks7-9-changed-files.zip" -C "%USERPROFILE%\Downloads\r2l-w79"
   xcopy "%USERPROFILE%\Downloads\r2l-w79\ros2lab-course\*" "C:\ros2lab-course\" /E /Y
   ```
2. **Check.** Each check must end as shown:
   ```
   cd /d C:\ros2lab-course\functions
   npm test
   ```
   This must end with **All checks passed**.
   ```
   cd /d C:\ros2lab-course
   node tools\check-content.mjs
   ```
   This must say **Checked 92 practice terminals, 14 RViz editor blocks and 65 Python exercises. All good.**
3. **Deploy** both parts. The functions are needed for the new `CORE_MODULES` setting.
   ```
   firebase deploy --only functions
   firebase deploy --only hosting
   ```
4. **Upload the content.**
   1. Open the website, press **Ctrl + F5**, and go to **Instructor → Course content**.
   2. Upload `content\course-content.json`.
   3. Expect 9 modules, 117 lessons and 9 tests.
5. **Open the new tests.**
   1. Go to **Instructor → Tests**.
   2. For the Week 7, Week 8 and Week 9 tests, set the dates, tick **Published** and press Save.
6. **Try it.**
   1. Open Week 7, Day 31 and press **Run** in the editor: a 3D view appears.
   2. Open Week 8, Day 39 and run the terminal tasks: RViz opens below the terminal.

If the 3D view says that WebGL is not available, the student's browser or device has 3D graphics switched off. Chrome or Firefox on a normal laptop or phone works.

## Before teaching Week 8 on real Ubuntu

The URDF, xacro and launch examples follow the official ROS 2 Jazzy tutorials and were checked against the real `xacro` program. They have not been run on a real Ubuntu machine, so once on a lab PC:

```
sudo apt install ros-jazzy-urdf-tutorial ros-jazzy-joint-state-publisher-gui liburdfdom-tools ros-jazzy-xacro
```

Then build the `my_robot_description` package from Day 40 and run `ros2 launch my_robot_description display.launch.py`.
