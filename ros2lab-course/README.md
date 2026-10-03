# ROS2Lab: "ROS 2 from zero, in six weeks" (www.ros2lab.com)

A free online course for engineering students. Anyone with a valid college ID card can register; the instructor approves each registration.
**Start with SETUP-GUIDE.md.** Updating an existing site? Read the newest **UPDATE-V*.md** (now **UPDATE-V8.md**, which also covers sites still on v6).

## What is in this folder

| Path | What it is |
|---|---|
| `public/` | The website: landing page, registration, sign-in, course, lessons, tests, instructor dashboard, Playground and concept lab. Contains no lessons and no answers. |
| `public/js/anims/` | 27 interactive concept animations (topics, services, actions, parameters, launch, TF2, spin, P-control, quaternions...). |
| `public/js/puzzles.js` | Lesson puzzle blocks: step-through code tracer, match, sort, spot-the-bug, order, think-first and flashcards. |
| `public/js/terminal-sim.js`, `public/js/ros-graph.js` | The practice Ubuntu terminal (tabs, nano, colcon, ros2 pkg create) and the pretend running ROS 2 system behind it. It runs the students' own Python and C++ node code (publishers, subscribers, services, clients, actions, parameters, launch files, tf2, lifecycle, components) and shows TurtleSim windows. |
| `content/course-content.json` | The 6-week course: 95 lessons (Days 1 to 30) and 6 weekly tests. Uploaded from the Instructor page. |
| `functions/` | Server code: sign-up checks, ID card review, per-student test papers and grading, automatic clean-up. `functions/questions/` holds 188 question templates. |
| `ros2-code/` | The real ROS 2 Jazzy packages behind Weeks 5 and 6 (Python and C++), built and tested on a real system. See `ros2-code/README.md`. |
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
- **Week 5, ROS Programming Fundamentals:** Days 21–25. There are 20 chapters, each idea first in a **Python chapter** and then in a **separate C++ chapter**:
  - your first package and node;
  - a timer and a publisher that drive the turtle;
  - a subscriber;
  - your own message;
  - a service server and a service client;
  - an action server and client;
  - parameters and YAML files;
  - launch files;
  - a battery-monitor mini-project.
- **Week 6, Writing your own ROS 2 nodes:** Days 26–30. New ideas only (nothing from Week 5 is taught again), in Python and C++, with nodes that really control a robot:
  - time and logging;
  - a square driven with a state machine;
  - closed-loop go-to-goal, a safety filter that chains nodes, and messages in code;
  - QoS, and safe parameters (descriptors, ranges, callbacks);
  - launch files for two robots;
  - a tf2 broadcaster and listener;
  - executors, lifecycle nodes and components;
  - tests, and a patrol-robot project.

Every lesson takes up to 30 minutes. Week 7 will be planned later.

Keep this folder private: it contains the question templates.
