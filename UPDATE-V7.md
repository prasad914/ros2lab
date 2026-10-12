# Publishing the v7 update (Week 6: writing your own nodes; Week 7: kinematics)

Your site runs v6. This update adds two new weeks, new server question templates, new animations and a smarter practice terminal. Student accounts, progress and test results are kept. Plan about 20 minutes.

## What's new

### Week 6: Writing your own ROS 2 nodes (Days 26–30, 24 topics, 33 lessons)
Every topic shows **separate, complete Python and C++ code** in side-by-side tabs. It goes through the code slowly, line by line, with a step-by-step code tracer. Then students **write and run their own node** in the live terminal, which drives a TurtleSim robot.
- **Basics:** node anatomy (the 5 steps), timers and time, package.xml / setup.py / CMakeLists.txt in depth, logging levels, throttle and once.
- **Control:** open-loop driving (circle, square), a pose subscriber, closed-loop go-to-goal (P-control), a safety-filter node chained with remapping.
- **Communication:** building messages in code, QoS (reliable, best effort, latched), a custom RobotStatus message, an enable/disable service, service clients for turtlesim, a custom GoTo service, a DriveDistance action server and client with feedback and cancel.
- **Structure:** parameters in depth (descriptors, ranges, read-only, callbacks), launch in depth (arguments, YAML, namespaces, two robots), a tf2 broadcaster and a tf2 follower, executors and callback groups, lifecycle nodes and components, testing with pytest and gtest, and a patrol-robot mini-project.

### Week 7: Kinematics nodes for arms and mobile robots (Days 31–35, 13 topics, 16 lessons)
- **Arm:**
  - URDF and robot_state_publisher, frames and transforms;
  - forward kinematics, then inverse kinematics (elbow up and down, out of reach);
  - an IK node that publishes joint angles for any target point;
  - a MoveArm service plus a command-line client (user → robot);
  - smooth joint trajectories.
- **Mobile base:**
  - differential drive (cmd_vel → wheel speeds);
  - wheel odometry published as nav_msgs/Odometry plus the odom → base_link TF;
  - why odometry drifts (covariance, sensor fusion).
- **Mobile manipulator:**
  - frames from the floor to the gripper;
  - a planner node that drives the base and then calls IK to reach a point;
  - a capstone.
- **Practice robots:**
  - new robot windows show the arm, the mobile base (with its real path and the odometry path when they drift apart) and the mobile manipulator;
  - `ros2 run tf2_ros tf2_echo` and `static_transform_publisher` work in the terminal.

### The practice terminal runs the students' own code
When a student writes a node in nano and runs `colcon build`, the terminal reads their Python or C++ file. It then makes their publishers, subscribers, services, actions, parameters, timers and log messages live. Their topic names, parameter values and messages are used, so a wrong topic name, a missing entry point or a missing install line shows up just as it would on real ROS 2. The terminal also handles `colcon test`, `ros2 lifecycle`, `ros2 component`, launch files in Python/XML/YAML with arguments and namespaces, and the tf2 tools.

### Also new
- **6 new animations** (30 in total): the Week 6 node kit, P-control, 2-link IK, differential drive, quaternions, mobile-manipulator planning.
- **2 new weekly tests** (Week 6 and Week 7, 16 questions each), with 8 new question topics. Every student gets a different paper; there are 209 question templates in total.
- **Real code to download:** `ros2-code/` holds every Week 6 and Week 7 package (Python and C++). They were built and run on real ROS 2 Jazzy: 5 packages, 30 tests, 0 failures. The "Tested on a real system" boxes in the lessons quote these runs.
- Phones: long words and code no longer push lesson pages sideways.
- The course is now **113 lessons over 35 days** (7 weeks), each up to 30 minutes.

## Changed files
```
COURSE-OUTLINE.md, README.md, UPDATE-V7.md                 (docs)
content/course-content.json                                (the course)
functions/questions/index.js, functions/questions/nodes.js (new)
functions/test/run-tests.js
public/index.html, public/playground.html, public/resources.html
public/css/app.css
public/js/lesson-render.js, public/js/pyrun.js, public/js/py-worker.js
public/js/ros-graph.js, public/js/terminal-sim.js
public/js/anims/registry.js, public/js/anims/layers.js
public/js/anims/kit7.js, pctrl.js, ik2.js, diffdrive.js, quat.js, mmplan.js (new)
tools/check-content.mjs
ros2-code/                                                 (new: real ROS 2 packages)
```

## Steps

1. **Copy the files.** Unzip `ros2lab-v7-changed-files.zip`, then copy its `ros2lab-course` folder over your `C:\ros2lab-course` folder. Say **Yes** to replacing files.
2. **Check the questions.** In Command Prompt:
   ```
   cd C:\ros2lab-course\functions
   npm test
   ```
   It must end with **All checks passed**.
3. **Check the lessons** (optional; needs Python 3):
   ```
   cd C:\ros2lab-course
   node tools\check-content.mjs
   ```
   It should say **All good** (95 practice terminals, 81 Python exercises).
4. **Publish the new server code and website** (the Week 6 and 7 tests need the new question templates):
   ```
   firebase deploy --only functions
   firebase deploy --only hosting
   ```
5. **Upload the course.** Open the site → **Instructor → Course content** → choose `content\course-content.json` → **Upload**. It should report **7 modules, 113 lessons and 7 tests**.
6. **Open the new tests.** Go to **Instructor → Tests**. For **Week 6 test: writing your own ROS 2 nodes** and **Week 7 test: kinematics nodes for arms and mobile robots**:
   - set the dates and 2 attempts;
   - set answers shown to "After the test closes";
   - tick **Published**, then **Save**.
7. **Check it as a student.**
   - Press **Ctrl + F5** on the course page.
   - Open lesson **N7**: build, run go_to_goal and watch the turtle drive to the goal.
   - Open lesson **K12**: watch the mobile manipulator drive, then reach.

## Good to know
- Existing lessons, progress and test results are unchanged. Weeks 6 and 7 appear after Week 5.
- `ros2-code/` is for you and for lab sessions on real Ubuntu. It is not needed by the website and is not uploaded.
