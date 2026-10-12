# ROS2Lab update: an RViz2-like viewer, a separate joint_state_publisher_gui window, and the RViz page

This update includes everything in `UPDATE-WEEKS7-9.md` (Weeks 7 to 9). If you have not published that yet, follow that guide; the steps are the same.

## What changed

- **RViz looks and works like RViz2.**
  - **Window:** a title bar with the config file name, File / Panels / Help menus, and a status bar with RViz's mouse hints.
  - **Toolbar:** Interact, Move Camera, Select, Focus Camera, Measure, 2D Pose Estimate, 2D Goal Pose and Publish Point.
  - **Displays panel:** a property tree with RViz's real property names (Reference Frame, Plane Cell Count, Description Topic, Visual/Collision Enabled, Show Names/Axes/Arrows, Topic, Reliability Policy …), a status for each display, and Add / Duplicate / Remove / Rename.
  - **Add dialog:** "rviz: Create visualization", with **By display type** and **By topic**.
  - **Views panel** (Orbit, TopDownOrtho) and **Time panel**.
  - **File → Save Config As** writes a full `.rviz` file, and `rviz2 -d` / launch files load all its display properties.
- **The tools publish real messages.**
  - In the practice terminal, after using 2D Goal Pose, Publish Point or 2D Pose Estimate, `ros2 topic echo /goal_pose` (or `/clicked_point`, `/initialpose`) shows the message.
  - Week 9, Day 41 has a new task for this.
- **joint_state_publisher_gui is its own window.**
  - It opens on its own, with or without RViz, as on Ubuntu.
  - Drag it by its title bar or minimise it.
  - The **⧉** button moves it into a real separate browser window; closing that window brings the sliders back.
- **Meshes:** STL, DAE (Collada) and OBJ.
- **New public page `rviz.html`** (menu: **RViz**):
  - **Gallery:** pick a robot.
  - **Your own files:** open your own `.urdf` / `.urdf.xacro` files or a whole package folder with meshes. `package://` and `$(find pkg)` are found inside the folder, and nothing is uploaded.
  - **Real ROS 2:** **connect to ROS 2 Jazzy** on the same computer through rosbridge. It shows `/robot_description`, `/tf`, `/tf_static`, markers, `/scan` and `/map`. The RViz tools publish `/goal_pose`, `/clicked_point` and `/initialpose`, and the sliders can publish `/joint_states`.
    ```
    sudo apt install ros-jazzy-rosbridge-suite
    ros2 launch rosbridge_server rosbridge_websocket_launch.xml
    ```
    Then open www.ros2lab.com/rviz.html on the same computer and press **Connect** (address `ws://localhost:9090`). Chrome may ask you to allow access to apps on this device: allow it.

## One security setting changed (firebase.json)

- The site's security policy now allows WebSocket connections to rosbridge on `localhost:9090` and `127.0.0.1:9090`, plus `blob:` addresses for meshes opened from the student's computer.
- The `upgrade-insecure-requests` rule was removed. It would rewrite `ws://localhost` into `wss://`, which a normal rosbridge refuses.
- The site is still served only over HTTPS, and every address in it is already `https`.
- `firebase deploy --only hosting` applies this.

## Publishing

Copy the changed files over `C:\ros2lab-course`, then run:

```
cd /d C:\ros2lab-course\functions
npm test
cd ..
node tools\check-content.mjs
firebase deploy --only functions
firebase deploy --only hosting
```

`npm test` must end with **All checks passed**, and `check-content` with **All good**.

Then upload `content\course-content.json` (Instructor → Course content). Day 41 has a new task, so this upload is needed.

## What it is (and is not)

This is ROS2Lab's practice RViz2, built with three.js. It copies RViz2's windows, displays, properties, tools and messages, and reads URDF and xacro the way ROS does. It is **not** the real rviz2 program: that is a C++/Qt desktop application and cannot run inside a web page. With rosbridge, though, the data shown is real data from the student's own ROS 2.
