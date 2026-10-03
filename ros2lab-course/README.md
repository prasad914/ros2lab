# ROS2Lab: "ROS 2 from zero, in seven weeks" (www.ros2lab.com)

A free online course for engineering students. Anyone with a valid college ID card can register; the instructor approves each registration.
**Start with SETUP-GUIDE.md.** Updating an existing site? Read the newest **UPDATE-V*.md** (now **UPDATE-V7.md**).

## What is in this folder

| Path | What it is |
|---|---|
| `public/` | The website: landing page, registration, sign-in, course, lessons, tests, instructor dashboard, Playground and concept lab. Contains no lessons and no answers. |
| `public/js/anims/` | 30 interactive concept animations (topics, services, actions, parameters, launch, TF2, P-control, IK, differential drive, quaternions, mobile manipulator planning...). |
| `public/js/puzzles.js` | Lesson puzzle blocks: step-through code tracer, match, sort, spot-the-bug, order, think-first and flashcards. |
| `public/js/terminal-sim.js`, `public/js/ros-graph.js` | The practice Ubuntu terminal (tabs, nano, colcon) and the pretend running ROS 2 system behind it. It runs the students' own Python/C++ node code: publishers, subscribers, services, actions, parameters, tf2, lifecycle, components, launch files. It also has TurtleSim, arm and mobile-base windows. |
| `content/course-content.json` | The 7-week course: 113 lessons (Days 1 to 35) and 7 weekly tests. Uploaded from the Instructor page. |
| `functions/` | Server code: sign-up checks, ID card review, per-student test papers and grading, automatic clean-up. `functions/questions/` holds 209 question templates. |
| `ros2-code/` | The real ROS 2 Jazzy packages behind Weeks 6 and 7 (Python and C++), built and tested on a real system. See `ros2-code/README.md`. |
| `firestore.rules`, `storage.rules` | Security rules for the database and for ID card photos. |
| `firebase.json` | Hosting settings and security headers. |
| `tools/preview.html` | Preview lessons on your laptop before uploading. |
| `tools/check-content.mjs` | Checks every practice terminal and Python exercise in the course file: `node tools/check-content.mjs` |
| `COURSE-OUTLINE.md` | Every lesson, day by day. |

## The course

- **Week 1, Talk to the robot's computer:** Days 1–5: terminal basics, files, permissions and apt, Python from zero.
- **Week 2, Build the robot's brain:** Days 6–10: Python objects and first ROS 2 nodes, C++ basics, classes and an rclcpp node, Ubuntu and ROS 2 Jazzy installation.
- **Week 3, Introduction to ROS:** Days 11–15: why robots need a software platform, ROS parts and ecosystem, versions, ROS 1 vs ROS 2, DDS, domains and QoS.
- **Week 4, Speak ROS 2:** Days 16–20: nodes, topics, services, parameters, actions, launch files, workspaces, TF2 and debugging, hands-on in the practice terminal.
- **Week 5, ROS Programming Fundamentals:** Days 21–25: packages and nodes in Python and C++, publishers and subscribers, custom interfaces, services, actions, parameters, launch files, mini-project.
- **Week 6, Writing your own ROS 2 nodes:** Days 26–30. There are 24 topics (33 lessons), each with separate Python and C++ code:
  - node anatomy, timers, package files, logging;
  - open-loop and closed-loop robot control, safety filters and remapping;
  - messages in code, QoS, a custom message;
  - services and clients that control the robot, a custom service;
  - action server and client, parameters in depth, launch in depth;
  - tf2 broadcaster and listener, executors and callback groups;
  - lifecycle nodes and components, pytest and gtest, and a patrol-robot mini-project.
- **Week 7, Kinematics nodes for arms and mobile robots:** Days 31–35. There are 13 topics (16 lessons), each with Python and C++ code:
  - URDF and robot_state_publisher, frames and transforms;
  - forward and inverse kinematics, an IK node, a MoveArm service and a command-line client, smooth trajectories;
  - differential drive, wheel odometry (Odometry + TF), drift and sensor fusion;
  - mobile-manipulator frames, a drive-then-reach planner, and a capstone.

Every lesson takes up to 30 minutes.

Keep this folder private: it contains the question templates.
